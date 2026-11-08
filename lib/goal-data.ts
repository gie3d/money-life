import "server-only";
import { listAccounts, listCategories, listEntries, listPrices, listTrades } from "./data";
import { sortByCategory } from "./group";
import { accountEntries, holdings } from "./portfolio";
import type { Entry } from "./types";

/** What goal pages need about assets: the tick list (by category, with values now) and each asset's dated values. */
export async function goalAssets(userId: number) {
  const [accounts, entries, trades, prices, categories] = await Promise.all([
    listAccounts(userId, true), listEntries(userId), listTrades(userId), listPrices(userId), listCategories(userId),
  ]);
  const held = holdings(accounts, entries, trades, prices);
  const ticks = sortByCategory(accounts.filter((a) => !a.archived), (a) => a.categoryId, categories).map((a) => ({
    id: a.id, name: a.name, color: a.categoryColor, categoryId: a.categoryId, category: a.categoryName,
    value: held.find((h) => h.account.id === a.id)?.value ?? 0,
  }));
  const listsOf = (ids: number[]): Entry[][] => accounts.filter((a) => ids.includes(a.id)).map((a) => accountEntries(a, entries, trades, prices));
  return { accounts, ticks, listsOf };
}
