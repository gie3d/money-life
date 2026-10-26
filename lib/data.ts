import "server-only";
import { pool } from "./db";
import type { Account, Category, Entry, Frequency, Plan, PlanItem, PricePoint, Trade } from "./types";

/* Every query takes the user id and filters on it: an id in a URL or form is never trusted by itself. */

const toAccount = (r: Record<string, unknown>): Account => ({
  id: Number(r.id),
  name: r.name as string,
  categoryId: Number(r.category_id),
  categoryName: r.category_name as string,
  categoryColor: r.category_color as string,
  type: r.type as string,
  liquidity: r.liquidity as string,
  archived: r.archived as boolean,
});

const toEntry = (r: Record<string, unknown>): Entry => ({
  id: Number(r.id),
  accountId: Number(r.account_id),
  date: r.date as string,
  value: Number(r.value),
  contribution: Number(r.contribution),
  note: (r.note as string | null) ?? null,
});

// `date` is selected as text so the pg driver does not shift it through the server's timezone.
const ENTRY_COLS = "e.id, e.account_id, e.date::text AS date, e.value, e.contribution, e.note";

export async function listAccounts(userId: number, includeArchived = false): Promise<Account[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.name, a.category_id, c.name AS category_name, c.color AS category_color, c.type, a.liquidity, a.archived
     FROM accounts a JOIN categories c ON c.id = a.category_id
     WHERE a.user_id = $1 ${includeArchived ? "" : "AND NOT a.archived"} ORDER BY a.created_at, a.id`,
    [userId],
  );
  return rows.map(toAccount);
}

export async function getAccount(userId: number, id: number): Promise<Account | null> {
  const { rows } = await pool.query(`SELECT a.id, a.name, a.category_id, c.name AS category_name, c.color AS category_color, c.type, a.liquidity, a.archived
     FROM accounts a JOIN categories c ON c.id = a.category_id WHERE a.id = $1 AND a.user_id = $2`, [id, userId]);
  return rows[0] ? toAccount(rows[0]) : null;
}

/** Entries of the given accounts, oldest first. */
export async function listEntries(userId: number, accountId?: number): Promise<Entry[]> {
  const { rows } = await pool.query(
    `SELECT ${ENTRY_COLS} FROM entries e JOIN accounts a ON a.id = e.account_id
     WHERE a.user_id = $1 ${accountId ? "AND a.id = $2" : ""} ORDER BY e.date, e.id`,
    accountId ? [userId, accountId] : [userId],
  );
  return rows.map(toEntry);
}

export async function listCategories(userId: number): Promise<Category[]> {
  const { rows } = await pool.query("SELECT id, name, type, color FROM categories WHERE user_id = $1 ORDER BY lower(name), id", [userId]);
  return rows.map((r) => ({ id: Number(r.id), name: r.name as string, type: r.type as string, color: r.color as string }));
}

const toTrade = (r: Record<string, unknown>): Trade => ({
  id: Number(r.id),
  accountId: Number(r.account_id),
  date: r.date as string,
  side: r.side as "buy" | "sell",
  quantity: Number(r.quantity),
  price: Number(r.price),
  fee: Number(r.fee),
  note: (r.note as string | null) ?? null,
});

export async function listTrades(userId: number, accountId?: number): Promise<Trade[]> {
  const { rows } = await pool.query(
    `SELECT t.id, t.account_id, t.date::text AS date, t.side, t.quantity, t.price, t.fee, t.note
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.user_id = $1 ${accountId ? "AND a.id = $2" : ""} ORDER BY t.date, t.id`,
    accountId ? [userId, accountId] : [userId],
  );
  return rows.map(toTrade);
}

export async function listPrices(userId: number, accountId?: number): Promise<PricePoint[]> {
  const { rows } = await pool.query(
    `SELECT p.id, p.account_id, p.date::text AS date, p.price
     FROM prices p JOIN accounts a ON a.id = p.account_id
     WHERE a.user_id = $1 ${accountId ? "AND a.id = $2" : ""} ORDER BY p.date`,
    accountId ? [userId, accountId] : [userId],
  );
  return rows.map((r) => ({ id: Number(r.id), accountId: Number(r.account_id), date: r.date as string, price: Number(r.price) }));
}

const toPlan = (r: Record<string, unknown>): Plan => ({ id: Number(r.id), name: r.name as string, monthlySaving: Number(r.monthly_saving) });

export async function listPlans(userId: number): Promise<Plan[]> {
  const { rows } = await pool.query("SELECT id, name, monthly_saving FROM plans WHERE user_id = $1 ORDER BY created_at, id", [userId]);
  return rows.map(toPlan);
}

export async function getPlan(userId: number, id: number): Promise<Plan | null> {
  const { rows } = await pool.query("SELECT id, name, monthly_saving FROM plans WHERE id = $1 AND user_id = $2", [id, userId]);
  return rows[0] ? toPlan(rows[0]) : null;
}

/** The costs of one plan, or of all the user's plans. */
export async function listPlanItems(userId: number, planId?: number): Promise<PlanItem[]> {
  const { rows } = await pool.query(
    `SELECT i.id, i.plan_id, i.name, i.amount, i.frequency, i.start_date::text AS start_date, i.occurrences
     FROM plan_items i JOIN plans p ON p.id = i.plan_id
     WHERE p.user_id = $1 ${planId ? "AND p.id = $2" : ""} ORDER BY i.start_date, i.id`,
    planId ? [userId, planId] : [userId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    planId: Number(r.plan_id),
    name: r.name as string,
    amount: Number(r.amount),
    frequency: r.frequency as Frequency,
    startDate: r.start_date as string,
    occurrences: Number(r.occurrences),
  }));
}

/** Which assets pay for which plan: plan id to account ids. */
export async function listPlanAssets(userId: number): Promise<Map<number, number[]>> {
  const { rows } = await pool.query(
    "SELECT pa.plan_id, pa.account_id FROM plan_assets pa JOIN plans p ON p.id = pa.plan_id WHERE p.user_id = $1",
    [userId],
  );
  const out = new Map<number, number[]>();
  for (const r of rows) out.set(Number(r.plan_id), [...(out.get(Number(r.plan_id)) ?? []), Number(r.account_id)]);
  return out;
}
