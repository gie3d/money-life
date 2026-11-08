import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import ForecastChart from "@/components/ForecastChart";
import PieCard from "@/components/PieCard";
import { listAccounts, listCategories, listEntries, listPlanItems, listPlans, listPrices, listTrades } from "@/lib/data";
import { day, money, pct, signedMoney, tone } from "@/lib/format";
import { colorFor } from "@/lib/palette";
import { extendTo, netWorthSeries } from "@/lib/performance";
import { forecast } from "@/lib/forecast";
import { payments } from "@/lib/plan";
import { accountEntries, holdings, slices } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { labelOf, LIQUIDITY, TYPES } from "@/lib/types";

export default async function Overview() {
  const user = await requireUser();
  const cur = user.currency;

  const [accounts, entries, categories, trades, prices, plans, planItems] = await Promise.all([
    listAccounts(user.id), listEntries(user.id), listCategories(user.id), listTrades(user.id), listPrices(user.id),
    listPlans(user.id), listPlanItems(user.id),
  ]);
  const categoryOrder = categories.map((c) => ({ id: String(c.id), label: c.name }));
  const categoryColor = new Map(categories.map((c) => [String(c.id), c.color]));
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

  const paint = (list: ReturnType<typeof slices>, order: readonly { id: string }[]) =>
    list.map((s) => ({ ...s, color: colorFor(s.id, order) }));
  const byCategory = (metric: (h: (typeof rows)[number]) => number) =>
    slices(rows, (h) => String(h.account.categoryId), metric, categoryOrder).map((sl) => ({ ...sl, color: categoryColor.get(sl.id) ?? "#8e8e93" }));

  // Where the total value is heading: the last 12 months' average change carried on, less plan payments.
  // Plans are only subtracted here, in the forecast; nothing is ever taken out of an asset.
  const lists = rows.map((h) => accountEntries(h.account, entries, trades, prices));
  const today = new Date().toISOString().slice(0, 10);
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const itemPlan = new Map(planItems.map((i) => [i.id, planName.get(i.planId) ?? ""]));
  const ahead = forecast(extendTo(netWorthSeries(lists, null, today), today), today, payments(planItems));
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

      <section className="card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="mr-auto">
            <h2 className="text-lg">Next 6 months</h2>
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
            <summary className="cursor-pointer font-semibold text-ink-2">Plan payments in the next 6 months ({ahead.payments.length})</summary>
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

      <div className="grid gap-5 md:grid-cols-3">
        <PieCard title="Category by cost" subtitle="Money put in; cash and saving at their balance" slices={byCategory((h) => h.cost)} currency={cur} />
        <PieCard title="Category by value" subtitle="What it is worth now" slices={byCategory((h) => h.value)} currency={cur} />
        <PieCard
          title="Liquidity"
          subtitle="How fast it turns into cash"
          slices={paint(slices(rows, (h) => h.account.liquidity, (h) => h.value, LIQUIDITY), LIQUIDITY)}
          currency={cur}
        />
      </div>

      <section className="card overflow-hidden">
        <h2 className="p-4 text-lg sm:px-6">Assets</h2>
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
              <tbody key={g.category.id} className="divide-y divide-line">
                <tr className="bg-surface-2 font-bold">
                  <td className="py-2.5 pl-4 sm:pl-6" colSpan={3}>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: g.category.color }} />
                      {g.category.name}
                      <span className="text-xs font-normal text-ink-3">{g.rows.length} {g.rows.length === 1 ? "asset" : "assets"} · {totalValue > 0 ? `${((g.value / totalValue) * 100).toFixed(1)}%` : "—"} of total</span>
                    </span>
                  </td>
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
                </tr>
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
              </tbody>
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
