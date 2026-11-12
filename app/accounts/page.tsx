import type { Metadata } from "next";
import Link from "next/link";
import SectionTabs from "@/components/SectionTabs";
import AccountForm from "@/components/AccountForm";
import AllocationBars, { type AllocationRow } from "@/components/AllocationBars";
import Info from "@/components/Info";
import TrendCell from "@/components/TrendCell";
import { listAccounts, listCategories, listEntries, listPrices, listTrades } from "@/lib/data";
import { day, money, pct, signedMoney, tone } from "@/lib/format";
import { colorFor } from "@/lib/palette";
import { sixMonthTrend } from "@/lib/trend";
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

  // Each asset's (and category's) last 6 months for its small chart, coloured by how it performed.
  const today = new Date().toISOString().slice(0, 10);
  const trendOf = (members: (typeof accounts)[number][]) => sixMonthTrend(members.map((a) => accountEntries(a, entries, trades, prices)), today);

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

  // Where the money sits: value per category or liquidity group, with what the investments in it cost.
  const counted = held.filter((h) => !h.account.archived);
  const allocation = (members: typeof held, id: string, label: string, color: string): AllocationRow => {
    const inv = members.filter((h) => h.investment);
    return { id, label, color, value: members.reduce((s, h) => s + h.value, 0), cost: inv.length > 0 ? inv.reduce((s, h) => s + h.cost, 0) : null };
  };
  const byCategory = groups
    .map((g) => allocation(counted.filter((h) => h.account.categoryId === g.category.id), String(g.category.id), g.category.name, g.category.color))
    .filter((r) => r.value !== 0);
  const byLiquidity = LIQUIDITY
    .map((l) => allocation(counted.filter((h) => h.account.liquidity === l.id), l.id, l.label, colorFor(l.id, LIQUIDITY)))
    .filter((r) => r.value !== 0);
  const invs = counted.filter((h) => h.investment);
  const invCost = invs.reduce((s, h) => s + h.cost, 0);
  const invPl = invs.reduce((s, h) => s + h.value, 0) - invCost;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <SectionTabs section="assets" current="/accounts" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl">Assets</h1>
        <Link href="#new-asset" className="btn btn-quiet">+ Add an asset</Link>
      </div>
      {accounts.length > 0 && (
        <>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-3">
            <span>Total <span className="num font-semibold text-ink">{money(total, cur)}</span> across {active.length} {active.length === 1 ? "asset" : "assets"}</span>
            {invs.length > 0 && <span>· investments <span className={`num font-semibold ${tone(invPl)}`}>{signedMoney(invPl, cur)} ({pct(invCost > 0 ? invPl / invCost : null)})</span></span>}
            {archivedCount > 0 && <span>· {archivedCount} archived, not counted</span>}
            <Info label="About the small charts">Each small chart starts on the date at its left, the last 6 months or the day an asset first held anything. The percentage and the amount beside it are the change since that date: green for a gain, red for a loss, with money added or taken out set aside. The investments total above is different: value against what they cost, fees included.</Info>
          </p>
          {groups.map(({ category, members, sum, headTrend }) => (
            <section key={category.id} className="card divide-y divide-line overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <span className="size-3 shrink-0 rounded-full" style={{ background: category.color }} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg">{category.name}</h2>
                  <p className="text-xs text-ink-3">{labelOf(TYPES, category.type)} · {members.length} {members.length === 1 ? "asset" : "assets"}</p>
                </div>
                {headTrend && <TrendCell trend={headTrend} name={category.name} />}
                <div className="w-36 shrink-0 text-right sm:w-44">
                  <p className="num text-lg font-bold">{money(sum, cur)}</p>
                  <p className="num text-xs text-ink-3">
                    {headTrend && <span className={`font-semibold ${tone(headTrend.gain)}`} title={`Since ${day(headTrend.since)}`}>{signedMoney(headTrend.gain, cur)}{total > 0 && " · "}</span>}
                    {total > 0 && `${((sum / total) * 100).toFixed(1)}% of total`}
                  </p>
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
                    {trend && <TrendCell trend={trend} name={a.name} />}
                    <div className="w-36 shrink-0 text-right sm:w-44">
                      <p className="num font-semibold">{latest ? money(latest.value, cur) : "Nothing recorded yet"}</p>
                      {latest && (
                        <p className="num text-xs text-ink-3">
                          {trend && <span className={`font-semibold ${tone(trend.gain)}`} title={`Since ${day(trend.since)}`}>{signedMoney(trend.gain, cur)} · </span>}
                          {day(latest.lastDate)}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </section>
          ))}
          {byCategory.length > 1 && <AllocationBars byCategory={byCategory} byLiquidity={byLiquidity} currency={cur} />}
        </>
      )}
      <AccountForm categories={categories} />
    </div>
  );
}

