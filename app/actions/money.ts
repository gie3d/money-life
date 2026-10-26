"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getAccount, listAccounts, listEntries, listPrices, listTrades } from "@/lib/data";
import { replay } from "@/lib/investment";
import { holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { HEX, isInvestment, LIQUIDITY, TYPES, type Trade } from "@/lib/types";
import type { FormState } from "./auth";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/,/g, "").trim();
  return s === "" ? NaN : Number(s);
};

export async function createAccount(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  const categoryId = Number(form.get("category"));
  const liquidity = String(form.get("liquidity") ?? "");
  if (!name) return { error: "Give the asset a name." };
  const owned = await pool.query("SELECT 1 FROM categories WHERE id = $1 AND user_id = $2", [categoryId, user.id]);
  if (!owned.rowCount) return { error: "Pick a category from the list." };
  if (!LIQUIDITY.some((l) => l.id === liquidity)) return { error: "Pick how liquid it is." };

  const { rows } = await pool.query(
    "INSERT INTO accounts (user_id, name, category_id, liquidity) VALUES ($1, $2, $3, $4) RETURNING id",
    [user.id, name, categoryId, liquidity],
  );
  revalidatePath("/", "layout");
  redirect(`/accounts/${rows[0].id}`);
}

export async function addEntry(accountId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const account = await getAccount(user.id, accountId);
  if (!account || isInvestment(account)) return { error: "That asset no longer exists." };

  const date = String(form.get("date") ?? "");
  const value = num(form.get("value"));
  const note = String(form.get("note") ?? "").trim() || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return { error: "Pick a date." };
  if (!Number.isFinite(value) || value < 0) return { error: "Enter the balance on that date." };

  // One snapshot per asset per day: entering the same day again corrects it.
  await pool.query(
    `INSERT INTO entries (account_id, date, value, note) VALUES ($1, $2, $3, $4)
     ON CONFLICT (account_id, date) DO UPDATE SET value = $3, note = $4`,
    [accountId, date, value, note],
  );
  revalidatePath("/", "layout");
}

export async function deleteEntry(entryId: number) {
  const user = await requireUser();
  await pool.query(
    "DELETE FROM entries e USING accounts a WHERE e.id = $1 AND a.id = e.account_id AND a.user_id = $2",
    [entryId, user.id],
  );
  revalidatePath("/", "layout");
}

export async function setArchived(accountId: number, archived: boolean) {
  const user = await requireUser();
  await pool.query("UPDATE accounts SET archived = $3 WHERE id = $1 AND user_id = $2", [accountId, user.id, archived]);
  revalidatePath("/", "layout");
}

export async function deleteAccount(accountId: number) {
  const user = await requireUser();
  await pool.query("DELETE FROM accounts WHERE id = $1 AND user_id = $2", [accountId, user.id]);
  revalidatePath("/", "layout");
  redirect("/accounts");
}

export async function createCategory(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const type = String(form.get("type") ?? "");
  if (!name) return { error: "Give the category a name." };
  if (name.length > 40) return { error: "Keep it under 40 characters." };
  const color = String(form.get("color") ?? "");
  if (!TYPES.some((t) => t.id === type)) return { error: "Pick a type from the list." };
  if (!HEX.test(color)) return { error: "Pick a colour." };

  const { rowCount } = await pool.query(
    "INSERT INTO categories (user_id, name, type, color) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
    [user.id, name, type, color.toLowerCase()],
  );
  if (!rowCount) return { error: "You already have a category with that name." };
  revalidatePath("/", "layout");
}

export async function renameCategory(categoryId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 40) return { error: "Use 1 to 40 characters." };
  try {
    await pool.query("UPDATE categories SET name = $3 WHERE id = $1 AND user_id = $2", [categoryId, user.id, name]);
  } catch {
    return { error: "You already have a category with that name." };
  }
  revalidatePath("/", "layout");
}

