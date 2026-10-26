"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getPlan } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { FREQUENCIES, type Frequency } from "@/lib/types";
import type { FormState } from "./auth";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/,/g, "").trim();
  return s === "" ? NaN : Number(s);
};
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

export async function createPlan(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Give the plan a name." };
  if (name.length > 80) return { error: "Keep the name under 80 characters." };

  const { rows } = await pool.query("INSERT INTO plans (user_id, name) VALUES ($1, $2) RETURNING id", [user.id, name]);
  // Cash and saving are the natural place to pay from, so they start ticked.
  await pool.query(
    `INSERT INTO plan_assets (plan_id, account_id)
     SELECT $1, a.id FROM accounts a JOIN categories c ON c.id = a.category_id
     WHERE a.user_id = $2 AND NOT a.archived AND c.type IN ('cash', 'saving')`,
    [rows[0].id, user.id],
  );
  revalidatePath("/", "layout");
  redirect(`/plans/${rows[0].id}`);
}

export async function updatePlan(planId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  const saving = form.get("saving") === "" ? 0 : num(form.get("saving"));
  if (!name || name.length > 80) return { error: "Use a name of 1 to 80 characters." };
  if (!(saving >= 0)) return { error: "The monthly saving must be zero or more." };

  await pool.query("UPDATE plans SET name = $3, monthly_saving = $4 WHERE id = $1 AND user_id = $2", [planId, user.id, name, saving]);
  revalidatePath("/", "layout");
}

export async function deletePlan(planId: number) {
  const user = await requireUser();
  await pool.query("DELETE FROM plans WHERE id = $1 AND user_id = $2", [planId, user.id]);
  revalidatePath("/", "layout");
  redirect("/plans");
}

type ItemInput = { name: string; amount: number; frequency: Frequency; startDate: string; occurrences: number };

function readItem(form: FormData): ItemInput | { error: string } {
  const name = String(form.get("name") ?? "").trim();
  const amount = num(form.get("amount"));
  const frequency = String(form.get("frequency") ?? "") as Frequency;
  const startDate = String(form.get("date") ?? "");
  const count = num(form.get("occurrences"));
  if (!name || name.length > 80) return { error: "Name the cost, up to 80 characters." };
  if (!(amount > 0)) return { error: "Enter the amount, more than zero." };
  if (!FREQUENCIES.some((f) => f.id === frequency)) return { error: "Pick how often it is paid." };
  if (!isDate(startDate)) return { error: "Pick a date." };
  if (frequency !== "once" && !(Number.isInteger(count) && count >= 1 && count <= 600)) {
    return { error: "Enter how many payments, from 1 to 600." };
  }
  return { name, amount, frequency, startDate, occurrences: frequency === "once" ? 1 : count };
}

export async function addPlanItem(planId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await getPlan(user.id, planId))) return { error: "That plan no longer exists." };
  const it = readItem(form);
  if ("error" in it) return it;

  await pool.query(
    "INSERT INTO plan_items (plan_id, name, amount, frequency, start_date, occurrences) VALUES ($1, $2, $3, $4, $5, $6)",
    [planId, it.name, it.amount, it.frequency, it.startDate, it.occurrences],
  );
  revalidatePath("/", "layout");
}

export async function updatePlanItem(itemId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const it = readItem(form);
  if ("error" in it) return it;

  const { rowCount } = await pool.query(
    `UPDATE plan_items i SET name = $3, amount = $4, frequency = $5, start_date = $6, occurrences = $7
     FROM plans p WHERE i.id = $1 AND p.id = i.plan_id AND p.user_id = $2`,
    [itemId, user.id, it.name, it.amount, it.frequency, it.startDate, it.occurrences],
  );
  if (!rowCount) return { error: "That cost no longer exists." };
  revalidatePath("/", "layout");
}

export async function deletePlanItem(itemId: number) {
  const user = await requireUser();
  await pool.query("DELETE FROM plan_items i USING plans p WHERE i.id = $1 AND p.id = i.plan_id AND p.user_id = $2", [itemId, user.id]);
  revalidatePath("/", "layout");
}

/** Replaces the set of assets paying for a plan with the ticked ones (only the user's own). */
export async function setPlanAssets(planId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await getPlan(user.id, planId))) return { error: "That plan no longer exists." };
  const ids = form.getAll("asset").map(Number).filter(Number.isInteger);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM plan_assets WHERE plan_id = $1", [planId]);
    await client.query(
      "INSERT INTO plan_assets (plan_id, account_id) SELECT $1, id FROM accounts WHERE user_id = $2 AND id = ANY($3::bigint[])",
      [planId, user.id, ids],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  revalidatePath("/", "layout");
}
