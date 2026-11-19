"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { incomeType, INCOME_TYPES, NO_DEDUCTIONS, readDeductions, type Deductions, type IncomeType } from "@/lib/tax";
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
  if (!(Number.isInteger(year) && year >= 2000 && year <= 2100)) return { error: "เลือกปีภาษี" };
  if (!name || name.length > 80) return { error: "ตั้งชื่อแผน ไม่เกิน 80 ตัวอักษร" };
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
  if (!rowCount) return { error: "ไม่พบแผนนี้แล้ว" };
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
       SELECT user_id, year, left(name || ' (สำเนา)', 80), deductions, notes FROM tax_plans WHERE id = $1 AND user_id = $2 RETURNING id`,
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
  if (!INCOME_TYPES.some((t) => t.id === type)) return { error: "เลือกประเภทเงินได้" };
  const t = incomeType(type);
  const name = String(form.get("name") ?? "").trim() || t.label;
  const amount = num(form.get("amount"));
  const withheld = num(form.get("withheld"));
  const kindRaw = String(form.get("kind") ?? "");
  const kind = t.kinds ? (t.kinds.some((k) => k.id === kindRaw) ? kindRaw : t.kinds[0].id) : null;
  const useActual = t.actual && form.get("expense_mode") === "actual";
  const actualExpense = useActual ? num(form.get("actual_expense")) : null;
  const separate = type === "40_4" && form.get("separate") === "on";
  if (name.length > 80) return { error: "ชื่อต้องไม่เกิน 80 ตัวอักษร" };
  if (!(amount > 0)) return { error: "กรอกเงินได้ทั้งปี มากกว่าศูนย์" };
  if (!(withheld >= 0)) return { error: "ภาษีหัก ณ ที่จ่ายต้องไม่ติดลบ" };
  if (actualExpense !== null && !(actualExpense >= 0)) return { error: "ค่าใช้จ่ายจริงต้องไม่ติดลบ" };
  return { type, name, amount, kind, actualExpense, withheld, separate };
}

export async function addTaxIncome(planId: number, _: TaxState, form: FormData): Promise<TaxState> {
  const user = await requireUser();
  if (!(await ownPlan(user.id, planId))) return { error: "ไม่พบแผนนี้แล้ว" };
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
  if (!rows[0]) return { error: "ไม่พบเงินได้นี้แล้ว" };
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

/**
 * Saves every deduction of the plan at once, as the page autosaves while you type. Amounts below zero or counts
 * that aren't whole are refused; `readDeductions` drops anything else that isn't a deduction.
 */
export async function saveTaxDeductionValues(planId: number, values: Deductions): Promise<TaxState> {
  const user = await requireUser();
  const raw = (values ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(NO_DEDUCTIONS)) {
    if (k === "spouse") continue;
    const n = Number(raw[k] ?? 0);
    if (!(n >= 0)) return { error: "ทุกจำนวนต้องไม่ติดลบ" };
    if (["childrenBefore2018", "childrenFrom2018", "parents", "disabled"].includes(k) && !Number.isInteger(n)) return { error: "จำนวนคนต้องเป็นจำนวนเต็ม" };
  }
  if (Number(raw.parents ?? 0) > 4) return { error: "บิดามารดาได้สูงสุด 4 คน (ของตนเองและคู่สมรส)" };
  const d = readDeductions(raw);
  const { rowCount } = await pool.query("UPDATE tax_plans SET deductions = $3 WHERE id = $1 AND user_id = $2", [planId, user.id, JSON.stringify(d)]);
  if (!rowCount) return { error: "ไม่พบแผนนี้แล้ว" };
  revalidatePath("/tax");
  return { saved: true };
}

/** Saves the amounts of one income as they are typed in its row (its type and name change in the edit dialog). */
export async function saveTaxIncomeValues(incomeId: number, v: { amount: number; withheld: number; actualExpense: number | null }): Promise<TaxState> {
  const user = await requireUser();
  const amount = Number(v?.amount);
  const withheld = Number(v?.withheld);
  const actual = v?.actualExpense === null || v?.actualExpense === undefined ? null : Number(v.actualExpense);
  if (!(amount >= 0) || !(withheld >= 0) || (actual !== null && !(actual >= 0))) return { error: "จำนวนเงินต้องไม่ติดลบ" };
  const { rowCount } = await pool.query(
    `UPDATE tax_incomes t SET amount = $3, withheld = $4,
       actual_expense = CASE WHEN t.actual_expense IS NULL THEN NULL ELSE $5::numeric END
     FROM tax_plans p WHERE t.id = $1 AND p.id = t.plan_id AND p.user_id = $2`,
    [incomeId, user.id, amount, withheld, actual ?? 0],
  );
  if (!rowCount) return { error: "ไม่พบเงินได้นี้แล้ว" };
  revalidatePath("/tax");
  return { saved: true };
}

export async function updateTaxNotes(planId: number, _: TaxState, form: FormData): Promise<TaxState> {
  const user = await requireUser();
  const notes = String(form.get("notes") ?? "").replace(/\r\n/g, "\n").trim();
  if (notes.length > 20_000) return { error: "บันทึกได้ไม่เกิน 20,000 ตัวอักษร" };
  const { rowCount } = await pool.query("UPDATE tax_plans SET notes = $3 WHERE id = $1 AND user_id = $2", [planId, user.id, notes || null]);
  if (!rowCount) return { error: "ไม่พบแผนนี้แล้ว" };
  revalidatePath(`/tax/${planId}`);
}
