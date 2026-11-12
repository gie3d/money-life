import "server-only";
import { listAccounts, listCategories, listEntries, listPrices, listTrades } from "./data";
import { sortByCategory } from "./group";
import { netWorthSeries } from "./performance";
import { accountEntries } from "./portfolio";

export type AssetThen = { id: number; name: string; categoryId: number; category: string; color: string; then: number | null; now: number | null };

/**
 * What a journal entry says about money: how much the assets it mentions (everything, when it mentions none or all
 * of them) were worth on its date, from what was recorded by then, and what they are worth today.
 */
export async function journalMoney(userId: number, today: string) {
  const [accounts, entries, trades, prices, categories] = await Promise.all([
    listAccounts(userId, true), listEntries(userId), listTrades(userId), listPrices(userId), listCategories(userId),
  ]);
  const lists = new Map(accounts.map((a) => [a.id, accountEntries(a, entries, trades, prices)]));
  const known = new Set(accounts.map((a) => a.id));
  const current = accounts.filter((a) => !a.archived).map((a) => a.id);
  const valueOn = (ids: number[], date: string) =>
    netWorthSeries(ids.map((id) => lists.get(id)!), null, date <= today ? date : today).at(-1)?.value ?? null;

  /** True when an entry is about everything: no assets picked, or every asset you have now. */
  const isEverything = (ids: number[]) => {
    const picked = new Set(ids.filter((id) => known.has(id)));
    return picked.size === 0 || current.every((id) => picked.has(id));
  };
  /** The assets an entry is about; for everything, every asset (archived ones too: they may have been held then). */
  const chosen = (ids: number[]) => (isEverything(ids) ? accounts.map((a) => a.id) : ids.filter((id) => known.has(id)));

  return {
    isEverything,
    names: (ids: number[]) => (isEverything(ids) ? [] : chosen(ids).map((id) => accounts.find((a) => a.id === id)!.name)),
    worth: (date: string, ids: number[]): number | null => valueOn(chosen(ids), date),
    /** Each asset's value on the date and today, in the categories' own order; assets with nothing on either day are left out. */
    breakdown(date: string, ids: number[]): AssetThen[] {
      const pick = new Set(chosen(ids));
      return sortByCategory(accounts.filter((a) => pick.has(a.id)), (a) => a.categoryId, categories)
        .map((a) => ({ id: a.id, name: a.name, categoryId: a.categoryId, category: a.categoryName, color: a.categoryColor, then: valueOn([a.id], date), now: valueOn([a.id], today) }))
        .filter((a) => (a.then ?? 0) !== 0 || (a.now ?? 0) !== 0);
    },
  };
}
