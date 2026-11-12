import Link from "next/link";
import { compactMoney, money, pct } from "@/lib/format";

/** Spending less is the good direction, so a rise reads in the "miss" colour and a fall in the "go" one. */
const spendTone = (c: number | null) => (c === null || Math.abs(c) < 0.0005 ? "text-ink-3" : c > 0 ? "text-miss-text" : "text-go-text");

/** "+12.5% vs Oct 2026", coloured so spending more reads as the warning. */
export function Change({ value, against }: { value: number | null; against: string }) {
  if (value === null) return <span className="text-ink-3">Nothing to compare with {against}</span>;
  return <span className={spendTone(value)}>{pct(value)} <span className="text-ink-3">{against}</span></span>;
}

/** One number with what it is and how it compares, for the row at the top of a page. */
export function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="card space-y-1 p-4 sm:p-5">
      <p className="eyebrow">{label}</p>
      <p className="num text-2xl font-extrabold tracking-tight">{value}</p>
      {children && <p className="num text-xs">{children}</p>}
    </div>
  );
}

export type Bar = { key: string; label: string; href: string; segments: { label: string; color: string; value: number }[] };

/**
 * Totals side by side (months or years), each a link to its own page. A bar is stacked by category, so you can see
 * not only how much changed but what. The selected one is full colour, the others faded. A dashed line marks
 * `average` when given.
 */
