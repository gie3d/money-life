import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import NetWorthChart from "@/components/NetWorthChart";
import UpdateValues, { type ValueRow } from "@/components/UpdateValues";
import PieCard from "@/components/PieCard";
import { listAccounts, listCategories, listEntries, listPrices, listTrades } from "@/lib/data";
import { day, money, pct, signedMoney, tone } from "@/lib/format";
import { colorFor } from "@/lib/palette";
import { extendTo, netWorthSeries, periodStart, PERIODS, totalPerformance, type Period } from "@/lib/performance";
import { accountEntries, holdings, slices } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { isInvestment, labelOf, LIQUIDITY, TYPES } from "@/lib/types";

export default async function Overview({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = (PERIODS.find((p) => p.id === sp.period)?.id ?? "3M") as Period;
  const cur = user.currency;

  const [accounts, entries, categories, trades, prices] = await Promise.all([
    listAccounts(user.id), listEntries(user.id), listCategories(user.id), listTrades(user.id), listPrices(user.id),
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

  // One row per asset that can be given a new value: any cash or saving balance, and any investment with units.
  const valueRows: ValueRow[] = accounts.flatMap((a) => {
    const h = rows.find((x) => x.account.id === a.id);
    if (isInvestment(a) && !h) return [];
    return [{
      id: a.id,
      name: a.name,
      color: a.categoryColor,
      investment: isInvestment(a),
      units: h?.quantity ?? null,
      current: h ? (h.investment ? h.price : h.value) : null,
    }];
  });

  const totalValue = rows.reduce((s, h) => s + h.value, 0);
  // Profit and loss exist only for investments; cash and saving are just a balance.
  const invs = rows.filter((h) => h.investment);
  const invValue = invs.reduce((s, h) => s + h.value, 0);
  const invCost = invs.reduce((s, h) => s + h.cost, 0);
  const invPl = invValue - invCost;
  const invPlPct = invCost > 0 ? invPl / invCost : null;
  const realized = invs.reduce((s, h) => s + h.realized, 0);

  const paint = (list: ReturnType<typeof slices>, order: readonly { id: string }[]) =>
    list.map((s) => ({ ...s, color: colorFor(s.id, order) }));
  const byCategory = (metric: (h: (typeof rows)[number]) => number) =>
    slices(rows, (h) => String(h.account.categoryId), metric, categoryOrder).map((sl) => ({ ...sl, color: categoryColor.get(sl.id) ?? "#8e8e93" }));

  // Period view: how the money performed, with deposits taken out.
  const lists = rows.map((h) => accountEntries(h.account, entries, trades, prices));
  const invLists = lists.filter((_, i) => rows[i].investment);
  const today = new Date().toISOString().slice(0, 10);
  const firstDate = lists.flat().map((e) => e.date).sort()[0];
  const from = periodStart(period, today);
  // Never reach back past the first record: a "1Y" view of a 2-month-old tracker is 2 months.
  const start = from && from > firstDate ? from : firstDate;
  const perf = totalPerformance(invLists, start, today);
  const series = extendTo(netWorthSeries(lists, start, today), today);
  const invSeries = extendTo(netWorthSeries(invLists, start, today), today);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb items={[{ label: "Overview" }]} />
        <UpdateValues rows={valueRows} currency={cur} />
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
                <th className="py-2">Category</th>
                <th className="py-2">Type</th>
                <th className="py-2">Liquidity</th>
                <th className="py-2 text-right">Cost</th>
                <th className="py-2 text-right">Value</th>
                <th className="py-2 pr-4 text-right sm:pr-6">Profit / loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((h) => (
                <tr key={h.account.id}>
                  <td className="py-3 pl-4 font-semibold sm:pl-6">
                    <Link href={`/accounts/${h.account.id}`}>{h.account.name}</Link>
                    <span className="block text-xs font-normal text-ink-3">Updated {day(h.lastDate)}</span>
                  </td>
                  <td className="py-3"><span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: h.account.categoryColor }} />{h.account.categoryName}</span></td>
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
            <tfoot>
              <tr className="border-t border-line font-bold">
                <td className="py-3 pl-4 sm:pl-6" colSpan={4}>Total <span className="text-xs font-normal text-ink-3">(cost and profit: investments only)</span></td>
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

      <nav className="flex gap-1.5 overflow-x-auto" aria-label="Period">
        {PERIODS.map((p) => (
          <Link key={p.id} href={`/?period=${p.id}`} aria-current={p.id === period ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${p.id === period ? "bg-ink text-surface" : "bg-surface text-ink-3"}`}>
            {p.label}
          </Link>
        ))}
      </nav>

      <section className="card p-4 sm:p-6">
        <h2 className="mb-3 text-lg">Total value since {day(start)}</h2>
        <NetWorthChart data={series} currency={cur} title="Total value" />
      </section>

      {invs.length > 0 && (
        <section className="card p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <h2 className="mr-auto text-lg">Investment performance</h2>
            <Stat label="Paid in" value={signedMoney(perf.contributions, cur)} />
            <Stat label="Gain" value={signedMoney(perf.gain, cur)} cls={tone(perf.gain)} />
            <Stat label="Return" value={pct(perf.returnPct)} cls={tone(perf.returnPct ?? 0)} />
          </div>
          <NetWorthChart data={invSeries} currency={cur} title="Investment performance" showCost />
          <p className="mt-2 text-xs text-ink-3">The dashed line is what the units you still hold cost, fees included; the gap above it is profit. Return is time-weighted, so it differs from the profit on cost above.</p>
        </section>
      )}
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
