import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import AccountForm from "@/components/AccountForm";
import Sparkline from "@/components/Sparkline";
import { listAccounts, listCategories, listEntries, listPrices, listTrades } from "@/lib/data";
import { day, money, pct } from "@/lib/format";
import { extendTo, netWorthSeries, periodStart, totalPerformance, type Point } from "@/lib/performance";
import { accountEntries, holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { labelOf, LIQUIDITY, TYPES } from "@/lib/types";

export const metadata: Metadata = { title: "Assets" };

export default async function AccountsPage() {
  const user = await requireUser();
  const [accounts, entries, categories, trades, prices] = await Promise.all([
    listAccounts(user.id, true), listEntries(user.id), listCategories(user.id), listTrades(user.id), listPrices(user.id),
  ]);
  const held = holdings(accounts, entries, trades, prices);
  const cur = user.currency;
  const valueOf = (id: number) => held.find((h) => h.account.id === id)?.value ?? 0;

  // Each asset's last 6 months for its small chart, coloured by how it performed (money in or out set aside).
  const today = new Date().toISOString().slice(0, 10);
  const from = periodStart("6M", today)!;
  // The same for a category, from its assets combined (those counted in its sum).
  const trendOf = (members: (typeof accounts)[number][]) => {
    const lists = members.map((a) => accountEntries(a, entries, trades, prices)).filter((l) => l.length > 0);
    if (lists.length === 0) return null;
    const first = lists.map((l) => l[0].date).sort()[0];
    const start = first > from ? null : from;
    const points = extendTo(netWorthSeries(lists, start, today), today);
    const perf = totalPerformance(lists, start ?? first, today);
    const tone = Math.abs(perf.gain) < 0.005 ? ("flat" as const) : perf.gain > 0 ? ("up" as const) : ("down" as const);
    return { points, tone, returnPct: perf.returnPct, since: start ?? first };
  };

  // One group per category with assets, in the categories' own order; archived assets are listed but not summed.
  const active = accounts.filter((a) => !a.archived);
  const archivedCount = accounts.length - active.length;
  const total = active.reduce((s, a) => s + valueOf(a.id), 0);
  const groups = categories
    .map((category) => {
      const members = accounts.filter((a) => a.categoryId === category.id).sort((x, y) => Number(x.archived) - Number(y.archived));
      const counted = members.filter((a) => !a.archived);
      const sum = counted.reduce((s, a) => s + valueOf(a.id), 0);
      return { category, members, sum, headTrend: trendOf(counted) };
    })
    .filter((g) => g.members.length > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Assets" }]} />
      <h1 className="text-3xl">Assets</h1>
      {accounts.length > 0 && (
        <>
          <p className="text-sm text-ink-3">
            Total <span className="num font-semibold text-ink">{money(total, cur)}</span> across {active.length} {active.length === 1 ? "asset" : "assets"}
            {archivedCount > 0 && <> · {archivedCount} archived, not counted</>}
          </p>
          <p className="-mt-3 hidden text-xs text-ink-3 sm:block">Each small chart shows the last 6 months: green for a gain, red for a loss, with money added or taken out set aside.</p>
          {groups.map(({ category, members, sum, headTrend }) => (
            <section key={category.id} className="card divide-y divide-line overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <span className="size-3 shrink-0 rounded-full" style={{ background: category.color }} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg">{category.name}</h2>
                  <p className="text-xs text-ink-3">{labelOf(TYPES, category.type)} · {members.length} {members.length === 1 ? "asset" : "assets"}</p>
                </div>
                {headTrend && <Trend trend={headTrend} name={category.name} />}
                <div className="w-36 shrink-0 text-right sm:w-44">
                  <p className="num text-lg font-bold">{money(sum, cur)}</p>
                  {total > 0 && <p className="num text-xs text-ink-3">{((sum / total) * 100).toFixed(1)}% of total</p>}
                </div>
              </div>
              {members.map((a) => {
                const latest = held.find((x) => x.account.id === a.id);
                const trend = trendOf([a]);
                return (
                  <Link key={a.id} href={`/accounts/${a.id}`} className={`flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2 sm:px-6 ${a.archived ? "opacity-60" : ""}`}>
                    <div className="min-w-0 flex-1 pl-6">
                      <p className="truncate font-semibold">{a.name}{a.archived && <span className="ml-2 text-xs font-medium text-ink-3">archived</span>}</p>
                      <p className="text-xs text-ink-3">{labelOf(LIQUIDITY, a.liquidity)}</p>
                    </div>
                    {trend && <Trend trend={trend} name={a.name} />}
                    <div className="w-36 shrink-0 text-right sm:w-44">
                      <p className="num font-semibold">{latest ? money(latest.value, cur) : "Nothing recorded yet"}</p>
                      {latest && <p className="text-xs text-ink-3">{day(latest.lastDate)}</p>}
                    </div>
                  </Link>
                );
              })}
            </section>
          ))}
        </>
      )}
      <AccountForm categories={categories} />
    </div>
  );
}

/** The small chart and the return beside it, for an asset or a category. Hidden on narrow screens. */
function Trend({ trend, name }: { trend: { points: Point[]; tone: "up" | "down" | "flat"; returnPct: number | null; since: string }; name: string }) {
  const word = trend.tone === "up" ? "gain" : trend.tone === "down" ? "loss" : "no change";
  return (
    <div className="hidden shrink-0 items-center gap-2 sm:flex" title={`Since ${day(trend.since)}`}>
      <Sparkline points={trend.points} tone={trend.tone} label={`${name}, since ${day(trend.since)}: ${word}${trend.returnPct !== null ? ` of ${pct(trend.returnPct)}` : ""}`} />
      <span className={`num w-14 text-right text-xs font-semibold ${trend.tone === "up" ? "text-go-text" : trend.tone === "down" ? "text-miss-text" : "text-ink-3"}`}>
        {pct(trend.returnPct)}
      </span>
    </div>
  );
}
