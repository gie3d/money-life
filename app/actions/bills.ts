"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { EVERY } from "@/lib/bills";
import type { FormState } from "./auth";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/,/g, "").trim();
  return s === "" ? NaN : Number(s);
};
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

/** Reads and checks a bill's fields. The asset it's paid from must be the user's own. */
async function readBill(userId: number, form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const amount = num(form.get("amount"));
  const everyMonths = Number(form.get("every"));
  const firstDue = String(form.get("first_due") ?? "");
  const endDate = String(form.get("end_date") ?? "").trim() || null;
  const group = String(form.get("group") ?? "").trim() || "Other";
  const accountRaw = String(form.get("account") ?? "");
  const accountId = accountRaw === "" ? null : Number(accountRaw);
  const note = String(form.get("note") ?? "").trim() || null;

  if (!name) return { error: "Give the bill a name." };
  if (!(amount >= 0)) return { error: "Enter the amount of each payment." };
  if (!EVERY.some((e) => e.id === everyMonths)) return { error: "Pick how often it is paid." };
  if (!isDate(firstDue)) return { error: "Pick the date of a payment." };
  if (endDate !== null && (!isDate(endDate) || endDate < firstDue)) return { error: "The end date must be on or after the first payment." };
  if (accountId !== null) {
    const { rowCount } = await pool.query("SELECT 1 FROM accounts WHERE id = $1 AND user_id = $2", [accountId, userId]);
    if (!rowCount) return { error: "Pick an asset from the list, or none." };
  }
  return { name, amount, everyMonths, firstDue, endDate, group: group.slice(0, 60), accountId, note };
}

export async function createBill(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const b = await readBill(user.id, form);
  if ("error" in b) return b;
  await pool.query(
    `INSERT INTO bills (user_id, name, amount, every_months, first_due, end_date, group_name, account_id, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [user.id, b.name, b.amount, b.everyMonths, b.firstDue, b.endDate, b.group, b.accountId, b.note],
  );
  revalidatePath("/bills");
}

export async function updateBill(billId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const b = await readBill(user.id, form);
  if ("error" in b) return b;
  const { rowCount } = await pool.query(
    `UPDATE bills SET name = $3, amount = $4, every_months = $5, first_due = $6, end_date = $7, group_name = $8, account_id = $9, note = $10
     WHERE id = $1 AND user_id = $2`,
    [billId, user.id, b.name, b.amount, b.everyMonths, b.firstDue, b.endDate, b.group, b.accountId, b.note],
  );
  if (!rowCount) return { error: "That bill no longer exists." };
  revalidatePath("/bills");
}

export async function deleteBill(billId: number) {
  const user = await requireUser();
  await pool.query("DELETE FROM bills WHERE id = $1 AND user_id = $2", [billId, user.id]);
  revalidatePath("/bills");
}

/**
 * Saves the what-if for every bill at once: `plan-<id>` a planned amount (empty keeps the current one) and
 * `keep-<id>` present when the bill stays in. Only the plan columns change; the bills themselves don't.
 */
export async function saveBillPlan(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const { rows } = await pool.query("SELECT id, amount FROM bills WHERE user_id = $1", [user.id]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of rows) {
      const id = Number(r.id);
      const raw = String(form.get(`plan-${id}`) ?? "").trim();
      const planned = raw === "" ? null : num(raw);
      if (planned !== null && !(planned >= 0)) {
        await client.query("ROLLBACK");
        return { error: "Planned amounts must be zero or more, or left empty." };
      }
      // A planned amount equal to the current one is no change.
      const amount = planned !== null && Math.abs(planned - Number(r.amount)) < 0.005 ? null : planned;
      await client.query("UPDATE bills SET plan_amount = $2, plan_drop = $3 WHERE id = $1", [id, amount, form.get(`keep-${id}`) === null]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  revalidatePath("/bills");
}

/** Clears the what-if: every bill back to its current amount and kept. */
export async function resetBillPlan() {
  const user = await requireUser();
  await pool.query("UPDATE bills SET plan_amount = NULL, plan_drop = false WHERE user_id = $1", [user.id]);
  revalidatePath("/bills");
}
