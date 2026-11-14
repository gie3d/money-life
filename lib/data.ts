import "server-only";
import { btcFx } from "./btc";
import { pool } from "./db";
import { convertTrades, deriveTrades } from "./investment";
import type { Account, Bill, Goal, GoalVersion, Category, Entry, Frequency, JournalEntry, Plan, PlanItem, PricePoint, MonthlyNote, MonthlySpending, Spending, SpendingCategory, Tier, Total, Trade, Transfer } from "./types";

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
  notes: (r.notes as string | null) ?? null,
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
    `SELECT a.id, a.name, a.category_id, c.name AS category_name, c.color AS category_color, c.type, a.liquidity, a.archived, a.notes
     FROM accounts a JOIN categories c ON c.id = a.category_id
     WHERE a.user_id = $1 ${includeArchived ? "" : "AND NOT a.archived"} ORDER BY a.created_at, a.id`,
    [userId],
  );
  return rows.map(toAccount);
}

export async function getAccount(userId: number, id: number): Promise<Account | null> {
  const { rows } = await pool.query(`SELECT a.id, a.name, a.category_id, c.name AS category_name, c.color AS category_color, c.type, a.liquidity, a.archived, a.notes
     FROM accounts a JOIN categories c ON c.id = a.category_id WHERE a.id = $1 AND a.user_id = $2`, [id, userId]);
  return rows[0] ? toAccount(rows[0]) : null;
}

