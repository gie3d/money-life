/** Items in the categories' own order (as on the Categories page), keeping their order within a category. */
export function sortByCategory<T>(items: T[], categoryId: (x: T) => number, order: { id: number }[]): T[] {
  const rank = new Map(order.map((c, i) => [c.id, i]));
  return [...items].sort((a, b) => (rank.get(categoryId(a)) ?? Infinity) - (rank.get(categoryId(b)) ?? Infinity));
}

/** The items split by `key`, groups in the order their first item appears. */
export function groupBy<T, K>(items: T[], key: (x: T) => K): { key: K; items: T[] }[] {
  const out = new Map<K, T[]>();
  for (const x of items) out.set(key(x), [...(out.get(key(x)) ?? []), x]);
  return [...out].map(([k, xs]) => ({ key: k, items: xs }));
}
