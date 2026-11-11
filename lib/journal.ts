import "server-only";
import { listAccounts, listEntries, listPrices, listTrades } from "./data";
import { netWorthSeries } from "./performance";
import { accountEntries } from "./portfolio";

/**
 * What a journal entry says about money: how much the assets it mentions (everything, when it mentions none) were
 * worth on its date, from what was recorded by then, and a short name for which assets those are.
 */
export async function journalMoney(userId: number, today: string) {
  const [accounts, entries, trades, prices] = await Promise.all([listAccounts(userId, true), listEntries(userId), listTrades(userId), listPrices(userId)]);
  const lists = new Map(accounts.map((a) => [a.id, accountEntries(a, entries, trades, prices)]));
  const known = new Set(accounts.map((a) => a.id));
  return {
    names: (ids: number[]) => ids.filter((id) => known.has(id)).map((id) => accounts.find((a) => a.id === id)!.name),
    worth(date: string, ids: number[]): number | null {
      const chosen = (ids.length > 0 ? ids : accounts.map((a) => a.id)).filter((id) => known.has(id));
      return netWorthSeries(chosen.map((id) => lists.get(id)!), null, date <= today ? date : today).at(-1)?.value ?? null;
    },
  };
}