/** Entries of the given accounts, oldest first. */
/** `fiat` skips the BTC conversion: amounts as recorded, for the pages where the user types prices and balances. */
export async function listEntries(userId: number, accountId?: number, fiat = false): Promise<Entry[]> {
  const { rows } = await pool.query(
    `SELECT ${ENTRY_COLS} FROM entries e JOIN accounts a ON a.id = e.account_id
     WHERE a.user_id = $1 ${accountId ? "AND a.id = $2" : ""} ORDER BY e.date, e.id`,
    accountId ? [userId, accountId] : [userId],
  );
  const fx = fiat ? null : await btcFx(userId);
  return rows.map(toEntry).map((e) => (fx ? { ...e, value: fx.at(e.value, e.date), contribution: fx.at(e.contribution, e.date) } : e));
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

/**
 * Trades of the given accounts, oldest first, including the ones worked out from "Total" entries and transfers.
 * Everything that values a holding reads this, so totals and transfers count everywhere. A transfer's cost comes
 * from the sending asset's history, so the user's trades are always worked out across all assets, then filtered.
 */
export async function listTrades(userId: number, accountId?: number, fiat = false): Promise<Trade[]> {
  // Worked out in the user's own currency, then shown in BTC: converting the entered figures first would make a
  // "Total"'s running cost move with the exchange rate (see convertTrades).
  const p = await listTradeParts(userId, true);
  const fx = fiat ? null : await btcFx(userId);
  const derived = deriveTrades(p.trades, p.totals, p.transfers, p.prices);
  const all = fx ? convertTrades(derived, fx.at, fx.pegged) : derived;
  return accountId ? all.filter((t) => t.accountId === accountId) : all;
}

/** Everything trades are worked out from, for all of the user's assets. */
export async function listTradeParts(userId: number, fiat = false) {
  const [trades, totals, transfers, prices] = await Promise.all([
    listEnteredTrades(userId, undefined, fiat), listTotals(userId, undefined, fiat), listTransfers(userId), listPrices(userId, undefined, fiat),
  ]);
  return { trades, totals, transfers, prices };
}

export async function listTransfers(userId: number): Promise<Transfer[]> {
  const { rows } = await pool.query(
    `SELECT x.id, x.from_account_id, x.to_account_id, x.date::text AS date, x.units, x.fee, x.note
     FROM transfers x JOIN accounts a ON a.id = x.from_account_id
     WHERE a.user_id = $1 ORDER BY x.date, x.id`,
    [userId],
  );
  return rows.map((r) => ({
    id: Number(r.id), fromAccountId: Number(r.from_account_id), toAccountId: Number(r.to_account_id), date: r.date as string,
    units: Number(r.units), fee: Number(r.fee), note: (r.note as string | null) ?? null,
  }));
}

export async function listTotals(userId: number, accountId?: number, fiat = false): Promise<Total[]> {
  const { rows } = await pool.query(
    `SELECT s.id, s.account_id, s.date::text AS date, s.units, s.cost, s.price, s.note
     FROM totals s JOIN accounts a ON a.id = s.account_id
     WHERE a.user_id = $1 ${accountId ? "AND a.id = $2" : ""} ORDER BY s.date`,
    accountId ? [userId, accountId] : [userId],
  );
  const fx = fiat ? null : await btcFx(userId);
  const at = (n: number, d: string) => (fx ? fx.at(n, d) : n);
  return rows.map((r) => ({
    id: Number(r.id), accountId: Number(r.account_id), date: r.date as string, units: Number(r.units),
    cost: at(Number(r.cost), r.date as string), price: fx?.pegged.has(Number(r.account_id)) ? 1 : at(Number(r.price), r.date as string), note: (r.note as string | null) ?? null,
  }));
}

/** Only the buys and sales entered as such, without the ones from totals. */
export async function listEnteredTrades(userId: number, accountId?: number, fiat = false): Promise<Trade[]> {
  const { rows } = await pool.query(
    `SELECT t.id, t.account_id, t.date::text AS date, t.side, t.quantity, t.price, t.fee, t.note
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.user_id = $1 ${accountId ? "AND a.id = $2" : ""} ORDER BY t.date, t.id`,
    accountId ? [userId, accountId] : [userId],
  );
  const fx = fiat ? null : await btcFx(userId);
  return rows.map(toTrade).map((t) => (fx ? { ...t, price: fx.pegged.has(t.accountId) ? 1 : fx.at(t.price, t.date), fee: fx.at(t.fee, t.date) } : t));
}

export async function listPrices(userId: number, accountId?: number, fiat = false): Promise<PricePoint[]> {
  const { rows } = await pool.query(
    `SELECT p.id, p.account_id, p.date::text AS date, p.price
     FROM prices p JOIN accounts a ON a.id = p.account_id
     WHERE a.user_id = $1 ${accountId ? "AND a.id = $2" : ""} ORDER BY p.date`,
    accountId ? [userId, accountId] : [userId],
  );
  const fx = fiat ? null : await btcFx(userId);
  return rows.map((r) => ({ id: Number(r.id), accountId: Number(r.account_id), date: r.date as string, price: fx ? (fx.pegged.has(Number(r.account_id)) ? 1 : fx.at(Number(r.price), r.date as string)) : Number(r.price) }));
}

const toPlan = (r: Record<string, unknown>): Plan => ({
  id: Number(r.id), name: r.name as string, monthlySaving: Number(r.monthly_saving), notes: (r.notes as string | null) ?? null,
  archived: r.archived as boolean,
});

export async function listPlans(userId: number): Promise<Plan[]> {
  const { rows } = await pool.query("SELECT id, name, monthly_saving, notes, archived FROM plans WHERE user_id = $1 ORDER BY created_at, id", [userId]);
  const fx = await btcFx(userId);
  return rows.map(toPlan).map((p) => (fx ? { ...p, monthlySaving: fx.now(p.monthlySaving) } : p));
}

export async function getPlan(userId: number, id: number): Promise<Plan | null> {
  const { rows } = await pool.query("SELECT id, name, monthly_saving, notes, archived FROM plans WHERE id = $1 AND user_id = $2", [id, userId]);
  const fx = await btcFx(userId);
  const plan = rows[0] ? toPlan(rows[0]) : null;
  return plan && fx ? { ...plan, monthlySaving: fx.now(plan.monthlySaving) } : plan;
}

/** The costs of one plan, or of all the user's plans. */
export async function listPlanItems(userId: number, planId?: number): Promise<PlanItem[]> {
  const { rows } = await pool.query(
    `SELECT i.id, i.plan_id, i.name, i.amount, i.frequency, i.start_date::text AS start_date, i.occurrences
     FROM plan_items i JOIN plans p ON p.id = i.plan_id
     WHERE p.user_id = $1 ${planId ? "AND p.id = $2" : ""} ORDER BY i.start_date, i.id`,
    planId ? [userId, planId] : [userId],
  );
  const fx = await btcFx(userId);
  return rows.map((r) => ({
    id: Number(r.id),
    planId: Number(r.plan_id),
    name: r.name as string,
    amount: fx ? fx.now(Number(r.amount)) : Number(r.amount),
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

/** The user's bills, by group then name. */
export async function listBills(userId: number): Promise<Bill[]> {
  const { rows } = await pool.query(
    `SELECT id, name, amount, every_months, first_due::text AS first_due, end_date::text AS end_date, group_name, account_id, note, plan_amount, plan_drop
     FROM bills WHERE user_id = $1 ORDER BY lower(group_name), lower(name), id`,
    [userId],
  );
  const fx = await btcFx(userId);
  const now = (n: number) => (fx ? fx.now(n) : n);
  return rows.map((r) => ({
    id: Number(r.id), name: r.name as string, amount: now(Number(r.amount)), everyMonths: Number(r.every_months),
    firstDue: r.first_due as string, endDate: (r.end_date as string | null) ?? null, group: r.group_name as string,
    accountId: r.account_id === null ? null : Number(r.account_id), note: (r.note as string | null) ?? null,
    planAmount: r.plan_amount === null ? null : now(Number(r.plan_amount)), planDrop: r.plan_drop as boolean,
  }));
}

/** The user's goals, oldest first, each with the assets that count towards it. */
export async function listGoals(userId: number): Promise<Goal[]> {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.kind, g.birth_date::text AS birth_date, g.retire_age, g.notes,
            COALESCE(array_agg(ga.account_id) FILTER (WHERE ga.account_id IS NOT NULL), '{}') AS account_ids
     FROM goals g LEFT JOIN goal_assets ga ON ga.goal_id = g.id
     WHERE g.user_id = $1 GROUP BY g.id ORDER BY g.created_at, g.id`,
    [userId],
  );
  return rows.map((r) => ({
    id: Number(r.id), name: r.name as string, kind: r.kind as Goal["kind"], birthDate: (r.birth_date as string | null) ?? null,
    retireAge: r.retire_age === null ? null : Number(r.retire_age), notes: (r.notes as string | null) ?? null,
    accountIds: (r.account_ids as (string | number)[]).map(Number),
  }));
}

/** Every plan version of the user's goals (or of one goal), oldest first; the last of a goal is its current plan. */
export async function listGoalVersions(userId: number, goalId?: number): Promise<GoalVersion[]> {
  const { rows } = await pool.query(
    `SELECT v.* , v.start_date::text AS start_date, v.target_date::text AS target_date, v.created_at::text AS created_at
     FROM goal_versions v JOIN goals g ON g.id = v.goal_id
     WHERE g.user_id = $1 ${goalId ? "AND g.id = $2" : ""} ORDER BY v.created_at, v.id`,
    goalId ? [userId, goalId] : [userId],
  );
  const fx = await btcFx(userId);
  // Where it started is what it was worth then; what it aims for and sets aside is counted at today's price.
  const now = (v: unknown) => (v === null ? null : fx ? fx.now(Number(v)) : Number(v));
  const then = (v: unknown, date: unknown) => (fx ? fx.at(Number(v), String(date)) : Number(v));
  const { rows: parts } = await pool.query(
    `SELECT a.version_id, a.account_id, a.start_value, a.expected_return, a.monthly_contribution
     FROM goal_version_assets a JOIN goal_versions v ON v.id = a.version_id JOIN goals g ON g.id = v.goal_id
     WHERE g.user_id = $1 ${goalId ? "AND g.id = $2" : ""} ORDER BY a.account_id`,
    goalId ? [userId, goalId] : [userId],
  );
  return rows.map((r) => ({
    id: Number(r.id), goalId: Number(r.goal_id), startDate: r.start_date as string, startValue: then(r.start_value, r.start_date),
    targetDate: r.target_date as string, targetMode: r.target_mode as GoalVersion["targetMode"], targetAmount: now(r.target_amount),
    monthlySpending: now(r.monthly_spending), withdrawalRate: Number(r.withdrawal_rate), expectedReturn: Number(r.expected_return),
    inflation: Number(r.inflation), monthlyContribution: now(r.monthly_contribution) ?? 0, contributionGrowth: Number(r.contribution_growth),
    note: (r.note as string | null) ?? null, createdAt: r.created_at as string,
    assets: parts.filter((a) => Number(a.version_id) === Number(r.id)).map((a) => ({
      accountId: Number(a.account_id), startValue: then(a.start_value, r.start_date), rate: Number(a.expected_return), monthly: now(a.monthly_contribution) ?? 0,
    })),
  }));
}

const toJournal = (r: Record<string, unknown>): JournalEntry => ({
  id: Number(r.id), date: r.entry_date as string, endDate: (r.end_date as string | null) ?? null, title: r.title as string, mood: (r.mood as string | null) ?? null, body: r.body as string,
  accountIds: ((r.account_ids as string[] | null) ?? []).map(Number),
});

const JOURNAL_SELECT = `SELECT e.id, e.entry_date::text AS entry_date, e.end_date::text AS end_date, e.title, e.mood, e.body,
  COALESCE(array_agg(ea.account_id ORDER BY ea.account_id) FILTER (WHERE ea.account_id IS NOT NULL), '{}') AS account_ids
  FROM journal_entries e LEFT JOIN journal_entry_assets ea ON ea.entry_id = e.id`;

/** The user's journal, newest first. */
export async function listJournal(userId: number): Promise<JournalEntry[]> {
  const { rows } = await pool.query(`${JOURNAL_SELECT} WHERE e.user_id = $1 GROUP BY e.id ORDER BY e.entry_date DESC, e.id DESC`, [userId]);
  return rows.map(toJournal);
}

export async function getJournalEntry(userId: number, id: number): Promise<JournalEntry | null> {
  const { rows } = await pool.query(`${JOURNAL_SELECT} WHERE e.id = $1 AND e.user_id = $2 GROUP BY e.id`, [id, userId]);
  return rows[0] ? toJournal(rows[0]) : null;
}

/** What the user has spent on hobbies, newest first. */
export async function listHobbySpending(userId: number): Promise<Spending[]> {
  const { rows } = await pool.query(
    `SELECT id, spent_on::text AS spent_on, amount, category, name, note FROM spendings
     WHERE user_id = $1 AND kind = 'hobby' ORDER BY spent_on DESC, id DESC`,
    [userId],
  );
  const fx = await btcFx(userId);
  return rows.map((r) => ({
    id: Number(r.id), date: r.spent_on as string, amount: fx ? fx.at(Number(r.amount), r.spent_on as string) : Number(r.amount), category: r.category as string, name: (r.name as string | null) ?? null,
    note: (r.note as string | null) ?? null,
  }));
}

/** The user's everyday categories in their own order, archived ones included. */
export async function listSpendingCategories(userId: number): Promise<SpendingCategory[]> {
  const { rows } = await pool.query(
    "SELECT id, name, position, archived, tier FROM spending_categories WHERE user_id = $1 ORDER BY position, id", [userId]);
  return rows.map((r) => ({ id: Number(r.id), name: r.name as string, position: Number(r.position), archived: r.archived as boolean, tier: (r.tier as Tier | null) ?? null }));
}

/** Every remark on an everyday category in a month. */
export async function listMonthlyNotes(userId: number): Promise<MonthlyNote[]> {
  const { rows } = await pool.query(
    `SELECT n.category_id, to_char(n.month, 'YYYY-MM') AS month, n.note
     FROM monthly_spending_notes n JOIN spending_categories c ON c.id = n.category_id WHERE c.user_id = $1`,
    [userId],
  );
  return rows.map((r) => ({ categoryId: Number(r.category_id), month: r.month as string, note: r.note as string }));
}

/** Every month's amount of every everyday category. */
export async function listMonthlySpending(userId: number): Promise<MonthlySpending[]> {
  const { rows } = await pool.query(
    `SELECT m.category_id, to_char(m.month, 'YYYY-MM') AS month, m.amount
     FROM monthly_spending m JOIN spending_categories c ON c.id = m.category_id WHERE c.user_id = $1 ORDER BY m.month`,
    [userId],
  );
  const fx = await btcFx(userId);
  return rows.map((r) => ({ categoryId: Number(r.category_id), month: r.month as string, amount: fx ? fx.at(Number(r.amount), `${r.month}-01`) : Number(r.amount) }));
}
