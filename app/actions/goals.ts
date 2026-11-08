"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { listAccounts, listEntries, listPrices, listTrades } from "@/lib/data";
import { valueOn } from "@/lib/goals";
import { addMonths } from "@/lib/plan";
import { accountEntries } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import type { FormState } from "./auth";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/,/g, "").trim();
  return s === "" ? NaN : Number(s);
};
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
/** A percentage field as a fraction: "6" is 0.06. */
const rate = (v: FormDataEntryValue | null) => num(v) / 100;

/** What the given assets were worth on a date, from the records as they stand. */
async function worthOn(userId: number, accountIds: number[], date: string): Promise<number> {
  const [accounts, entries, trades, prices] = await Promise.all([listAccounts(userId, true), listEntries(userId), listTrades(userId), listPrices(userId)]);
  const lists = accounts.filter((a) => accountIds.includes(a.id)).map((a) => accountEntries(a, entries, trades, prices));
  return valueOn(lists, date);
}

/** The ticked assets (`asset` fields), only the user's own. */
async function readAssets(userId: number, form: FormData): Promise<number[]> {
  const ids = form.getAll("asset").map(Number).filter(Number.isInteger);
  if (ids.length === 0) return [];
  const { rows } = await pool.query("SELECT id FROM accounts WHERE user_id = $1 AND id = ANY($2::bigint[])", [userId, ids]);
  return rows.map((r) => Number(r.id));
}

/** Reads a plan version's fields; the target date comes from the birth date and age for a retirement goal. */
function readPlan(form: FormData, kind: string) {
  const startDate = String(form.get("start_date") ?? "");
  let targetDate = String(form.get("target_date") ?? "");
  const birthDate = String(form.get("birth_date") ?? "");
  const retireAge = Number(form.get("retire_age"));
  if (kind === "retirement") {
    if (!isDate(birthDate)) return { error: "Pick your birth date." };
    if (!(retireAge >= 30 && retireAge <= 100)) return { error: "Enter the age you want to retire at, between 30 and 100." };
    targetDate = addMonths(birthDate, retireAge * 12);
  }
  const targetMode = form.get("target_mode") === "spending" ? "spending" : "amount";
  const targetAmount = num(form.get("target_amount"));
  const monthlySpending = num(form.get("monthly_spending"));
  const withdrawalRate = rate(form.get("withdrawal_rate"));
  const expectedReturn = rate(form.get("expected_return"));
  const inflation = form.get("inflation") === "" ? 0 : rate(form.get("inflation"));
  const monthlyContribution = form.get("monthly_contribution") === "" ? 0 : num(form.get("monthly_contribution"));
  const contributionGrowth = form.get("contribution_growth") === "" ? 0 : rate(form.get("contribution_growth"));
  const note = String(form.get("plan_note") ?? "").trim() || null;

  if (!isDate(startDate)) return { error: "Pick the date the plan starts from." };
  if (!isDate(targetDate)) return { error: "Pick the date of the goal." };
  if (targetDate <= startDate) return { error: "The goal's date must be after the plan starts." };
  if (targetMode === "amount" && !(targetAmount > 0)) return { error: "Enter the amount you want to have." };
  if (targetMode === "spending" && !(monthlySpending > 0)) return { error: "Enter how much you want to spend a month." };
  if (targetMode === "spending" && !(withdrawalRate > 0 && withdrawalRate <= 0.2)) return { error: "The withdrawal rate must be above 0% and at most 20%." };
  if (!(expectedReturn > -0.5 && expectedReturn < 0.5)) return { error: "Enter the yearly return you expect, as a percentage." };
  if (!(inflation >= 0 && inflation < 0.3)) return { error: "Inflation must be between 0% and 30%." };
  if (!(monthlyContribution >= 0)) return { error: "The monthly amount must be zero or more." };
  if (!(contributionGrowth >= 0 && contributionGrowth < 1)) return { error: "The yearly increase must be between 0% and 100%." };
  return {
    startDate, targetDate, targetMode, birthDate: kind === "retirement" ? birthDate : null, retireAge: kind === "retirement" ? retireAge : null,
    targetAmount: targetMode === "amount" ? targetAmount : null, monthlySpending: targetMode === "spending" ? monthlySpending : null,
    withdrawalRate: Number.isFinite(withdrawalRate) && withdrawalRate > 0 ? withdrawalRate : 0.04,
    expectedReturn, inflation, monthlyContribution, contributionGrowth, note,
  };
}
type PlanInput = Exclude<ReturnType<typeof readPlan>, { error: string }>;

