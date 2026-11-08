import "server-only";
import { listAccounts, listCategories, listEntries, listPrices, listTrades } from "./data";
import { sortByCategory } from "./group";
import { accountPerformance, periodStart } from "./performance";
import { accountEntries, holdings } from "./portfolio";
import type { Entry } from "./types";

/** What goal pages need about assets: the tick list (by category, with values now) and each asset's dated values. */
export async function goalAssets(userId: number) {
  const [accounts, entries, trades, prices, categories] = await Promise.all([
    listAccounts(userId, true), listEntries(userId), listTrades(userId), listPrices(userId), listCategories(userId),
  ]);
  const held = holdings(accounts, entries, trades, prices);
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = periodStart("1Y", today)!;
  const ticks = sortByCategory(accounts.filter((a) => !a.archived), (a) => a.categoryId, categories).map((a) => {
    // Its return over the last 12 months, as a guide when typing its expected growth (money in or out set aside).
    const list = accountEntries(a, entries, trades, prices);
    const past = list.length > 0 && list[0].date <= yearAgo ? accountPerformance(list, yearAgo, today)?.returnPct ?? null : null;
    return {
      id: a.id, name: a.name, color: a.categoryColor, categoryId: a.categoryId, category: a.categoryName,
      value: held.find((h) => h.account.id === a.id)?.value ?? 0, pastReturn: past,
    };
  });
  const listsOf = (ids: number[]): Entry[][] => accounts.filter((a) => ids.includes(a.id)).map((a) => accountEntries(a, entries, trades, prices));
  return { accounts, ticks, listsOf };
}