export function PeriodBars({ title, hint, bars, selected, currency, average, averageLabel, action, legend }: {
  title: string; hint: string; bars: Bar[]; selected: string; currency: string; average?: number | null; averageLabel?: string;
  /** Something to the right of the title, such as a switch between views. */
  action?: React.ReactNode;
  /** What the colours are, for bars stacked by something with only a few values. */
  legend?: { label: string; color: string }[];
}) {
  const totals = bars.map((b) => b.segments.reduce((s, x) => s + x.value, 0));
  const max = Math.max(...totals, average ?? 0, 0);
  const avg = average != null && average > 0 && max > 0 ? average / max : null;
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-lg">{title}</h2>
        {action}
        {avg !== null && <p className="num text-xs text-ink-3"><span className="mr-1 inline-block w-4 border-t border-dashed border-ink-3 align-middle" />{averageLabel ?? "Average"} {money(average!, currency)}</p>}
      </div>
      <p className="text-xs text-ink-3">{hint}</p>
      {legend && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {legend.map((l) => <li key={l.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: l.color }} />{l.label}</li>)}
        </ul>
      )}
      {max <= 0 ? (
        <p className="py-8 text-center text-sm text-ink-3">Nothing to show yet.</p>
      ) : (
        <ol className="mt-4 flex items-end gap-1 overflow-x-auto pb-1 sm:gap-2">
          {bars.map((b, i) => {
            const on = b.key === selected;
            const total = totals[i];
            return (
              <li key={b.key} className="min-w-9 flex-1">
                <Link href={b.href} aria-current={on ? "page" : undefined} aria-label={`${b.label}: ${money(total, currency)}`}
                  title={`${b.label}: ${money(total, currency)}`}
                  className={`group flex flex-col items-center gap-1 rounded-lg px-0.5 pt-1 ${on ? "bg-surface-2" : "hover:bg-surface-2"}`}>
                  <span className={`num text-[10px] ${on ? "font-bold text-ink" : "text-ink-3"}`}>{total > 0 ? compactMoney(total, currency) : "–"}</span>
                  <span className="relative flex h-40 w-full max-w-12 flex-col-reverse" aria-hidden>
                    {b.segments.filter((s) => s.value > 0).map((s, k) => (
                      <span key={s.label} style={{ height: `${(s.value / max) * 100}%`, background: s.color }}
                        className={`block w-full shrink-0 ${k === 0 ? "rounded-b-md" : ""} ${on ? "" : "opacity-40 group-hover:opacity-70"}`} />
                    ))}
                    {avg !== null && <span className="absolute inset-x-0 border-t border-dashed border-ink-3" style={{ bottom: `${avg * 100}%` }} />}
                  </span>
                  <span className={`whitespace-nowrap pb-1 text-[11px] ${on ? "font-bold text-ink" : "text-ink-3"}`}>{b.label}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export type CategoryRow = { category: string; color: string; total: number; count?: number; before: number | null };

/** Where the money went, largest first, each with its change from the period before. */
export function CategoryBars({ title, rows, currency, against }: { title: string; rows: CategoryRow[]; currency: string; against: string }) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  const max = Math.max(...rows.map((r) => r.total), 0);
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 text-lg">{title}</h2>
      {total <= 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">Nothing spent in this period.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const c = r.before === null || r.before <= 0 ? null : (r.total - r.before) / r.before;
            return (
              <li key={r.category} className="grid grid-cols-[minmax(6rem,10rem)_1fr_3.5rem] items-center gap-x-3 gap-y-0.5">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="truncate">{r.category}</span>
                </span>
                <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${max > 0 ? (r.total / max) * 100 : 0}%`, background: r.color }} />
                </span>
                <span className="num text-right text-sm font-bold">{((r.total / total) * 100).toFixed(0)}%</span>
                <span />
                <span className="num text-xs text-ink-3">
                  {money(r.total, currency)}{r.count !== undefined && <> · {r.count} {r.count === 1 ? "time" : "times"}</>}
                  {r.before === null || r.before <= 0
                    ? r.total > 0 && <> · <span className="text-ink-3">new {against}</span></>
                    : <> · <span className={spendTone(c)}>{pct(c, 0)}</span> {against}</>}
                </span>
                <span />
              </li>
            );
          })}
          <li className="grid grid-cols-[minmax(6rem,10rem)_1fr_3.5rem] items-center gap-x-3 border-t border-line pt-3 text-sm font-bold">
            <span>Total</span>
            <span className="num text-xs font-normal text-ink-3">{money(total, currency)}</span>
            <span className="num text-right">100%</span>
          </li>
        </ul>
      )}
    </section>
  );
}

/** ‹ Nov 2026 › with links to the period before and after. */
export function PeriodSwitcher({ label, prevHref, nextHref, prevLabel, nextLabel }: { label: string; prevHref: string; nextHref: string | null; prevLabel: string; nextLabel: string }) {
  const arrow = "grid size-9 place-items-center rounded-full bg-surface text-lg text-ink-2 hover:bg-surface-2";
  return (
    <div className="flex items-center gap-2">
      <Link href={prevHref} aria-label={prevLabel} className={arrow}>‹</Link>
      <p className="num min-w-28 text-center text-lg font-bold" aria-live="polite">{label}</p>
      {nextHref ? <Link href={nextHref} aria-label={nextLabel} className={arrow}>›</Link> : <span className={`${arrow} opacity-30`} aria-hidden>›</span>}
    </div>
  );
}

/**
 * A tiny column chart of one row's months, for the trend at a glance. Scaled to the row's own peak, so a small
 * category shows its shape as clearly as a big one. A month with nothing recorded is a faint tick; `selected` is
 * full colour, the others a little faded.
 */
export function MiniBars({ values, selected, color, label, width = 96, height = 28 }: {
  values: { key: string; value: number | null }[]; selected: string; color: string; label: string; width?: number; height?: number;
}) {
  const max = Math.max(...values.map((v) => v.value ?? 0), 0);
  const slot = width / Math.max(values.length, 1);
  const bar = Math.max(slot - 2, 1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="block">
      {values.map((v, i) => {
        const x = i * slot + (slot - bar) / 2;
        if (v.value === null || v.value <= 0 || max <= 0) return <rect key={v.key} x={x} y={height - 1.5} width={bar} height={1.5} rx={0.75} fill="var(--line)" />;
        const h = Math.max((v.value / max) * height, 2);
        return <rect key={v.key} x={x} y={height - h} width={bar} height={h} rx={1} fill={color} opacity={v.key === selected ? 1 : 0.45} />;
      })}
    </svg>
  );
}