async function insertVersion(goalId: number, p: PlanInput, startValue: number) {
  await pool.query(
    `INSERT INTO goal_versions (goal_id, start_date, start_value, target_date, target_mode, target_amount, monthly_spending,
       withdrawal_rate, expected_return, inflation, monthly_contribution, contribution_growth, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [goalId, p.startDate, startValue, p.targetDate, p.targetMode, p.targetAmount, p.monthlySpending, p.withdrawalRate,
      p.expectedReturn, p.inflation, p.monthlyContribution, p.contributionGrowth, p.note],
  );
}

export async function createGoal(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  const kind = form.get("kind") === "retirement" ? "retirement" : "other";
  if (!name) return { error: "Give the goal a name." };
  const p = readPlan(form, kind);
  if ("error" in p) return p;
  const assets = await readAssets(user.id, form);
  if (assets.length === 0) return { error: "Tick at least one asset that counts towards the goal." };

  const startValue = await worthOn(user.id, assets, p.startDate);
  const { rows } = await pool.query(
    "INSERT INTO goals (user_id, name, kind, birth_date, retire_age) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [user.id, name, kind, p.birthDate, p.retireAge],
  );
  const id = Number(rows[0].id);
  await pool.query("INSERT INTO goal_assets (goal_id, account_id) SELECT $1, unnest($2::bigint[])", [id, assets]);
  await insertVersion(id, p, startValue);
  revalidatePath("/goals");
  redirect(`/goals/${id}`);
}

/**
 * Revises the plan: a new version starting on its own start date, from what the assets were worth then. The earlier
 * versions stay, to compare against. The goal's name and assets can change at the same time.
 */
export async function reviseGoal(goalId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const { rows } = await pool.query("SELECT kind FROM goals WHERE id = $1 AND user_id = $2", [goalId, user.id]);
  if (!rows[0]) return { error: "That goal no longer exists." };
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Give the goal a name." };
  const p = readPlan(form, rows[0].kind);
  if ("error" in p) return p;
  const assets = await readAssets(user.id, form);
  if (assets.length === 0) return { error: "Tick at least one asset that counts towards the goal." };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE goals SET name = $2, birth_date = $3, retire_age = $4 WHERE id = $1", [goalId, name, p.birthDate, p.retireAge]);
    await client.query("DELETE FROM goal_assets WHERE goal_id = $1", [goalId]);
    await client.query("INSERT INTO goal_assets (goal_id, account_id) SELECT $1, unnest($2::bigint[])", [goalId, assets]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  await insertVersion(goalId, p, await worthOn(user.id, assets, p.startDate));
  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/goals");
  redirect(`/goals/${goalId}`);
}

/** Removes one earlier version of a plan; the current (latest) one can't be removed while it is the only one. */
export async function deleteGoalVersion(goalId: number, versionId: number) {
  const user = await requireUser();
  await pool.query(
    `DELETE FROM goal_versions v USING goals g
     WHERE v.id = $1 AND g.id = v.goal_id AND g.id = $2 AND g.user_id = $3
       AND (SELECT count(*) FROM goal_versions WHERE goal_id = $2) > 1`,
    [versionId, goalId, user.id],
  );
  revalidatePath(`/goals/${goalId}`);
}

export async function updateGoalNotes(goalId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const notes = String(form.get("notes") ?? "").replace(/\r\n/g, "\n").trim();
  if (notes.length > 20_000) return { error: "Notes can be up to 20,000 characters." };
  const { rowCount } = await pool.query("UPDATE goals SET notes = $3 WHERE id = $1 AND user_id = $2", [goalId, user.id, notes || null]);
  if (!rowCount) return { error: "That goal no longer exists." };
  revalidatePath(`/goals/${goalId}`);
}

export async function deleteGoal(goalId: number) {
  const user = await requireUser();
  await pool.query("DELETE FROM goals WHERE id = $1 AND user_id = $2", [goalId, user.id]);
  revalidatePath("/goals");
  redirect("/goals");
}
