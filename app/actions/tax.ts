"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { incomeType, INCOME_TYPES, NO_DEDUCTIONS, type IncomeType } from "@/lib/tax";
/** A form's result: an error to show, or `saved` once it stored the change. */
export type TaxState = { error?: string; saved?: boolean } | undefined;

// Tax amounts are always in baht, never converted, so BTC Standard doesn't stop editing them (requireUser, not requireEditable).

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/,/g, "").trim();
  return s === "" ? 0 : Number(s);
};

async function ownPlan(userId: number, planId: number) {
  const { rowCount } = await pool.query("SELECT 1 FROM tax_plans WHERE id = $1 AND user_id = $2", [planId, userId]);
  return Boolean(rowCount);
}

function readPlan(form: FormData) {
  const year = Number(form.get("year"));
  const name = String(form.get("name") ?? "").trim();
  if (!(Number.isInteger(year) && year >= 2000 && year <= 2100)) return { error: "Pick the tax year." };
  if (!name || name.length > 80) return { error: "Give the plan a name of 1 to 80 characters." };
  return { year, name };
}

export async function createTaxPlan(_: TaxState, form: FormData): Promise<TaxState> {
  const user = await requireUser();
  const p = readPlan(form);
  if ("error" in p) return p;
  const { rows } = await pool.query("INSERT INTO tax_plans (user_id, year, name) VALUES ($1, $2, $3) RETURNING id", [user.id, p.year, p.name]);
  revalidatePath("/tax");
  redirect(`/tax/${rows[0].id}`);
}

export async function updateTaxPlan(planId: number, _: TaxState, form: FormData): Promise<TaxState> {
  const user = await requireUser();
  const p = readPlan(form);
  if ("error" in p) return p;
  const { rowCount } = await pool.query("UPDATE tax_plans SET year = $3, name = $4 WHERE id = $1 AND user_id = $2", [planId, user.id, p.year, p.name]);
  if (!rowCount) return { error: "That plan no longer exists." };
  revalidatePath("/tax", "layout");
  return { saved: true };
}

