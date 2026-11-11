"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { MOODS } from "@/lib/types";
import type { FormState } from "./auth";

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

/** Creates a journal entry (id null) or saves changes to one, then shows it. */
export async function saveEntry(id: number | null, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const date = String(form.get("date") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const mood = String(form.get("mood") ?? "");
  const body = String(form.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  if (!isDate(date)) return { error: "Pick the date this is about." };
  if (!title || title.length > 120) return { error: "Give it a title of 1 to 120 characters." };
  if (!body) return { error: "Write something first." };
  if (body.length > 20_000) return { error: "An entry can be up to 20,000 characters." };
  const assets = form.getAll("asset").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const m = MOODS.some((x) => x.id === mood) ? mood : null;

  let entryId = id;
  if (id === null) {
    const { rows } = await pool.query(
      "INSERT INTO journal_entries (user_id, entry_date, title, mood, body) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [user.id, date, title, m, body]);
    entryId = Number(rows[0].id);
  } else {
    const { rowCount } = await pool.query(
      "UPDATE journal_entries SET entry_date = $3, title = $4, mood = $5, body = $6, updated_at = now() WHERE id = $1 AND user_id = $2",
      [id, user.id, date, title, m, body]);
    if (!rowCount) return { error: "That entry no longer exists." };
  }
  // The assets it is about, only ones that are the user's own.
  await pool.query("DELETE FROM journal_entry_assets WHERE entry_id = $1", [entryId]);
  if (assets.length > 0) {
    await pool.query(
      "INSERT INTO journal_entry_assets (entry_id, account_id) SELECT $1, a.id FROM accounts a WHERE a.user_id = $2 AND a.id = ANY($3::bigint[])",
      [entryId, user.id, assets]);
  }
  revalidatePath("/journal");
  redirect(`/journal/${entryId}`);
}

export async function deleteEntry(id: number) {
  const user = await requireUser();
  await pool.query("DELETE FROM journal_entries WHERE id = $1 AND user_id = $2", [id, user.id]);
  revalidatePath("/journal");
  redirect("/journal");
}
