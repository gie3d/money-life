import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import ChartToggle from "@/components/ChartToggle";
import NetWorthChart from "@/components/NetWorthChart";
import { listAccounts, listCategories, listEntries, listPrices, listTrades } from "@/lib/data";
import { day, money, pct, signedMoney, tone } from "@/lib/format";
import { colorFor } from "@/lib/palette";
import { accountPerformance, chartYears, extendTo, netWorthSeries, periodStart, PERIODS, totalPerformance, type Performance, type Period } from "@/lib/performance";
import { accountEntries, holdings, type Holding } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { labelOf, LIQUIDITY } from "@/lib/types";

export const metadata: Metadata = { title: "Performance" };

export default async function PerformancePage({ searchParams }: PageProps<"/performance">) {
  const user = await requireUser();
  const sp = await searchParams;
  const requested = (PERIODS.find((p) => p.id === sp.period)?.id ?? "3M") as Period;
  const cur = user.currency;

  const [accounts, entries, trades, prices, categories] = await Promise.all([
    listAccounts(user.id), listEntries(user.id), listTrades(user.id), listPrices(user.id), listCategories(user.id),
  ]);
  const rows = holdings(accounts, entries, trades, prices);

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <Breadcrumb items={[{ label: "Performance" }]} />
        <div className="card p-8 text-center">
          <h1 className="text-2xl">Nothing to measure yet</h1>
          <p className="mx-auto mt-2 max-w-md text-ink-3">Add an asset and record what it is worth from time to time; how it performs shows up here.</p>
          <Link href="/accounts" className="btn mt-6">Add your first asset</Link>
        </div>
      </div>
    );
  }

  const invs = rows.filter((h) => h.investment);
  // Investments unticked in the table are left out of the charts and the figures above them.
  const hidden = String(sp.hide ?? "").split(",").map(Number).filter((id) => invs.some((h) => h.account.id === id));
  const shown = (h: Holding) => !(h.investment && hidden.includes(h.account.id));

  // Period view: how the money performed, with deposits taken out.
  const lists = rows.map((h) => accountEntries(h.account, entries, trades, prices));
  const today = new Date().toISOString().slice(0, 10);
  const firstDate = lists.flat().map((e) => e.date).sort()[0];
  // A range ending today, or one calendar year (to today for the current one).
  const years = chartYears(firstDate, today);
  const year = years.find((y) => String(y) === sp.year);
  const period = year ? null : requested;
  const from = year ? `${year}-01-01` : periodStart(requested, today);
  const end = year && `${year}-12-31` < today ? `${year}-12-31` : today;
  // Never reach back past the first record: a "1Y" view of a 2-month-old tracker is 2 months.
  const start = from && from > firstDate ? from : firstDate;
  const chartLists = lists.filter((_, i) => shown(rows[i]));
  const chartInvLists = lists.filter((_, i) => rows[i].investment && shown(rows[i]));
  const perf = totalPerformance(chartInvLists, start, end);
  const series = extendTo(netWorthSeries(chartLists, start, end), end);
  const invSeries = extendTo(netWorthSeries(chartInvLists, start, end), end);
  // Investments over the same window, one row per asset, category or liquidity, leaving out any not held at all during it.
  // Cash and saving are left out: their balances don't record money paid in, so a deposit would read as gain.
  const by = GROUPINGS.find((g) => g.id === sp.by)?.id ?? "asset";
  const held = (p: ReturnType<typeof totalPerformance>) => p.start !== 0 || p.end !== 0 || p.contributions !== 0;
  const invIdx = rows.map((h, i) => (h.investment ? i : -1)).filter((i) => i >= 0);
  const group = (key: (h: (typeof rows)[number]) => string): PerfRow[] => {
    const keys = [...new Set(invIdx.map((i) => key(rows[i])))];
    return keys.map((k) => {
      const members = invIdx.filter((i) => key(rows[i]) === k);
      return { key: k, members: members.map((i) => rows[i]), p: totalPerformance(members.map((i) => lists[i]), start, end) };
    }).filter((r) => r.members.length > 0) as PerfRow[];
  };
  const perfRows = (
    by === "asset"
      ? invIdx.map((i) => ({ key: String(rows[i].account.id), members: [rows[i]], p: accountPerformance(lists[i], start, end) }))
          .filter((r): r is PerfRow => r.p !== null)
      : by === "category"
        ? group((h) => String(h.account.categoryId))
        : group((h) => h.account.liquidity)
  )
    .filter((r) => held(r.p))
    .sort((a, b) => (by === "liquidity"
      ? LIQUIDITY.findIndex((l) => l.id === a.key) - LIQUIDITY.findIndex((l) => l.id === b.key)
      : b.p.gain - a.p.gain));
  // In the asset view, assets sit under their category (in the categories' own order) with its subtotal.
  const assetGroups = by !== "asset" ? [] : categories
    .map((category) => {
      const assets = perfRows.filter((r) => r.members[0].account.categoryId === category.id);
      const idx = invIdx.filter((i) => rows[i].account.categoryId === category.id);
      return { category, assets, p: totalPerformance(idx.map((i) => lists[i]), start, end) };
    })
    .filter((g) => g.assets.length > 0);
  const windowQuery = year ? `year=${year}` : `period=${period}`;
  const hideQuery = hidden.length > 0 ? `&hide=${hidden.join(",")}` : "";
  const byQuery = (by === "asset" ? "" : `&by=${by}`) + hideQuery;
  // What a tick box keeps of the address when it changes the selection.
  const keep = `${windowQuery}${by === "asset" ? "" : `&by=${by}`}`;
  const toggle = (members: Holding[], label: string) => (
    <ChartToggle ids={members.map((h) => h.account.id)} hidden={hidden} query={keep} label={label} />
  );
  const off = (members: Holding[]) => members.every((h) => hidden.includes(h.account.id));

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div>
        <Breadcrumb items={[{ label: "Performance" }]} />
        <h1 className="mt-2 text-3xl">Performance</h1>
        <p className="mt-1 text-sm text-ink-3">How your assets did over a range or a calendar year, with money you put in or took out set aside.</p>
      </div>

      <nav className="flex items-center gap-1.5 overflow-x-auto" aria-label="Period">
        {PERIODS.map((p) => (
          <Link key={p.id} href={`/performance?period=${p.id}${byQuery}`} scroll={false} aria-current={p.id === period ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${p.id === period ? "bg-ink text-surface" : "bg-surface text-ink-3"}`}>
            {p.label}
          </Link>
        ))}
        <span className="mx-1.5 h-5 w-px shrink-0 bg-line" aria-hidden />
        {years.map((y) => (
          <Link key={y} href={`/performance?year=${y}${byQuery}`} scroll={false} aria-current={y === year ? "page" : undefined}
            className={`num shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${y === year ? "bg-ink text-surface" : "bg-surface text-ink-3"}`}>
            {y}
          </Link>
        ))}
      </nav>

      <section className="card p-4 sm:p-6">
        <h2 className="mb-3 text-lg">{year ? `Total value in ${year}` : `Total value since ${day(start)}`}</h2>
        <NetWorthChart data={series} currency={cur} title="Total value" />
      </section>

      {invs.length > 0 && (
        <section className="card p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <h2 className="mr-auto text-lg">{year ? `Investment performance in ${year}` : "Investment performance"}</h2>
            <Stat label="Net in / out" value={signedMoney(perf.contributions, cur)} />
            <Stat label="Gain" value={signedMoney(perf.gain, cur)} cls={tone(perf.gain)} />
            <Stat label="Return" value={pct(perf.returnPct)} cls={tone(perf.returnPct ?? 0)} />
          </div>
          <NetWorthChart data={invSeries} currency={cur} title="Investment performance" showCost />
          <p className="mt-2 text-xs text-ink-3">The dashed line is what the units you still hold cost, fees included; the gap above it is profit. Return is time-weighted, so it differs from the profit on cost above.</p>
        </section>
      )}

      {perfRows.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-4 sm:px-6">
            <h2 className="mr-auto text-lg">{year ? `Performance in ${year}` : `Performance since ${day(start)}`}</h2>
            <nav role="group" aria-label="Group by" className="flex gap-1 rounded-full bg-surface-2 p-1">
              {GROUPINGS.map((g) => (
                <Link key={g.id} href={`/performance?${windowQuery}${g.id === "asset" ? "" : `&by=${g.id}`}${hideQuery}`} scroll={false} aria-current={g.id === by ? "true" : undefined}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${g.id === by ? "bg-ink text-surface" : "text-ink-3"}`}>
                  {g.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="eyebrow border-y border-line text-left">
                  <th className="w-10 py-2 pl-4 sm:pl-6">{toggle(invs, "Show all investments in the charts")}</th>
                  <th className="py-2">{GROUPINGS.find((g) => g.id === by)!.column}</th>
                  <th className="py-2 text-right">Value at start</th>
                  <th className="py-2 text-right">Net in / out</th>
                  <th className="py-2 text-right">Value at end</th>
                  <th className="py-2 text-right">Gain</th>
                  <th className="py-2 pr-4 text-right sm:pr-6">Return</th>
                </tr>
              </thead>
              {by === "asset" ? (
                assetGroups.map((g) => (
                  <tbody key={g.category.id} className="divide-y divide-line">
                    <tr className={`bg-surface-2 font-bold ${off(g.assets.flatMap((a) => a.members)) ? "text-ink-3" : ""}`}>
                      <td className="py-2.5 pl-4 sm:pl-6">{toggle(g.assets.flatMap((a) => a.members), `Show ${g.category.name} in the charts`)}</td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: g.category.color }} />
                          {g.category.name}
                          <span className="text-xs font-normal text-ink-3">{g.assets.length} {g.assets.length === 1 ? "asset" : "assets"}</span>
                        </span>
                      </td>
                      <PerfCells p={g.p} cur={cur} />
                    </tr>
                    {g.assets.map(({ key, members, p }) => (
                      <tr key={key} className={off(members) ? "text-ink-3" : ""}>
                        <td className="py-3 pl-4 sm:pl-6">{toggle(members, `Show ${members[0].account.name} in the charts`)}</td>
                        <td className="py-3 pl-6 font-semibold">
                          <Link href={`/accounts/${members[0].account.id}${year ? `?year=${year}` : ""}`}>{members[0].account.name}</Link>
                        </td>
                        <PerfCells p={p} cur={cur} strong />
                      </tr>
                    ))}
                  </tbody>
                ))
              ) : (
                <tbody className="divide-y divide-line">
                  {perfRows.map(({ key, members, p }) => {
                    const first = members[0].account;
                    const count = `${members.length} ${members.length === 1 ? "asset" : "assets"}`;
                    return (
                      <tr key={key} className={off(members) ? "text-ink-3" : ""}>
                        <td className="py-3 pl-4 sm:pl-6">{toggle(members, `Show ${by === "category" ? first.categoryName : labelOf(LIQUIDITY, key)} in the charts`)}</td>
                        <td className="py-3 font-semibold">
                          <span className="inline-flex items-center gap-2">
                            <span className="size-2.5 rounded-full" style={{ background: by === "category" ? first.categoryColor : colorFor(key, LIQUIDITY) }} />
                            {by === "category" ? first.categoryName : labelOf(LIQUIDITY, key)}
                          </span>
                          <span className="block text-xs font-normal text-ink-3" title={members.map((h) => h.account.name).join(", ")}>{count}</span>
                        </td>
                        <PerfCells p={p} cur={cur} strong />
                      </tr>
                    );
                  })}
                </tbody>
              )}
              <tfoot>
                <tr className="border-t border-line font-bold">
                  <td className="py-3 pl-4 sm:pl-6" colSpan={2}>{hidden.length > 0 ? "Selected investments" : "All investments"}</td>
                  <td className="num py-3 text-right">{money(perf.start, cur)}</td>
                  <td className="num py-3 text-right">{signedMoney(perf.contributions, cur)}</td>
                  <td className="num py-3 text-right">{money(perf.end, cur)}</td>
                  <td className={`num py-3 text-right ${tone(perf.gain)}`}>{signedMoney(perf.gain, cur)}</td>
                  <td className={`num py-3 pr-4 text-right sm:pr-6 ${tone(perf.returnPct ?? 0)}`}>{pct(perf.returnPct)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="space-y-1.5 px-4 pb-4 pt-2 text-xs text-ink-3 sm:px-6">
            <p>Investments only (cash and savings don&apos;t record money in or out, so a deposit would look like gain). Untick a row to leave it out of the charts above and the totals; cash and savings always count in the Total value chart.</p>
            <ul className="list-disc space-y-1 pl-4">
              <li><span className="font-semibold text-ink-2">Value at start</span>: what it was worth when the period began, from the last value recorded on or before that day. For an asset first recorded inside the period, its first value.</li>
              <li><span className="font-semibold text-ink-2">Net in / out</span>: what you bought minus what you got from sales during the period. Negative means you took money out.</li>
              <li><span className="font-semibold text-ink-2">Value at end</span>: what it was worth at the end of the period, at the last price known by then.</li>
              <li><span className="font-semibold text-ink-2">Gain</span>: how much it grew by itself: value at end, minus value at start, minus net in / out. Buying or selling doesn&apos;t count as gain or loss.</li>
              <li><span className="font-semibold text-ink-2">Return</span>: gain as a percentage of the money that was invested, counting money added or taken out partway through only for the time it was in. A row with no value at the start shows &ldquo;—&rdquo;.</li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

const GROUPINGS = [
  { id: "asset", label: "Asset", column: "Asset" },
  { id: "category", label: "Category", column: "Category" },
  { id: "liquidity", label: "Liquidity", column: "Liquidity" },
] as const;

type PerfRow = { key: string; members: Holding[]; p: Performance };

/** The five figures of a performance row: start, net in / out, end, gain and return. */
function PerfCells({ p, cur, strong = false }: { p: Performance; cur: string; strong?: boolean }) {
  const py = strong ? "py-3" : "py-2.5";
  return (
    <>
      <td className={`num ${py} text-right`}>{money(p.start, cur)}</td>
      <td className={`num ${py} text-right`}>{signedMoney(p.contributions, cur)}</td>
      <td className={`num ${py} text-right ${strong ? "font-semibold" : ""}`}>{money(p.end, cur)}</td>
      <td className={`num ${py} text-right ${strong ? "font-semibold" : ""} ${tone(p.gain)}`}>{signedMoney(p.gain, cur)}</td>
      <td className={`num ${py} pr-4 text-right sm:pr-6 ${strong ? "font-semibold" : ""} ${tone(p.returnPct ?? 0)}`}>{pct(p.returnPct)}</td>
    </>
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