/** A copy of the plan with its incomes and deductions, to try something different. */
export async function duplicateTaxPlan(planId: number) {
  const user = await requireUser();
  const client = await pool.connect();
  let id: number;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO tax_plans (user_id, year, name, deductions, notes)
       SELECT user_id, year, left(name || ' (copy)', 80), deductions, notes FROM tax_plans WHERE id = $1 AND user_id = $2 RETURNING id`,
      [planId, user.id],
    );
    if (!rows[0]) { await client.query("ROLLBACK"); return; }
    id = Number(rows[0].id);
    await client.query(
      `INSERT INTO tax_incomes (plan_id, type, name, amount, kind, actual_expense, withheld, separate)
       SELECT $2, type, name, amount, kind, actual_expense, withheld, separate FROM tax_incomes WHERE plan_id = $1 ORDER BY id`,
      [planId, id],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  revalidatePath("/tax");
  redirect(`/tax/${id}`);
}

export async function deleteTaxPlan(planId: number) {
  const user = await requireUser();
  await pool.query("DELETE FROM tax_plans WHERE id = $1 AND user_id = $2", [planId, user.id]);
  revalidatePath("/tax");
  redirect("/tax");
}

function readIncome(form: FormData) {
  const type = String(form.get("type") ?? "") as IncomeType;
  if (!INCOME_TYPES.some((t) => t.id === type)) return { error: "Pick the type of income." };
  const t = incomeType(type);
  const name = String(form.get("name") ?? "").trim() || t.label;
  const amount = num(form.get("amount"));
  const withheld = num(form.get("withheld"));
  const kindRaw = String(form.get("kind") ?? "");
  const kind = t.kinds ? (t.kinds.some((k) => k.id === kindRaw) ? kindRaw : t.kinds[0].id) : null;
  const useActual = t.actual && form.get("expense_mode") === "actual";
  const actualExpense = useActual ? num(form.get("actual_expense")) : null;
  const separate = type === "40_4" && form.get("separate") === "on";
  if (name.length > 80) return { error: "Keep the name under 80 characters." };
  if (!(amount > 0)) return { error: "Enter the income for the year, more than zero." };
  if (!(withheld >= 0)) return { error: "Tax withheld must be zero or more." };
  if (actualExpense !== null && !(actualExpense >= 0)) return { error: "Actual expenses must be zero or more." };
  return { type, name, amount, kind, actualExpense, withheld, separate };
}

export async function addTaxIncome(planId: number, _: TaxState, form: FormData): Promise<TaxState> {
  const user = await requireUser();
  if (!(await ownPlan(user.id, planId))) return { error: "That plan no longer exists." };
  const i = readIncome(form);
  if ("error" in i) return i;
  await pool.query(
    "INSERT INTO tax_incomes (plan_id, type, name, amount, kind, actual_expense, withheld, separate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [planId, i.type, i.name, i.amount, i.kind, i.actualExpense, i.withheld, i.separate],
  );
  revalidatePath(`/tax/${planId}`);
  revalidatePath("/tax");
  return { saved: true };
}

export async function updateTaxIncome(incomeId: number, _: TaxState, form: FormData): Promise<TaxState> {
  const user = await requireUser();
  const i = readIncome(form);
  if ("error" in i) return i;
  const { rows } = await pool.query(
    `UPDATE tax_incomes t SET type = $3, name = $4, amount = $5, kind = $6, actual_expense = $7, withheld = $8, separate = $9
     FROM tax_plans p WHERE t.id = $1 AND p.id = t.plan_id AND p.user_id = $2 RETURNING t.plan_id`,
    [incomeId, user.id, i.type, i.name, i.amount, i.kind, i.actualExpense, i.withheld, i.separate],
  );
  if (!rows[0]) return { error: "That income no longer exists." };
  revalidatePath(`/tax/${rows[0].plan_id}`);
  revalidatePath("/tax");
  return { saved: true };
}

export async function deleteTaxIncome(incomeId: number) {
  const user = await requireUser();
  const { rows } = await pool.query(
    "DELETE FROM tax_incomes t USING tax_plans p WHERE t.id = $1 AND p.id = t.plan_id AND p.user_id = $2 RETURNING t.plan_id",
    [incomeId, user.id],
  );
  if (rows[0]) { revalidatePath(`/tax/${rows[0].plan_id}`); revalidatePath("/tax"); }
}

/** Saves every deduction of the plan at once. Fields are the keys of Deductions; counts are whole numbers. */
export async function saveTaxDeductions(planId: number, _: TaxState, form: FormData): Promise<TaxState> {
  const user = await requireUser();
  const out: Record<string, number | boolean> = {};
  for (const k of Object.keys(NO_DEDUCTIONS)) {
    if (k === "spouse") { out[k] = form.get(k) === "on"; continue; }
    const n = num(form.get(k));
    if (!(n >= 0)) return { error: "Every amount must be zero or more." };
    const counted = ["childrenBefore2018", "childrenFrom2018", "parents", "disabled"].includes(k);
    if (counted && !Number.isInteger(n)) return { error: "Count people in whole numbers." };
    if (k === "parents" && n > 4) return { error: "Up to 4 parents: yours and your spouse's." };
    out[k] = n;
  }
  const { rowCount } = await pool.query("UPDATE tax_plans SET deductions = $3 WHERE id = $1 AND user_id = $2", [planId, user.id, JSON.stringify(out)]);
  if (!rowCount) return { error: "That plan no longer exists." };
  revalidatePath(`/tax/${planId}`);
  revalidatePath("/tax");
  return { saved: true };
}

export async function updateTaxNotes(planId: number, _: TaxState, form: FormData): Promise<TaxState> {
  const user = await requireUser();
  const notes = String(form.get("notes") ?? "").replace(/\r\n/g, "\n").trim();
  if (notes.length > 20_000) return { error: "Notes can be up to 20,000 characters." };
  const { rowCount } = await pool.query("UPDATE tax_plans SET notes = $3 WHERE id = $1 AND user_id = $2", [planId, user.id, notes || null]);
  if (!rowCount) return { error: "That plan no longer exists." };
  revalidatePath(`/tax/${planId}`);
}
