export type SearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 7;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export type Paged<T> = {
  rows: T[];
  /** The rows before the period was applied. */
  all: number;
  /** The rows in the period, over all pages. */
  total: number;
  page: number;
  pages: number;
  from: string;
  to: string;
  /** 1-based position of the first and last row on this page. */
  first: number;
  last: number;
};

/**
 * One page of a list, optionally limited to a period. The period (`from`, `to`) is shared by every list on the page;
 * each list has its own page number, `<key>Page`. Rows are expected in the order they should be shown.
 */
export function paginate<T>(items: T[], sp: SearchParams, key: string, dateOf: (t: T) => string, size = PAGE_SIZE): Paged<T> {
  let from = one(sp.from);
  let to = one(sp.to);
  if (!isDate(from)) from = "";
  if (!isDate(to)) to = "";
  if (from && to && from > to) [from, to] = [to, from];
  const inPeriod = items.filter((t) => (!from || dateOf(t) >= from) && (!to || dateOf(t) <= to));
  const pages = Math.max(1, Math.ceil(inPeriod.length / size));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(one(sp[`${key}Page`]))) || 1));
  const rows = inPeriod.slice((page - 1) * size, page * size);
  return {
    rows, all: items.length, total: inPeriod.length, page, pages, from, to,
    first: rows.length > 0 ? (page - 1) * size + 1 : 0, last: (page - 1) * size + rows.length,
  };
}
