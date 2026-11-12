import { day, money, pct, tone } from "@/lib/format";
import { groupBy } from "@/lib/group";
import type { AssetThen } from "@/lib/journal";

const change = (then: number, now: number) => (then > 0 ? (now - then) / then : null);

/**
 * What the money an entry is about was worth on its date, and what it is worth now: totals, one bar of how it was
 * split between categories, then each category, which opens to its assets.
 */
export default function JournalMoney({ date, assets, everything, currency }: { date: string; assets: AssetThen[]; everything: boolean; currency: string }) {
  const then = assets.reduce((s, a) => s + (a.then ?? 0), 0);
  const now = assets.reduce((s, a) => s + (a.now ?? 0), 0);
  const groups = groupBy(assets, (a) => a.categoryId).map(({ items }) => ({
    id: items[0].categoryId, name: items[0].category, color: items[0].color, items,
    then: items.reduce((s, a) => s + (a.then ?? 0), 0), now: items.reduce((s, a) => s + (a.now ?? 0), 0),
  }));
  const shown = groups.filter((g) => g.then > 0);
  const c = change(then, now);

  return (
    <section className="card space-y-5 p-5 sm:p-8" aria-labelledby="money-then">
      <div>
        <h2 id="money-then" className="text-lg">{everything ? "Your money" : "The assets this is about"} on {day(date)}</h2>
        <p className="text-xs text-ink-3">From what was recorded by then, next to what {assets.length === 1 ? "it is" : "they are"} worth today.</p>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <div><dt className="eyebrow">Then</dt><dd className="num text-xl font-extrabold tracking-tight sm:text-2xl">{money(then, currency)}</dd></div>
        <div><dt className="eyebrow">Now</dt><dd className="num text-xl font-extrabold tracking-tight sm:text-2xl">{money(now, currency)}</dd></div>
        <div>
          <dt className="eyebrow">Change</dt>
          <dd className={`num text-xl font-extrabold tracking-tight sm:text-2xl ${tone(now - then)}`}>{pct(c)}</dd>
        </div>
      </dl>

      {then > 0 && (
        <div className="space-y-2">
          {/* How the money was split that day, one bar. */}
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" role="img"
            aria-label={`Split on ${day(date)}: ${shown.map((g) => `${g.name} ${Math.round((g.then / then) * 100)}%`).join(", ")}`}>
            {shown.map((g) => <span key={g.id} style={{ width: `${(g.then / then) * 100}%`, background: g.color }} className="h-full border-r-2 border-surface last:border-r-0" />)}
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3" aria-hidden>
            {shown.map((g) => (
              <li key={g.id} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: g.color }} />{g.name} <span className="num">{Math.round((g.then / then) * 100)}%</span></li>
            ))}
          </ul>
        </div>
      )}

      <ul className="divide-y divide-line border-t border-line">
        {groups.map((g) => {
          const gc = change(g.then, g.now);
          return (
            <li key={g.id}>
              <details className="group">
                <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-x-3 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: g.color }} aria-hidden />
                    <span className="truncate text-sm font-semibold">{g.name}</span>
                    <span className="shrink-0 text-xs text-ink-3">{g.items.length} {g.items.length === 1 ? "asset" : "assets"}</span>
                    <span className="shrink-0 text-xs text-ink-3 transition-transform group-open:rotate-90" aria-hidden>›</span>
                  </span>
                  <span className="num text-right">
                    <span className="block text-sm font-bold">{money(g.then, currency)}</span>
                    <span className="block text-xs text-ink-3">now {money(g.now, currency)}{gc !== null && <span className={tone(g.now - g.then)}> {pct(gc)}</span>}</span>
                  </span>
                </summary>
                <ul className="mb-3 space-y-1.5 rounded-xl bg-surface-2 px-3 py-2.5">
                  {g.items.map((a) => {
                    const ac = a.then !== null ? change(a.then, a.now ?? 0) : null;
                    return (
                      <li key={a.id} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 text-sm">
                        <span className="truncate">{a.name}</span>
                        <span className="num text-right">
                          {a.then === null || a.then === 0 ? <span className="text-ink-3">not yet held</span> : money(a.then, currency)}
                          <span className="text-xs text-ink-3"> → {money(a.now ?? 0, currency)}</span>
                          {ac !== null && <span className={`text-xs ${tone((a.now ?? 0) - (a.then ?? 0))}`}> {pct(ac)}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