export async function deleteCategory(categoryId: number) {
  const user = await requireUser();
  // Refuses while any asset uses it (the foreign key is RESTRICT); the UI hides the button then.
  await pool.query(
    "DELETE FROM categories c WHERE c.id = $1 AND c.user_id = $2 AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.category_id = c.id)",
    [categoryId, user.id],
  );
  revalidatePath("/", "layout");
}

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

async function investmentOf(userId: number, accountId: number) {
  const account = await getAccount(userId, accountId);
  return account && isInvestment(account) ? account : null;
}

type TradeInput = Omit<Trade, "id" | "accountId">;

/** Reads and checks the trade fields of a form. */
function readTrade(form: FormData): TradeInput | { error: string } {
  const side = form.get("side") === "sell" ? "sell" : "buy";
  const date = String(form.get("date") ?? "");
  const quantity = num(form.get("quantity"));
  const price = num(form.get("price"));
  const fee = form.get("fee") === "" ? 0 : num(form.get("fee"));
  const note = String(form.get("note") ?? "").trim() || null;
  if (!isDate(date)) return { error: "Pick a date." };
  if (!(quantity > 0)) return { error: "Enter how many units, more than zero." };
  if (!(price >= 0)) return { error: "Enter the price of one unit." };
  if (!(fee >= 0)) return { error: "The fee must be zero or more, or left empty." };
  return { side, date, quantity, price, fee, note };
}

export async function addTrade(accountId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await investmentOf(user.id, accountId))) return { error: "That asset no longer exists." };
  const t = readTrade(form);
  if ("error" in t) return t;

  // A sale cannot take out more than was held on that day, or the position would go negative.
  if (!replay([...(await listTrades(user.id, accountId)), { ...t, id: Number.MAX_SAFE_INTEGER, accountId }]).ok) {
    return { error: "You can't sell more units than you held at that date." };
  }
  await pool.query(
    "INSERT INTO transactions (account_id, date, side, quantity, price, fee, note) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [accountId, t.date, t.side, t.quantity, t.price, t.fee, t.note],
  );
  revalidatePath("/", "layout");
}

export async function updateTrade(accountId: number, tradeId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const all = await listTrades(user.id, accountId);
  if (!all.some((x) => x.id === tradeId)) return { error: "That trade no longer exists." };
  const t = readTrade(form);
  if ("error" in t) return t;

  // The edited trade may move or shrink a purchase that later sales rely on, or grow a sale too far.
  const next = all.map((x) => (x.id === tradeId ? { ...x, ...t } : x));
  if (!replay(next).ok) return { error: "That would leave a sale selling more units than you held at that date." };

  await pool.query(
    `UPDATE transactions t SET date = $3, side = $4, quantity = $5, price = $6, fee = $7, note = $8
     FROM accounts a WHERE t.id = $1 AND a.id = t.account_id AND a.user_id = $2`,
    [tradeId, user.id, t.date, t.side, t.quantity, t.price, t.fee, t.note],
  );
  revalidatePath("/", "layout");
}

export async function deleteTrade(accountId: number, tradeId: number, _: FormState): Promise<FormState> {
  const user = await requireUser();
  const rest = (await listTrades(user.id, accountId)).filter((t) => t.id !== tradeId);
  // Removing a buy can leave a later sale with nothing to sell.
  if (!replay(rest).ok) return { error: "Delete the later sales first: they depend on this purchase." };
  await pool.query(
    "DELETE FROM transactions t USING accounts a WHERE t.id = $1 AND a.id = t.account_id AND a.user_id = $2",
    [tradeId, user.id],
  );
  revalidatePath("/", "layout");
}

