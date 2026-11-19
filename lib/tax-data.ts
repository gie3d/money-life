import "server-only";
import { pool } from "./db";
import { readDeductions, type Deductions, type IncomeType, type TaxIncome } from "./tax";

export type TaxPlan = { id: number; year: number; name: string; deductions: Deductions; notes: string | null };

const plan = (r: Record<string, unknown>): TaxPlan => ({
  id: Number(r.id), year: Number(r.year), name: String(r.name), deductions: readDeductions(r.deductions), notes: (r.notes as string | null) ?? null,
});
const income = (r: Record<string, unknown>): TaxIncome & { planId: number } => ({
  id: Number(r.id), planId: Number(r.plan_id), type: r.type as IncomeType, name: String(r.name), amount: Number(r.amount),
  kind: (r.kind as string | null) ?? null, actualExpense: r.actual_expense === null ? null : Number(r.actual_expense),
  withheld: Number(r.withheld), separate: Boolean(r.separate),
});

/** Newest year first; within a year, oldest plan first. */
export async function listTaxPlans(userId: number): Promise<TaxPlan[]> {
  const { rows } = await pool.query("SELECT * FROM tax_plans WHERE user_id = $1 ORDER BY year DESC, id", [userId]);
  return rows.map(plan);
}

export async function getTaxPlan(userId: number, id: number): Promise<TaxPlan | null> {
  const { rows } = await pool.query("SELECT * FROM tax_plans WHERE id = $1 AND user_id = $2", [id, userId]);
  return rows[0] ? plan(rows[0]) : null;
}

/** The incomes of one plan, or of all the user's plans. */
export async function listTaxIncomes(userId: number, planId?: number) {
  const { rows } = await pool.query(
    `SELECT i.* FROM tax_incomes i JOIN tax_plans p ON p.id = i.plan_id
     WHERE p.user_id = $1 AND ($2::bigint IS NULL OR p.id = $2) ORDER BY i.type, i.id`,
    [userId, planId ?? null],
  );
  return rows.map(income);
}
