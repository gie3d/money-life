import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import CollapsibleRows from "@/components/CollapsibleRows";
import ForecastChart from "@/components/ForecastChart";
import AllocationBars, { type AllocationRow } from "@/components/AllocationBars";
import { listAccounts, listCategories, listEntries, listGoals, listGoalVersions, listPlanItems, listPlans, listPrices, listTrades } from "@/lib/data";
import { goalAssets } from "@/lib/goal-data";
import { monthsBetween, path, standing, targetValue, valuesOn } from "@/lib/goals";
import { addMonths } from "@/lib/plan";
import { compactMoney, day, money, pct, signedMoney, tone } from "@/lib/format";
import { colorFor } from "@/lib/palette";
import { extendTo, netWorthSeries } from "@/lib/performance";
import { forecast } from "@/lib/forecast";
import { payments } from "@/lib/plan";
import { accountEntries, holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { labelOf, LIQUIDITY, TYPES } from "@/lib/types";

export default async function Overview() {
  const user = await requireUser();
  const cur = user.currency;

  const [accounts, entries, categories, trades, prices, plans, planItems] = await Promise.all([
    listAccounts(user.id), listEntries(user.id), listCategories(user.id), listTrades(user.id), listPrices(user.id),
    listPlans(user.id), listPlanItems(user.id),
  ]);
  const [goals, goalVersions, { listsOf: goalLists }] = await Promise.all([listGoals(user.id), listGoalVersions(user.id), goalAssets(user.id)]);
  const rows = holdings(accounts, entries, trades, prices);

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <Breadcrumb items={[{ label: "Overview" }]} />
        <div className="card p-8 text-center">
          <h1 className="text-2xl">Hi {user.name}, let&apos;s start tracking</h1>
          <p className="mx-auto mt-2 max-w-md text-ink-3">Add an asset, then record what it is worth from time to time. The more dated values, the better the picture.</p>
          <Link href="/accounts" className="btn mt-6">Add your first asset</Link>
        </div>
      </div>
    );
  }

  const totalValue = rows.reduce((s, h) => s + h.value, 0);
  // Profit and loss exist only for investments; cash and saving are just a balance.
  const invs = rows.filter((h) => h.investment);
  const invValue = invs.reduce((s, h) => s + h.value, 0);
  const invCost = invs.reduce((s, h) => s + h.cost, 0);
  const invPl = invValue - invCost;
  const invPlPct = invCost > 0 ? invPl / invCost : null;
  const realized = invs.reduce((s, h) => s + h.realized, 0);

  // The assets table, one group per category in the categories' own order, each with its subtotal.
  const groups = categories
    .map((category) => {
      const members = rows.filter((h) => h.account.categoryId === category.id);
      const inv = members.filter((h) => h.investment);
      const cost = inv.reduce((s, h) => s + h.cost, 0);
      return {
        category,
        rows: members,
        value: members.reduce((s, h) => s + h.value, 0),
        investment: inv.length > 0,
        cost,
        pl: inv.reduce((s, h) => s + h.value, 0) - cost,
      };
    })
    .filter((g) => g.rows.length > 0);

  // Allocation: value per category or liquidity group, with what the investments in it cost.
  const allocation = (members: typeof rows, id: string, label: string, color: string): AllocationRow => {
    const inv = members.filter((h) => h.investment);
    return { id, label, color, value: members.reduce((s, h) => s + h.value, 0), cost: inv.length > 0 ? inv.reduce((s, h) => s + h.cost, 0) : null };
  };
  const byCategory = groups.map((g) => allocation(g.rows, String(g.category.id), g.category.name, g.category.color));
  const byLiquidity = LIQUIDITY
    .map((l) => allocation(rows.filter((h) => h.account.liquidity === l.id), l.id, l.label, colorFor(l.id, LIQUIDITY)))
    .filter((r) => r.value !== 0);

  const today = new Date().toISOString().slice(0, 10);

  // Goals, three years out: where each plan should be by then (or at its own date, if sooner), where carrying on
  // from today leads by then, and how each stands against its plan today.
  const goalCards = goals.flatMap((g) => {
    const plan = goalVersions.filter((v) => v.goalId === g.id).at(-1);
    if (!plan) return [];
    const glists = goalLists(g.accountIds);
    const s = standing(plan, glists, today);
    const nowBy = plan.assets.length > 0 ? valuesOn(glists, today) : s.actual;
    const n = monthsBetween(plan.startDate, plan.targetDate);
    const final = addMonths(today, 36) >= plan.targetDate;
    const k = final ? n : Math.min(n, monthsBetween(plan.startDate, addMonths(today, 36)));
    const date = final ? plan.targetDate : addMonths(today, 36);
    // The plan's value at the end of this year and the next two, as marks on the bar (only those before its end).
    const thisYear = +today.slice(0, 4);
    const marks = [thisYear, thisYear + 1, thisYear + 2]
      .map((y) => ({ year: y, end: `${y}-12-31` }))
      .filter((m) => m.end < date && m.end >= plan.startDate)
      .map((m) => ({ year: m.year, value: path(plan, 0, undefined, Math.min(n, monthsBetween(plan.startDate, m.end))).at(-1)!.value }));
    return [{
      goal: g, plan, s, final, date, marks,
      milestone: final ? targetValue(plan) : path(plan, 0, undefined, k).at(-1)!.value,
      onTrack: path(plan, s.k, nowBy, Math.max(k, s.k)).at(-1)!.value,
    }];
  });

  // Where the total value is heading: the last 12 months' average change carried on, less plan payments.
  // Plans are only subtracted here, in the forecast; nothing is ever taken out of an asset.
  const lists = rows.map((h) => accountEntries(h.account, entries, trades, prices));
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const itemPlan = new Map(planItems.map((i) => [i.id, planName.get(i.planId) ?? ""]));
  // Archived plans are put aside, so their costs are left out.
  const activePlans = new Set(plans.filter((p) => !p.archived).map((p) => p.id));
  // Twelve months back as recorded, twelve ahead on the trend.
  const ahead = forecast(extendTo(netWorthSeries(lists, null, today), today), today, payments(planItems.filter((i) => activePlans.has(i.planId))), 12);
  const planDue = ahead.payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb items={[{ label: "Overview" }]} />
        <Link href="/update" className="btn">Update values</Link>
      </div>
      <section className="rounded-[28px] bg-gradient-to-br from-[var(--hero-a)] via-[var(--hero-b)] to-[var(--hero-c)] p-6 text-white sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Total value of all assets</p>
        <p className="num mt-1 text-4xl font-extrabold sm:text-5xl">{money(totalValue, cur)}</p>
        {invs.length > 0 && (
          <p className="num mt-3 text-sm font-semibold">
            Investments {signedMoney(invPl, cur)} · {pct(invPlPct)}
            <span className="font-medium opacity-80"> on {money(invCost, cur)} cost</span>
            {realized !== 0 && <span className="font-medium opacity-80"> · {signedMoney(realized, cur)} realized from sales</span>}
          </p>
        )}
        <Link href="/performance" className="mt-4 inline-block rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold hover:bg-white/30">See performance →</Link>
      </section>

      {goalCards.length > 0 ? (
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg">Goals <span className="text-ink-3">— the next 3 years</span></h2>
              <p className="text-xs text-ink-3">Where each plan should be by {day(addMonths(today, 36))}, and whether you&apos;re on track to get there.</p>
            </div>
            <Link href="/goals" className="text-sm font-semibold text-brand">All goals →</Link>
          </div>
          <ul className="divide-y divide-line">
            {goalCards.map(({ goal, s, final, date, milestone, onTrack, marks }) => {
              const share = milestone > 0 ? Math.min(1, s.actual / milestone) : 0;
              const ok = onTrack >= milestone;
              return (
                <li key={goal.id} className="py-3 first:pt-0 last:pb-0">
                  <Link href={`/goals/${goal.id}`} className="block space-y-2">
                    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                      <div>
                        <p className="font-semibold">{goal.name}</p>
                        <p className={`text-sm font-semibold ${tone(s.gap)}`}>{s.gap >= 0 ? "Ahead of plan" : "Behind plan"} {signedMoney(s.gap, cur)} today</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${final ? "bg-go-soft text-go-text" : "bg-sky-soft text-sky"}`}>
                          {final ? "Final target" : "3-year target"} · {day(date)}
                        </span>
                        <p className="num mt-1 text-2xl font-extrabold">{money(milestone, cur)}</p>
                      </div>
                    </div>
                    <div
                      className={`relative ${marks.length > 0 ? "pb-7" : ""}`}
                      role="img"
                      aria-label={`${Math.round(share * 100)}% of the way${marks.map((m) => `; plan for end of ${m.year}: ${money(m.value, cur)}`).join("")}`}
                    >
                      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${share * 100}%` }} />
                      </div>
                      {marks.map((m) => {
                        const at = milestone > 0 ? Math.min(100, (m.value / milestone) * 100) : 0;
                        const reached = s.actual >= m.value;
                        return (
                          <div key={m.year} className="absolute top-0" style={{ left: `${at}%` }} aria-hidden>
                            <span className={`absolute -top-1 block h-4.5 w-0.5 -translate-x-1/2 rounded-full ${reached ? "bg-go" : "bg-ink-2"}`} />
                            <span
                              className={`num absolute top-4 whitespace-nowrap text-[11px] leading-tight ${reached ? "text-go-text" : "text-ink-3"} ${at > 85 ? "-translate-x-full text-right" : at < 15 ? "" : "-translate-x-1/2 text-center"}`}
                            >
                              <span className="block font-semibold">{m.year}</span>
                              {compactMoney(m.value, cur)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="num flex flex-wrap gap-x-4 text-xs text-ink-3">
                      <span>Now <span className="font-semibold text-ink">{money(s.actual, cur)}</span> · {(share * 100).toFixed(1)}% of the way</span>
                      <span>On track for <span className={`font-semibold ${ok ? "text-go-text" : "text-miss-text"}`}>{money(onTrack, cur)}</span> by {day(date)}{ok ? " ✓" : ` (${money(milestone - onTrack, cur)} short)`}</span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <Link href="/goals/new" className="card flex items-center justify-between gap-3 p-5 hover:bg-surface-2 sm:p-6">
          <span>
            <span className="block text-lg font-bold">Set a goal</span>
            <span className="text-sm text-ink-3">Retirement, a child&apos;s education, a house: see if you&apos;re on track.</span>
          </span>
          <span className="text-brand">→</span>
        </Link>
      )}

      <section className="card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="mr-auto">
            <h2 className="text-lg">Next 12 months</h2>
            <p className="text-xs text-ink-3">Forecast to {day(ahead.end.date)}</p>
          </div>
          <Stat
            label={ahead.basisMonths >= 1 ? `Trend · last ${Math.round(ahead.basisMonths)} mo` : "Trend"}
            value={ahead.basisMonths >= 1 ? `${signedMoney(ahead.monthly, cur)} / mo` : "Not enough history"}
            cls={tone(ahead.monthly)}
          />
          <Stat label="On trend" value={money(ahead.end.trend, cur)} />
          {planDue > 0 && <Stat label="Plan costs due" value={`−${money(planDue, cur)}`} cls="text-miss-text" />}
          {planDue > 0 && <Stat label="After plan costs" value={money(ahead.end.afterPlans, cur)} cls={ahead.end.afterPlans < 0 ? "text-miss-text" : ""} />}
        </div>
        <ForecastChart points={ahead.points} today={today} currency={cur} withPlans={planDue > 0} />
        {ahead.payments.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold text-ink-2">Plan payments in the next 12 months ({ahead.payments.length})</summary>
            <ul className="mt-2 divide-y divide-line">
              {ahead.payments.map((p, i) => (
                <li key={`${p.itemId}-${p.date}-${i}`} className="flex items-center gap-3 py-2">
                  <span className="num w-24 shrink-0 text-ink-3">{day(p.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{p.name}<span className="text-ink-3"> · {itemPlan.get(p.itemId)}</span></span>
                  <span className="num font-semibold">{money(p.amount, cur)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="mt-3 text-xs text-ink-3">
          The trend carries on the average monthly change in your total value over the last 12 months (or since your first record), money added or taken out included.
          {planDue > 0 && " The red line also takes off the payments in your plans as they fall due."} It is a forecast only: your assets are not changed.
        </p>
      </section>

      <AllocationBars byCategory={byCategory} byLiquidity={byLiquidity} currency={cur} />

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-baseline gap-x-3 p-4 sm:px-6">
          <h2 className="text-lg">Assets</h2>
          <p className="text-xs text-ink-3">Click a category to see its assets.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="eyebrow border-y border-line text-left">
                <th className="py-2 pl-4 sm:pl-6">Asset</th>
                <th className="py-2">Type</th>
                <th className="py-2">Liquidity</th>
                <th className="py-2 text-right">Cost</th>
                <th className="py-2 text-right">Value</th>
                <th className="py-2 pr-4 text-right sm:pr-6">Profit / loss</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <CollapsibleRows
                key={g.category.id}
                className="divide-y divide-line"
                span={3}
                label={
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: g.category.color }} />
                    {g.category.name}
                    <span className="text-xs font-normal text-ink-3">{g.rows.length} {g.rows.length === 1 ? "asset" : "assets"} · {totalValue > 0 ? `${((g.value / totalValue) * 100).toFixed(1)}%` : "—"} of total</span>
                  </span>
                }
                cells={<>
                  <td className="num py-2.5 text-right">{g.investment ? money(g.cost, cur) : "—"}</td>
                  <td className="num py-2.5 text-right">{money(g.value, cur)}</td>
                  {g.investment ? (
                    <td className={`num py-2.5 pr-4 text-right sm:pr-6 ${tone(g.pl)}`}>
                      {pct(g.cost > 0 ? g.pl / g.cost : null)}
                      <span className="block text-xs font-medium">{signedMoney(g.pl, cur)}</span>
                    </td>
                  ) : (
                    <td className="py-2.5 pr-4 text-right text-ink-3 sm:pr-6">—</td>
                  )}
                </>}
              >
              {g.rows.map((h) => (
                <tr key={h.account.id}>
                  <td className="py-3 pl-8 font-semibold sm:pl-10">
                    <Link href={`/accounts/${h.account.id}`}>{h.account.name}</Link>
                    <span className="block text-xs font-normal text-ink-3">Updated {day(h.lastDate)}</span>
                  </td>
                  <td className="py-3">{labelOf(TYPES, h.account.type)}</td>
                  <td className="py-3">{labelOf(LIQUIDITY, h.account.liquidity)}</td>
                  <td className="num py-3 text-right">{h.investment ? money(h.cost, cur) : "—"}</td>
                  <td className="num py-3 text-right font-semibold">{money(h.value, cur)}</td>
                  {h.pl === null ? (
                    <td className="py-3 pr-4 text-right text-ink-3 sm:pr-6">—</td>
                  ) : (
                    <td className={`num py-3 pr-4 text-right font-semibold sm:pr-6 ${tone(h.pl)}`}>
                      {pct(h.plPct)}
                      <span className="block text-xs font-medium">{signedMoney(h.pl, cur)}</span>
                    </td>
                  )}
                </tr>
              ))}
              </CollapsibleRows>
            ))}
            <tfoot>
              <tr className="border-t border-line font-bold">
                <td className="py-3 pl-4 sm:pl-6" colSpan={3}>Total <span className="text-xs font-normal text-ink-3">(cost and profit: investments only)</span></td>
                <td className="num py-3 text-right">{invs.length > 0 ? money(invCost, cur) : "—"}</td>
                <td className="num py-3 text-right">{money(totalValue, cur)}</td>
                {invs.length > 0 ? (
                  <td className={`num py-3 pr-4 text-right sm:pr-6 ${tone(invPl)}`}>
                    {pct(invPlPct)}
                    <span className="block text-xs font-medium">{signedMoney(invPl, cur)}</span>
                  </td>
                ) : (
                  <td className="py-3 pr-4 text-right text-ink-3 sm:pr-6">—</td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

    </div>
  );
}

function Stat({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={`num font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
