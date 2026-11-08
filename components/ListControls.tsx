import Link from "next/link";
import DatePicker from "./DatePicker";
import type { Paged, SearchParams } from "@/lib/paging";

const isOwn = (k: string) => k === "from" || k === "to" || k.endsWith("Page");
const values = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

/** The query string for one list's page, keeping the period and everything else on the page as it is. */
function href(sp: SearchParams, name: string, page: number, id: string) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (k !== `${name}Page`) for (const x of values(v)) q.append(k, x);
  if (page > 1) q.set(`${name}Page`, String(page));
  return `?${q.toString()}#${id}`;
}

/** Start and end dates that limit the lists below to a period (a plain GET form), with a clear link. */
export function PeriodFilter({ from, to, sp, id }: { from: string; to: string; sp: SearchParams; id: string }) {
  const clear = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (!isOwn(k)) for (const x of values(v)) clear.append(k, x);
  return (
    <form action={`#${id}`} className="card flex flex-wrap items-end gap-3 p-4 sm:px-6" aria-label="Show a period">
      {Object.entries(sp).filter(([k]) => !isOwn(k)).flatMap(([k, v]) => values(v).map((x, i) => <input key={`${k}${i}`} type="hidden" name={k} value={x} />))}
      <span className="mr-1 pb-2 text-sm font-semibold">Period</span>
      <div className="w-44 space-y-1">
        <span className="eyebrow block">From</span>
        <DatePicker name="from" label="From" defaultValue={from || undefined} optional placeholder="Any date" />
      </div>
      <div className="w-44 space-y-1">
        <span className="eyebrow block">To</span>
        <DatePicker name="to" label="To" defaultValue={to || undefined} optional placeholder="Any date" />
      </div>
      <button className="btn btn-quiet">Show</button>
      {(from || to) && <Link href={`?${clear.toString()}#${id}`} scroll={false} className="py-2 text-sm font-semibold text-brand">Clear</Link>}
    </form>
  );
}

/** "8–14 of 134" with previous and next links. */
export function Pager({ paged, sp, name, id }: { paged: Paged<unknown>; sp: SearchParams; name: string; id: string }) {
  const btn = "rounded-full bg-surface-2 px-3.5 py-1.5 text-sm font-semibold";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-ink-3 sm:px-6">
      <span className="num">
        {paged.total === 0 ? "Nothing in this period" : `${paged.first}–${paged.last} of ${paged.total}`}
        {paged.total !== paged.all && ` (${paged.all} in all)`}
      </span>
      {paged.pages > 1 && (
        <nav className="flex items-center gap-2" aria-label="Pages">
          {paged.page > 1 ? <Link href={href(sp, name, paged.page - 1, id)} scroll={false} className={`${btn} text-ink`}>Newer</Link> : <span className={`${btn} opacity-40`}>Newer</span>}
          <span className="num">{paged.page}/{paged.pages}</span>
          {paged.page < paged.pages ? <Link href={href(sp, name, paged.page + 1, id)} scroll={false} className={`${btn} text-ink`}>Older</Link> : <span className={`${btn} opacity-40`}>Older</span>}
        </nav>
      )}
    </div>
  );
}
