"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isMonth, STARTER_CATEGORIES } from "@/lib/spending";
import type { FormState } from "./auth";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/,/g, "").trim();
  return s === "" ? NaN : Number(s);
};
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

/* ---- Everyday: one total per category per month ---- */

/**
 * Saves a month: `a-<category id>` is what that category came to. An empty box clears the month's amount for it.
 * Only the user's own categories are touched.
 */
export async function saveMonth(month: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!isMonth(month)) return { error: "Pick a month." };
  const { rows } = await pool.query("SELECT id, name FROM spending_categories WHERE user_id = $1", [user.id]);
  const changes: { id: number; amount: number | null }[] = [];
  for (const r of rows) {
    const raw = form.get(`a-${r.id}`);
    if (raw === null) continue; // not on the form (an archived category with nothing this month)
    const amount = String(raw).trim() === "" ? null : num(raw);
    if (amount !== null && !(amount >= 0 && amount < 1e16)) return { error: `Check the amount for ${r.name}.` };
    changes.push({ id: Number(r.id), amount });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const c of changes) {
      if (c.amount === null) await client.query("DELETE FROM monthly_spending WHERE category_id = $1 AND month = $2", [c.id, `${month}-01`]);
      else await client.query(
        `INSERT INTO monthly_spending (category_id, month, amount) VALUES ($1, $2, $3)
         ON CONFLICT (category_id, month) DO UPDATE SET amount = EXCLUDED.amount`,
        [c.id, `${month}-01`, c.amount]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  revalidatePath("/spending");
}

/** Adds a category at the end of the list. A removed one with the same name comes back, with its past months. */
export async function addSpendingCategory(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: "Give the category a name of 1 to 60 characters." };
  const { rows } = await pool.query("SELECT id, archived FROM spending_categories WHERE user_id = $1 AND lower(name) = lower($2)", [user.id, name]);
  if (rows[0] && !rows[0].archived) return { error: `You already have ${name}.` };
  if (rows[0]) {
    await pool.query("UPDATE spending_categories SET archived = false, position = (SELECT coalesce(max(position), 0) + 1 FROM spending_categories WHERE user_id = $2) WHERE id = $1", [rows[0].id, user.id]);
  } else {
    await pool.query(
      "INSERT INTO spending_categories (user_id, name, position) SELECT $1, $2, coalesce(max(position), 0) + 1 FROM spending_categories WHERE user_id = $1",
      [user.id, name]);
  }
  revalidatePath("/spending");
}

/** Renames a category; its past months go with it. */
export async function renameSpendingCategory(id: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: "Give the category a name of 1 to 60 characters." };
  const { rowCount: taken } = await pool.query("SELECT 1 FROM spending_categories WHERE user_id = $1 AND lower(name) = lower($2) AND id <> $3", [user.id, name, id]);
  if (taken) return { error: `You already have a category called ${name}.` };
  await pool.query("UPDATE spending_categories SET name = $3 WHERE id = $1 AND user_id = $2", [id, user.id, name]);
  revalidatePath("/spending");
}

/** Takes a category off the list. With amounts recorded it is archived, so past months keep them; without, it goes. */
export async function removeSpendingCategory(id: number) {
  const user = await requireUser();
  const { rowCount: used } = await pool.query(
    "SELECT 1 FROM monthly_spending m JOIN spending_categories c ON c.id = m.category_id WHERE c.id = $1 AND c.user_id = $2 LIMIT 1", [id, user.id]);
  if (used) await pool.query("UPDATE spending_categories SET archived = true WHERE id = $1 AND user_id = $2", [id, user.id]);
  else await pool.query("DELETE FROM spending_categories WHERE id = $1 AND user_id = $2", [id, user.id]);
  revalidatePath("/spending");
}

/** Puts an archived category back on the list. */
export async function restoreSpendingCategory(id: number) {
  const user = await requireUser();
  await pool.query("UPDATE spending_categories SET archived = false WHERE id = $1 AND user_id = $2", [id, user.id]);
  revalidatePath("/spending");
}

/** Moves a category one place up or down the list. */
export async function moveSpendingCategory(id: number, by: -1 | 1) {
  const user = await requireUser();
  const { rows } = await pool.query("SELECT id FROM spending_categories WHERE user_id = $1 AND NOT archived ORDER BY position, id", [user.id]);
  const ids = rows.map((r) => Number(r.id));
  const i = ids.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await pool.query(
    "UPDATE spending_categories c SET position = v.pos FROM unnest($2::bigint[]) WITH ORDINALITY AS v(id, pos) WHERE c.id = v.id AND c.user_id = $1",
    [user.id, ids]);
  revalidatePath("/spending");
}

/** Starts an empty list with a handful of common categories. */
export async function startSpendingCategories() {
  const user = await requireUser();
  await pool.query(
    `INSERT INTO spending_categories (user_id, name, position)
     SELECT $1, name, pos FROM unnest($2::text[]) WITH ORDINALITY AS v(name, pos)
     WHERE NOT EXISTS (SELECT 1 FROM spending_categories WHERE user_id = $1)
     ON CONFLICT DO NOTHING`,
    [user.id, STARTER_CATEGORIES]);
  revalidatePath("/spending");
}

/* ---- Hobbies: each thing bought ---- */

function readHobby(form: FormData) {
  const date = String(form.get("date") ?? "");
  const amount = num(form.get("amount"));
  const category = String(form.get("category") ?? "").trim() || "Other";
  const name = String(form.get("name") ?? "").trim();
  const note = String(form.get("note") ?? "").replace(/\r\n/g, "\n").trim() || null;
  if (!isDate(date)) return { error: "Pick the date you spent it." };
  if (!(amount > 0) || amount >= 1e16) return { error: "Enter how much you spent." };
  if (!name) return { error: "Say what it was, e.g. Trip to Japan." };
  if (name.length > 120) return { error: "Keep what it was to 120 characters." };
  if (note && note.length > 5000) return { error: "A note can be up to 5,000 characters." };
  return { date, amount, category: category.slice(0, 60), name, note };
}

export async function createHobbySpending(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const s = readHobby(form);
  if ("error" in s) return s;
  await pool.query(
    "INSERT INTO spendings (user_id, kind, spent_on, amount, category, name, note) VALUES ($1, 'hobby', $2, $3, $4, $5, $6)",
    [user.id, s.date, s.amount, s.category, s.name, s.note]);
  revalidatePath("/spending/hobbies");
}

export async function updateHobbySpending(id: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const s = readHobby(form);
  if ("error" in s) return s;
  const { rowCount } = await pool.query(
    "UPDATE spendings SET spent_on = $3, amount = $4, category = $5, name = $6, note = $7 WHERE id = $1 AND user_id = $2 AND kind = 'hobby'",
    [id, user.id, s.date, s.amount, s.category, s.name, s.note]);
  if (!rowCount) return { error: "That no longer exists." };
  revalidatePath("/spending/hobbies");
}

export async function deleteHobbySpending(id: number) {
  const user = await requireUser();
  await pool.query("DELETE FROM spendings WHERE id = $1 AND user_id = $2 AND kind = 'hobby'", [id, user.id]);
  revalidatePath("/spending/hobbies");
}
