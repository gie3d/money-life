"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getAccount, listAccounts, listEntries, listPrices, listTradeParts, listTrades } from "@/lib/data";
import { deriveTrades, replay, TRANSFER_ID_BASE } from "@/lib/investment";
import { money } from "@/lib/format";
import { holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { HEX, isInvestment, LIQUIDITY, TYPES, type Total, type Trade, type Transfer } from "@/lib/types";
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

/**
 * Records a balance. "balance" sets the total on that day. "deposit" and "withdraw" take an amount instead: the new
 * total is the balance as of that day plus or minus it, and the amount is kept as money paid in or taken out, so it
 * isn't read as a gain or a loss. One snapshot per asset per day: entering the same day again corrects it, and
 * deposits on the same day add up. Balances recorded after the date are left as they were recorded.
 */
export async function addEntry(accountId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const account = await getAccount(user.id, accountId);
  if (!account || isInvestment(account)) return { error: "That asset no longer exists." };

  const mode = String(form.get("mode") ?? "balance");
  const date = String(form.get("date") ?? "");
  const amount = num(form.get("value"));
  const note = String(form.get("note") ?? "").trim() || null;
  if (!isDate(date)) return { error: "Pick a date." };

  if (mode === "deposit" || mode === "withdraw") {
    if (!(amount > 0)) return { error: `Enter how much you ${mode === "deposit" ? "put in" : "took out"}, more than zero.` };
    const { rows } = await pool.query("SELECT value FROM entries WHERE account_id = $1 AND date <= $2 ORDER BY date DESC LIMIT 1", [accountId, date]);
    const before = rows[0] ? Number(rows[0].value) : 0;
    const delta = mode === "deposit" ? amount : -amount;
    if (before + delta < -0.005) return { error: `You can't take out more than the balance on that date (${money(before, user.currency)}).` };
    await pool.query(
      `INSERT INTO entries (account_id, date, value, contribution, note) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (account_id, date) DO UPDATE SET value = $3, contribution = entries.contribution + $4, note = COALESCE($5, entries.note)`,
      [accountId, date, Math.max(0, before + delta), delta, note],
    );
    revalidatePath("/", "layout");
    return;
  }

  if (!Number.isFinite(amount) || amount < 0) return { error: "Enter the balance on that date." };
  await pool.query(
    `INSERT INTO entries (account_id, date, value, note) VALUES ($1, $2, $3, $4)
     ON CONFLICT (account_id, date) DO UPDATE SET value = $3, note = $4`,
    [accountId, date, amount, note],
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

/**
 * Renames an asset and changes its category and liquidity. Once it has records, its category can only change to
 * one tracked the same way (investment or balance), or those records would no longer be shown or counted.
 */
export async function updateAccount(accountId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const account = await getAccount(user.id, accountId);
  if (!account) return { error: "That asset no longer exists." };
  const name = String(form.get("name") ?? "").trim();
  const categoryId = Number(form.get("category"));
  const liquidity = String(form.get("liquidity") ?? "");
  if (!name) return { error: "Give the asset a name." };
  const { rows: cats } = await pool.query("SELECT type FROM categories WHERE id = $1 AND user_id = $2", [categoryId, user.id]);
  if (!cats[0]) return { error: "Pick a category from the list." };
  if (!LIQUIDITY.some((l) => l.id === liquidity)) return { error: "Pick how liquid it is." };
  if (isInvestment({ type: cats[0].type }) !== isInvestment(account) && (await hasRecords(accountId))) {
    return { error: isInvestment(account)
      ? "This asset has trades, so it has to stay in an investment category."
      : "This asset has balances, so it has to stay in a cash or saving category." };
  }

  await pool.query("UPDATE accounts SET name = $3, category_id = $4, liquidity = $5 WHERE id = $1 AND user_id = $2", [accountId, user.id, name, categoryId, liquidity]);
  revalidatePath("/", "layout");
}

/** True if anything has been recorded for the asset: balances, trades, totals, transfers or prices. */
async function hasRecords(accountId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM entries WHERE account_id = $1) OR EXISTS (SELECT 1 FROM transactions WHERE account_id = $1)
         OR EXISTS (SELECT 1 FROM totals WHERE account_id = $1) OR EXISTS (SELECT 1 FROM prices WHERE account_id = $1)
         OR EXISTS (SELECT 1 FROM transfers WHERE from_account_id = $1 OR to_account_id = $1) AS any`,
    [accountId],
  );
  return rows[0].any as boolean;
}

/** Saves the free-text notes of an asset; empty clears them. */
export async function updateNotes(accountId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const notes = String(form.get("notes") ?? "").replace(/\r\n/g, "\n").trim();
  if (notes.length > 20_000) return { error: "Notes can be up to 20,000 characters." };
  const { rowCount } = await pool.query("UPDATE accounts SET notes = $3 WHERE id = $1 AND user_id = $2", [accountId, user.id, notes || null]);
  if (!rowCount) return { error: "That asset no longer exists." };
  revalidatePath(`/accounts/${accountId}`);
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

type TotalInput = Omit<Total, "id" | "accountId">;

/** Reads and checks the fields of a "Total" entry: units held, what they cost in all, and the price of one unit. */
function readTotal(form: FormData): TotalInput | { error: string } {
  const date = String(form.get("date") ?? "");
  const units = num(form.get("units"));
  const cost = num(form.get("cost"));
  const price = num(form.get("price"));
  const note = String(form.get("note") ?? "").trim() || null;
  if (!isDate(date)) return { error: "Pick a date." };
  if (!(units >= 0)) return { error: "Enter how many units you hold, zero or more." };
  if (!(cost >= 0)) return { error: "Enter what the units you hold cost in all, zero or more." };
  if (!(price >= 0)) return { error: "Enter the current price of one unit." };
  return { date, units, cost, price, note };
}

type Parts = Awaited<ReturnType<typeof listTradeParts>>;

/**
 * True if, with the given changes, no asset ever sells or sends more units than it holds. Every asset is
 * checked, since a transfer ties two together: shrinking a purchase on one can break a transfer out of it.
 */
function consistent(p: Parts, change: Partial<Pick<Parts, "trades" | "totals" | "transfers">>): boolean {
  const all = deriveTrades(change.trades ?? p.trades, change.totals ?? p.totals, change.transfers ?? p.transfers, p.prices);
  return [...new Set(all.map((t) => t.accountId))].every((id) => replay(all.filter((t) => t.accountId === id)).ok);
}
const TOO_MUCH = "That would leave a later sale or transfer taking more units than were held at its date.";

type TransferInput = Omit<Transfer, "id" | "fromAccountId">;

/** Reads and checks the fields of a transfer: where the units go, how many, and any fee in units. */
async function readTransfer(userId: number, fromAccountId: number, form: FormData): Promise<TransferInput | { error: string }> {
  const date = String(form.get("date") ?? "");
  const toAccountId = Number(form.get("to"));
  const units = num(form.get("units"));
  const fee = form.get("fee") === "" ? 0 : num(form.get("fee"));
  const note = String(form.get("note") ?? "").trim() || null;
  if (!isDate(date)) return { error: "Pick a date." };
  if (toAccountId === fromAccountId || !(await investmentOf(userId, toAccountId))) return { error: "Pick another investment to send the units to." };
  if (!(units > 0)) return { error: "Enter how many units arrive, more than zero." };
  if (!(fee >= 0)) return { error: "The fee must be zero or more units, or left empty." };
  return { date, toAccountId, units, fee, note };
}

export async function addTrade(accountId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await investmentOf(user.id, accountId))) return { error: "That asset no longer exists." };
  const p = await listTradeParts(user.id);

  if (form.get("side") === "transfer") {
    const x = await readTransfer(user.id, accountId, form);
    if ("error" in x) return x;
    if (!consistent(p, { transfers: [...p.transfers, { ...x, id: TRANSFER_ID_BASE - 1, fromAccountId: accountId }] })) {
      return { error: "You can't send more units than you held at that date (the fee included)." };
    }
    await pool.query(
      "INSERT INTO transfers (from_account_id, to_account_id, date, units, fee, note) VALUES ($1, $2, $3, $4, $5, $6)",
      [accountId, x.toAccountId, x.date, x.units, x.fee, x.note],
    );
    revalidatePath("/", "layout");
    return;
  }

  if (form.get("side") === "total") {
    const s = readTotal(form);
    if ("error" in s) return s;
    // One total per day: entering the same day again replaces it.
    const others = p.totals.filter((x) => !(x.accountId === accountId && x.date === s.date));
    if (!consistent(p, { totals: [...others, { ...s, id: 0, accountId }] })) return { error: TOO_MUCH };
    await pool.query(
      `INSERT INTO totals (account_id, date, units, cost, price, note) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (account_id, date) DO UPDATE SET units = $3, cost = $4, price = $5, note = $6`,
      [accountId, s.date, s.units, s.cost, s.price, s.note],
    );
    revalidatePath("/", "layout");
    return;
  }

  const t = readTrade(form);
  if ("error" in t) return t;
  // A sale cannot take out more than was held on that day, or the position would go negative.
  // The new trade sorts before any transfer or total of the same day, as a saved one would.
  if (!consistent(p, { trades: [...p.trades, { ...t, id: TRANSFER_ID_BASE - 1, accountId }] })) {
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
  const p = await listTradeParts(user.id);
  if (!p.trades.some((x) => x.id === tradeId && x.accountId === accountId)) return { error: "That trade no longer exists." };
  const t = readTrade(form);
  if ("error" in t) return t;

  // The edited trade may move or shrink a purchase that later sales or transfers rely on, or grow a sale too far.
  if (!consistent(p, { trades: p.trades.map((x) => (x.id === tradeId ? { ...x, ...t } : x)) })) return { error: TOO_MUCH };

  await pool.query(
    `UPDATE transactions t SET date = $3, side = $4, quantity = $5, price = $6, fee = $7, note = $8
     FROM accounts a WHERE t.id = $1 AND a.id = t.account_id AND a.user_id = $2`,
    [tradeId, user.id, t.date, t.side, t.quantity, t.price, t.fee, t.note],
  );
  revalidatePath("/", "layout");
}

export async function deleteTrade(accountId: number, tradeId: number, _: FormState): Promise<FormState> {
  const user = await requireUser();
  const p = await listTradeParts(user.id);
  // Removing a buy can leave a later sale or transfer with nothing to take.
  if (!consistent(p, { trades: p.trades.filter((t) => t.id !== tradeId) })) return { error: "Delete the later sales or transfers first: they depend on this purchase." };
  await pool.query(
    "DELETE FROM transactions t USING accounts a WHERE t.id = $1 AND a.id = t.account_id AND a.user_id = $2",
    [tradeId, user.id],
  );
  revalidatePath("/", "layout");
}

export async function updateTotal(accountId: number, totalId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = await listTradeParts(user.id);
  if (!p.totals.some((x) => x.id === totalId && x.accountId === accountId)) return { error: "That total no longer exists." };
  const s = readTotal(form);
  if ("error" in s) return s;
  if (p.totals.some((x) => x.id !== totalId && x.accountId === accountId && x.date === s.date)) return { error: "There is already a total on that date. Edit that one instead." };
  if (!consistent(p, { totals: p.totals.map((x) => (x.id === totalId ? { ...x, ...s } : x)) })) return { error: TOO_MUCH };

  await pool.query(
    `UPDATE totals s SET date = $3, units = $4, cost = $5, price = $6, note = $7
     FROM accounts a WHERE s.id = $1 AND a.id = s.account_id AND a.user_id = $2`,
    [totalId, user.id, s.date, s.units, s.cost, s.price, s.note],
  );
  revalidatePath("/", "layout");
}

export async function deleteTotal(accountId: number, totalId: number, _: FormState): Promise<FormState> {
  const user = await requireUser();
  const p = await listTradeParts(user.id);
  if (!consistent(p, { totals: p.totals.filter((x) => x.id !== totalId) })) return { error: TOO_MUCH };
  await pool.query("DELETE FROM totals s USING accounts a WHERE s.id = $1 AND a.id = s.account_id AND a.user_id = $2", [totalId, user.id]);
  revalidatePath("/", "layout");
}

/** Changes a transfer. It can be edited from either asset; the sender stays the asset it was sent from. */
export async function updateTransfer(transferId: number, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = await listTradeParts(user.id);
  const old = p.transfers.find((x) => x.id === transferId);
  if (!old) return { error: "That transfer no longer exists." };
  const x = await readTransfer(user.id, old.fromAccountId, form);
  if ("error" in x) return x;
  if (!consistent(p, { transfers: p.transfers.map((y) => (y.id === transferId ? { ...y, ...x } : y)) })) {
    return { error: "That would send more units than were held, or leave a later sale or transfer short." };
  }
  await pool.query(
    `UPDATE transfers x SET to_account_id = $3, date = $4, units = $5, fee = $6, note = $7
     FROM accounts a WHERE x.id = $1 AND a.id = x.from_account_id AND a.user_id = $2`,
    [transferId, user.id, x.toAccountId, x.date, x.units, x.fee, x.note],
  );
  revalidatePath("/", "layout");
}

export async function deleteTransfer(transferId: number, _: FormState): Promise<FormState> {
  const user = await requireUser();
  const p = await listTradeParts(user.id);
  // The receiver may already have sold or sent on the units that arrived.
  if (!consistent(p, { transfers: p.transfers.filter((x) => x.id !== transferId) })) {
    return { error: "The receiving asset has since sold or sent on these units. Change those first." };
  }
  await pool.query("DELETE FROM transfers x USING accounts a WHERE x.id = $1 AND a.id = x.from_account_id AND a.user_id = $2", [transferId, user.id]);
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
