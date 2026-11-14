import "server-only";
import { listAccounts, listEntries, listPrices, listTrades } from "./data";
import { extendTo, netWorthSeries } from "./performance";
import { accountEntries } from "./portfolio";

export type TrendAsset = { id: number; name: string; color: string; categoryId: number; category: string };
/** One day on the chart: the total of the assets, and each asset's own value under `a<id>`. */
export type TrendRow = { date: string; total: number } & Record<string, number | string>;

/**
 * What a journal entry says about money: how much the assets it mentions (everything, when it mentions none or all
 * of them) were worth on its date, from what was recorded by then, and what they are worth today.
 */
export async function journalMoney(userId: number, today: string) {
  const [accounts, entries, trades, prices] = await Promise.all([
    listAccounts(userId, true), listEntries(userId), listTrades(userId), listPrices(userId),
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
    /** How the assets an entry is about moved from `from` to `to` (capped at today): a row on each date something was recorded. */
    trend(from: string, to: string, ids: number[]): { assets: TrendAsset[]; rows: TrendRow[] } {
      const end = to < today ? to : today;
      const pick = new Set(chosen(ids));
      const picked = accounts.filter((a) => pick.has(a.id));
      if (from > end) return { assets: [], rows: [] };
      const total = extendTo(netWorthSeries(picked.map((a) => lists.get(a.id)!), from, end), end);
      const per = picked.map((a) => ({ a, pts: netWorthSeries([lists.get(a.id)!], from, end) }));
      const rows = total.map((p) => {
        const row: TrendRow = { date: p.date, total: p.value };
        for (const { a, pts } of per) row[`a${a.id}`] = [...pts].reverse().find((x) => x.date <= p.date)?.value ?? 0;
        return row;
      });
      const held = per.filter(({ pts }) => pts.some((x) => x.value !== 0)).map(({ a }) => ({ id: a.id, name: a.name, color: a.categoryColor, categoryId: a.categoryId, category: a.categoryName }));
      return { assets: held, rows };
    },
    isEverything,
    names: (ids: number[]) => (isEverything(ids) ? [] : chosen(ids).map((id) => accounts.find((a) => a.id === id)!.name)),
    worth: (date: string, ids: number[]): number | null => valueOn(chosen(ids), date),
  };
}