export async function setPrice(accountId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await investmentOf(user.id, accountId))) return { error: "That asset no longer exists." };
  const date = String(form.get("date") ?? "");
  const price = num(form.get("price"));
  if (!isDate(date)) return { error: "Pick a date." };
  if (!(price >= 0)) return { error: "Enter the price of one unit." };

  await pool.query(
    "INSERT INTO prices (account_id, date, price) VALUES ($1, $2, $3) ON CONFLICT (account_id, date) DO UPDATE SET price = $3",
    [accountId, date, price],
  );
  revalidatePath("/", "layout");
}

export async function updatePrice(accountId: number, priceId: number | null, _: FormState, form: FormData): Promise<FormState> {
  // A price that came from a trade has no row of its own yet: saving it records one for that day.
  if (priceId === null) return setPrice(accountId, undefined, form);

  const user = await requireUser();
  if (!(await investmentOf(user.id, accountId))) return { error: "That asset no longer exists." };
  const date = String(form.get("date") ?? "");
  const price = num(form.get("price"));
  if (!isDate(date)) return { error: "Pick a date." };
  if (!(price >= 0)) return { error: "Enter the price of one unit." };

  try {
    const { rowCount } = await pool.query(
      "UPDATE prices p SET date = $3, price = $4 FROM accounts a WHERE p.id = $1 AND a.id = p.account_id AND a.user_id = $2",
      [priceId, user.id, date, price],
    );
    if (!rowCount) return { error: "That price no longer exists." };
  } catch (err) {
    // One price per day: moving this one onto a day that already has its own is refused.
    if ((err as { code?: string }).code === "23505") return { error: "A price is already recorded for that date. Edit that one instead." };
    throw err;
  }
  revalidatePath("/", "layout");
}

export async function deletePrice(priceId: number) {
  const user = await requireUser();
  await pool.query(
    "DELETE FROM prices p USING accounts a WHERE p.id = $1 AND a.id = p.account_id AND a.user_id = $2",
    [priceId, user.id],
  );
  revalidatePath("/", "layout");
}

export async function setCategoryColor(categoryId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const color = String(form.get("color") ?? "");
  if (!HEX.test(color)) return { error: "Pick a colour." };
  await pool.query("UPDATE categories SET color = $3 WHERE id = $1 AND user_id = $2", [categoryId, user.id, color.toLowerCase()]);
  revalidatePath("/", "layout");
}

/**
 * Brings every asset's current value up to date in one go, all on one date: a price per unit for an
 * investment, a balance for cash or saving. A field left as it was, or empty, changes nothing.
 */
export async function updateValues(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const date = String(form.get("date") ?? "");
  if (!isDate(date)) return { error: "Pick a date." };

  const accounts = await listAccounts(user.id);
  const known = holdings(accounts, await listEntries(user.id), await listTrades(user.id), await listPrices(user.id));
  const changes: { account: (typeof accounts)[number]; value: number }[] = [];

  for (const account of accounts) {
    const raw = form.get(`v-${account.id}`);
    if (raw === null || String(raw).trim() === "") continue;
    const value = num(raw);
    if (!(value >= 0)) return { error: `Check the value for ${account.name}.` };
    const h = known.find((x) => x.account.id === account.id);
    // Only a position with units can be priced; and an unchanged number needs no new record.
    if (isInvestment(account) && !h) continue;
    const current = isInvestment(account) ? h?.price : h?.value;
    if (current != null && Math.abs(value - current) < 1e-9) continue;
    changes.push({ account, value });
  }
  if (changes.length === 0) return { error: "Change at least one value first." };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const { account, value } of changes) {
      if (isInvestment(account)) {
        await client.query(
          "INSERT INTO prices (account_id, date, price) VALUES ($1, $2, $3) ON CONFLICT (account_id, date) DO UPDATE SET price = $3",
          [account.id, date, value],
        );
      } else {
        await client.query(
          "INSERT INTO entries (account_id, date, value) VALUES ($1, $2, $3) ON CONFLICT (account_id, date) DO UPDATE SET value = $3",
          [account.id, date, value],
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  revalidatePath("/", "layout");
}
