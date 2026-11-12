import type { Metadata } from "next";
import MonthSpendingForm from "@/components/MonthSpendingForm";
import SectionTabs from "@/components/SectionTabs";
import SpendingCategories from "@/components/SpendingCategories";
import BarsSwitch from "@/components/BarsSwitch";
import { CategoryBars, Change, MiniBars, PeriodSwitcher, Tile } from "@/components/SpendingCharts";
import { startSpendingCategories } from "@/app/actions/spending";
import { listMonthlySpending, listSpendingCategories } from "@/lib/data";
import { money, monthLabel } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { amountOf, change, compareMonth, isMonth, monthsBetween, shiftMonth, STARTER_CATEGORIES, tierTotals, TIERS, UNSORTED } from "@/lib/spending";
import { CATEGORY_COLORS, type Tier } from "@/lib/types";

export const metadata: Metadata = { title: "Everyday spending" };

/** "Nov", with the year on January and on the first bar: "Jan ’26". */
const shortMonth = (m: string, first: boolean) => {
  const name = new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return first || m.endsWith("-01") ? `${name} ’${m.slice(2, 4)}` : name;
};

export default async function EverydaySpendingPage({ searchParams }: PageProps<"/spending">) {
  const user = await requireUser();
  const cur = user.currency;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const sp = await searchParams;
  const month = isMonth(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth;
  const href = (m: string) => (m === thisMonth ? "/spending" : `/spending?month=${m}`);

  const [categories, amounts] = await Promise.all([listSpendingCategories(user.id), listMonthlySpending(user.id)]);
  // A category's colour follows its place among all of them, so it stays the same on every chart and month.
  const colorOf = new Map(categories.map((c, i) => [c.id, CATEGORY_COLORS[i % CATEGORY_COLORS.length]]));
  const has = (id: number, m: string) => amounts.some((a) => a.categoryId === id && a.month === m);
  const monthsOf = (id: number) => amounts.filter((a) => a.categoryId === id).length;
  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);
  const item = (c: (typeof categories)[number]) => ({ id: c.id, name: c.name, color: colorOf.get(c.id)!, months: monthsOf(c.id), tier: c.tier });

  const cmp = compareMonth(amounts, month);
  // On the form: every category on the list, and a removed one only for a month it has an amount in.
  const formRows = categories.filter((c) => !c.archived || has(c.id, month)).map((c) => ({
    id: c.id, name: c.name, color: colorOf.get(c.id)!, archived: c.archived,
    amount: has(c.id, month) ? amountOf(amounts, c.id, month) : null,
    last: has(c.id, cmp.prev) ? amountOf(amounts, c.id, cmp.prev) : null,
  }));
  const anyPrev = cmp.prevTotal !== null;
  const rows = categories
    .map((c) => ({ category: c.name, color: colorOf.get(c.id)!, total: amountOf(amounts, c.id, month), before: anyPrev ? amountOf(amounts, c.id, cmp.prev) : null }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const top = rows[0];

  const segments = (m: string) => categories.map((c) => ({ label: c.name, color: colorOf.get(c.id)!, value: amountOf(amounts, c.id, m) }));
  const bars = monthsBetween(shiftMonth(month, -11), month).map((m, i) => ({ key: m, label: shortMonth(m, i === 0), href: href(m), segments: segments(m) }));

  // Each category over the 6 months up to the one shown.
  const monthTotal = (m: string) => amounts.filter((a) => a.month === m).reduce((s, a) => s + a.amount, 0);
  const tableMonths = monthsBetween(shiftMonth(month, -5), month);
  // The trend beside each row looks further back than the columns: the 12 months up to the one shown.
  const trendMonths = monthsBetween(shiftMonth(month, -11), month);
  const trendOf = (id: number | null) => trendMonths.map((m) => ({
    key: m,
    value: id === null ? (amounts.some((a) => a.month === m) ? monthTotal(m) : null) : has(id, m) ? amountOf(amounts, id, m) : null,
  }));
  const trendLabel = (name: string, id: number | null) => {
    const v = trendOf(id).filter((x) => x.value !== null);
    return v.length === 0 ? `${name}: nothing in the last 12 months` : `${name}, last 12 months: from ${money(v[0].value!, cur)} in ${monthLabel(v[0].key)} to ${money(v.at(-1)!.value!, cur)} in ${monthLabel(v.at(-1)!.key)}`;
  };
  const tableCats = categories.filter((c) => !c.archived || tableMonths.some((m) => has(c.id, m)));
  const against = monthLabel(cmp.prev);

  // Must, need and want: the same month and the 12 months, grouped by each category's tier.
  const tierRows = tierTotals(categories, amounts, month, cmp.prev);
  const tierOf = new Map(categories.map((c) => [c.id, c.tier ?? "none"]));
  const tierBars = monthsBetween(shiftMonth(month, -11), month).map((m, i) => ({
    key: m, label: shortMonth(m, i === 0), href: href(m),
    segments: [...TIERS, UNSORTED].map((t) => ({
      label: t.label, color: t.color,
      value: amounts.filter((a) => a.month === m && (tierOf.get(a.categoryId) ?? "none") === t.id).reduce((s, a) => s + a.amount, 0),
    })),
  }));
  const tierName = (t: Tier | null) => TIERS.find((x) => x.id === t)?.label;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <SectionTabs section="spending" current="/spending" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Everyday spending</h1>
          <p className="mt-1 text-sm text-ink-3">What daily life costs each month, by category, and how it compares with the months before.</p>
        </div>
        <PeriodSwitcher
          label={monthLabel(month)}
          prevHref={href(cmp.prev)} prevLabel={`Show ${against}`}
          nextHref={month < thisMonth ? href(shiftMonth(month, 1)) : null} nextLabel={`Show ${monthLabel(shiftMonth(month, 1))}`}
        />
      </div>

      {categories.length === 0 ? (
        <>
          <div className="card space-y-3 p-6">
            <p className="font-bold">Set up your categories</p>
            <p className="text-sm text-ink-3">Each month you&apos;ll type one total per category, from your other app or bank statement. Start with a common set and change it, or add your own below.</p>
            <p className="text-xs text-ink-3">{STARTER_CATEGORIES.join(" · ")}</p>
            <form action={startSpendingCategories}><button className="btn">Start with these</button></form>
          </div>
          <SpendingCategories active={[]} archived={[]} />
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label={`Spent in ${monthLabel(month)}`} value={money(cmp.total, cur)}>
              <Change value={change(cmp.total, cmp.prevTotal)} against={`vs ${against}`} />
            </Tile>
            <Tile label={cmp.averageMonths === 1 ? "The month before" : `Average of ${cmp.averageMonths || 6} months before`} value={cmp.average === null ? "—" : money(cmp.average, cur)}>
              {cmp.average === null
                ? <span className="text-ink-3">Nothing recorded before {monthLabel(month)}</span>
                : <Change value={change(cmp.total, cmp.average)} against="vs the average" />}
            </Tile>
            <Tile label="Biggest category" value={top ? top.category : "—"}>
              {top ? <span className="text-ink-3">{money(top.total, cur)} · {Math.round((top.total / cmp.total) * 100)}% of the month</span> : <span className="text-ink-3">Nothing recorded for this month yet</span>}
            </Tile>
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <MonthSpendingForm key={month} month={month} label={monthLabel(month)} prevLabel={against} rows={formRows} currency={cur} />
            <CategoryBars title={`Where it went in ${monthLabel(month)}`} rows={rows} currency={cur} against={`vs ${against}`} />
          </div>

          <CategoryBars title={`Must, need, want in ${monthLabel(month)}`} rows={tierRows.filter((t) => t.total > 0 || t.id !== "none").map((t) => ({ category: t.label, color: t.color, total: t.total, before: t.before }))} currency={cur} against={`vs ${against}`} />

          <BarsSwitch title="Month by month" selected={month} currency={cur} average={cmp.average} averageLabel="6-month average"
            views={[
              { id: "category", label: "By category", hint: "The 12 months up to the one shown, by category. Tap a month to open it.", bars },
              { id: "tier", label: "Must, need, want", bars: tierBars,
                hint: tierRows.find((t) => t.id === "none")!.total > 0 ? "Categories not sorted yet show in grey; sort them under Categories below." : "The 12 months up to the one shown, by tier. Tap a month to open it.",
                legend: [...TIERS, UNSORTED].map((t) => ({ label: t.label, color: t.color })) },
            ]} />

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg">Each category, month by month</h2>
            <p className="text-xs text-ink-3">The 6 months up to {monthLabel(month)}, each category&apos;s trend over the last 12, and its average over the months it has.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="num w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="text-right text-xs text-ink-3">
                    <th className="py-2 text-left font-semibold">Category</th>
                    <th className="py-2 pl-3 text-left font-semibold">12 months</th>
                    {tableMonths.map((m) => <th key={m} className={`py-2 pl-3 font-semibold ${m === month ? "text-ink" : ""}`}>{shortMonth(m, false)}</th>)}
                    <th className="py-2 pl-3 font-semibold">Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {tableCats.map((c) => {
                    const recorded = tableMonths.filter((m) => has(c.id, m));
                    const avg = recorded.length > 0 ? recorded.reduce((s, m) => s + amountOf(amounts, c.id, m), 0) / recorded.length : null;
                    return (
                      <tr key={c.id}>
                        <td className="py-2 pr-3 text-left">
                          <span className={`flex items-center gap-2 font-semibold ${c.archived ? "text-ink-3" : ""}`}><span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf.get(c.id) }} />{c.name}{c.tier && <span className="rounded-full bg-surface-2 px-2 text-[10px] font-semibold text-ink-3">{tierName(c.tier)}</span>}</span>
                        </td>
                        <td className="py-2 pl-3"><MiniBars values={trendOf(c.id)} selected={month} color={colorOf.get(c.id)!} label={trendLabel(c.name, c.id)} /></td>
                        {tableMonths.map((m) => (
                          <td key={m} className={`py-2 pl-3 text-right ${m === month ? "font-bold" : ""} ${has(c.id, m) ? "" : "text-ink-3"}`}>{has(c.id, m) ? money(amountOf(amounts, c.id, m), cur) : "–"}</td>
                        ))}
                        <td className="py-2 pl-3 text-right text-ink-3">{avg === null ? "–" : money(avg, cur)}</td>
                      </tr>
                    );
                  })}
                  <tr className="font-bold">
                    <td className="py-2 pr-3 text-left">Total</td>
                    <td className="py-2 pl-3"><MiniBars values={trendOf(null)} selected={month} color="var(--ink-2)" label={trendLabel("Total", null)} /></td>
                    {tableMonths.map((m) => <td key={m} className={`py-2 pl-3 text-right ${monthTotal(m) > 0 ? "" : "text-ink-3"}`}>{monthTotal(m) > 0 ? money(monthTotal(m), cur) : "–"}</td>)}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <SpendingCategories active={active.map(item)} archived={archived.map(item)} />
        </>
      )}
    </div>
  );
}
