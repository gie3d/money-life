"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { CURRENCIES, isInvestment, LIQUIDITY } from "@/lib/types";
import type { FormState } from "./auth";

/** One asset from the setup: a balance for cash and saving, or units at a price (and what they cost) for an investment. */
export type SetupAsset = {
  categoryId: number;
  name: string;
  liquidity: string;
  /** Cash and saving: the balance today. */
  balance?: string;
  /** Investments: units held today, the price of one now, and what they cost in total (the value, when left empty). */
  units?: string;
  price?: string;
  cost?: string;
};

const num = (v: string | undefined) => {
  const s = String(v ?? "").replace(/,/g, "").trim();
  return s === "" ? NaN : Number(s);
};

/**
 * Saves the first-run setup in one go: the currency (only while nothing is recorded, so amounts keep their meaning),
 * and each asset with what it is worth today. A balance is recorded as a balance; an investment as a "Total" entry,
 * the same as typing what a broker shows, so it can be corrected later like any other.
 */
export async function completeSetup(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const currency = String(form.get("currency") ?? user.currency);
  const next = String(form.get("next") ?? "home");
  let assets: SetupAsset[];
  try {
    assets = JSON.parse(String(form.get("assets") ?? "[]"));
    if (!Array.isArray(assets)) throw new Error();
  } catch {
    return { error: "Something went wrong reading the form. Please try again." };
  }
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { error: "Pick a currency from the list." };

  const { rows: cats } = await pool.query("SELECT id, type FROM categories WHERE user_id = $1", [user.id]);
  const typeOf = new Map<number, string>(cats.map((c) => [Number(c.id), String(c.type)]));
  const kept = assets.filter((a) => String(a.name ?? "").trim() !== "");
  if (kept.length === 0) return { error: "Add at least one asset with a name." };

  // Check every row before saving any.
  const ready: { categoryId: number; name: string; liquidity: string; investment: boolean; balance: number; units: number; price: number; cost: number }[] = [];
  for (const a of kept) {
    const name = String(a.name).trim().replace(/\s+/g, " ");
    const type = typeOf.get(Number(a.categoryId));
    if (!type) return { error: `Pick a category for ${name}.` };
    if (!LIQUIDITY.some((l) => l.id === a.liquidity)) return { error: `Pick how quickly ${name} turns into cash.` };
    if (isInvestment({ type })) {
      const units = num(a.units);
      const price = num(a.price);
      const cost = a.cost && a.cost.trim() !== "" ? num(a.cost) : units * price;
      if (!(units > 0)) return { error: `Enter how many units of ${name} you hold.` };
      if (!(price >= 0)) return { error: `Enter the price of one unit of ${name} today.` };
      if (!(cost >= 0)) return { error: `What you paid for ${name} must be zero or more, or left empty.` };
      ready.push({ categoryId: Number(a.categoryId), name, liquidity: a.liquidity, investment: true, balance: 0, units, price, cost });
    } else {
      const balance = num(a.balance);
      if (!(balance >= 0)) return { error: `Enter the balance of ${name} today.` };
      ready.push({ categoryId: Number(a.categoryId), name, liquidity: a.liquidity, investment: false, balance, units: 0, price: 0, cost: 0 });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (currency !== user.currency) {
      // Changing the currency later would relabel amounts already recorded, so only a fresh start can.
      const { rows } = await client.query("SELECT EXISTS (SELECT 1 FROM accounts WHERE user_id = $1) AS any", [user.id]);
      if (rows[0].any) {
        await client.query("ROLLBACK");
        return { error: "The currency can only be changed before anything is recorded." };
      }
      await client.query("UPDATE users SET currency = $2 WHERE id = $1", [user.id, currency]);
    }
    for (const a of ready) {
      const { rows } = await client.query(
        "INSERT INTO accounts (user_id, name, category_id, liquidity) VALUES ($1, $2, $3, $4) RETURNING id",
        [user.id, a.name, a.categoryId, a.liquidity],
      );
      const id = rows[0].id;
      if (a.investment) {
        await client.query("INSERT INTO totals (account_id, date, units, cost, price) VALUES ($1, $2, $3, $4, $5)", [id, today, a.units, a.cost, a.price]);
      } else {
        await client.query("INSERT INTO entries (account_id, date, value) VALUES ($1, $2, $3)", [id, today, a.balance]);
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  revalidatePath("/", "layout");
  redirect(next === "goal" ? "/goals/new" : "/");
}
