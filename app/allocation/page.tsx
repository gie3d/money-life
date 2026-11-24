import type { Metadata } from "next";
import Link from "next/link";
import SectionTabs from "@/components/SectionTabs";
import AllocationBars, { type AllocationRow } from "@/components/AllocationBars";
import AllocationChart, { type AllocationPoint, type AllocationSeries } from "@/components/AllocationChart";
import { listAccounts, listCategories, listEntries, listPrices, listTrades } from "@/lib/data";
import { money } from "@/lib/format";
import { colorFor } from "@/lib/palette";
import { accountEntries, holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { LIQUIDITY } from "@/lib/types";

export const metadata: Metadata = { title: "Allocation" };

const DAY = 86_400_000;

/** Where the money sits now, by category or liquidity, and how that mix has moved month by month. Archived assets are left out. */
export default async function AllocationPage() {
  const user = await requireUser();
  const [accounts, entries, categories, trades, prices] = await Promise.all([
    listAccounts(user.id), listEntries(user.id), listCategories(user.id), listTrades(user.id), listPrices(user.id),
  ]);
  const cur = user.currency;
  const today = new Date().toISOString().slice(0, 10);
  const held = holdings(accounts, entries, trades, prices);
  const total = held.reduce((s, h) => s + h.value, 0);
  // Categories with assets, in the categories' own order.
  const used = categories.filter((c) => accounts.some((a) => a.categoryId === c.id));

  // Now: value per category or liquidity group, with what the investments in it cost.
  const allocation = (members: typeof held, id: string, label: string, color: string, target: number | null = null): AllocationRow => {
    const inv = members.filter((h) => h.investment);
    return { id, label, color, target, value: members.reduce((s, h) => s + h.value, 0), cost: inv.length > 0 ? inv.reduce((s, h) => s + h.cost, 0) : null };
  };
  // A category with a target stays on the list when empty: all of its target is still to fill.
  const byCategory = used
    .map((c) => allocation(held.filter((h) => h.account.categoryId === c.id), String(c.id), c.name, c.color, c.target))
    .filter((r) => r.value !== 0 || (r.target ?? 0) > 0);
  const byLiquidity = LIQUIDITY
    .map((l) => allocation(held.filter((h) => h.account.liquidity === l.id), l.id, l.label, colorFor(l.id, LIQUIDITY)))
    .filter((r) => r.value !== 0);

  // Over time: each group's value at the end of every month since the first record, then today.
  const lists = new Map(accounts.map((a) => [a.id, [...accountEntries(a, entries, trades, prices)].sort((x, y) => x.date.localeCompare(y.date))]));
  const firstDate = [...lists.values()].flat().reduce((m, e) => (e.date < m ? e.date : m), today);
  const dates: string[] = [];
  for (let d = new Date(`${firstDate.slice(0, 7)}-01T00:00:00Z`); ; ) {
    d.setUTCMonth(d.getUTCMonth() + 1);
    const end = new Date(d.getTime() - DAY).toISOString().slice(0, 10);
    if (end >= today) break;
    dates.push(end);
  }
  dates.push(today);
  const worthOn = (id: number, date: string) => {
    let v = 0;
    for (const e of lists.get(id) ?? []) if (e.date <= date) v = e.value; else break;
    return v;
  };
  const overTime = (groups: AllocationSeries[], inGroup: (a: (typeof accounts)[number], id: string) => boolean) => {
    const members = new Map(groups.map((g) => [g.id, accounts.filter((a) => inGroup(a, g.id))]));
    const points = dates.map((date) => {
      const p: AllocationPoint = { date };
      for (const g of groups) p[g.id] = Math.max(0, (members.get(g.id) ?? []).reduce((sum, a) => sum + worthOn(a.id, date), 0));
      return p;
    });
    // A group that held nothing at any point has no band to draw.
    return { series: groups.filter((g) => points.some((p) => Number(p[g.id]) > 0)), points };
  };
  const historyByCategory = overTime(used.map((c) => ({ id: String(c.id), label: c.name, color: c.color })), (a, id) => String(a.categoryId) === id);
  const historyByLiquidity = overTime(LIQUIDITY.map((l) => ({ id: l.id, label: l.label, color: colorFor(l.id, LIQUIDITY) })), (a, id) => a.liquidity === id);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <SectionTabs section="assets" current="/allocation" />
      <div>
        <h1 className="text-3xl">Allocation</h1>
        {accounts.length > 0 && (
          <p className="mt-1 text-sm text-ink-3">
            Where your <span className="num font-semibold text-ink">{money(total, cur)}</span> sits, and how that has changed. Archived assets aren&apos;t counted.
          </p>
        )}
      </div>
      {accounts.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-ink-3">No assets yet.</p>
          <Link href="/welcome" className="btn mt-4">Set up my assets</Link>
        </div>
      ) : (
        <>
          <AllocationBars byCategory={byCategory} byLiquidity={byLiquidity} currency={cur} />
          <AllocationChart byCategory={historyByCategory} byLiquidity={historyByLiquidity} currency={cur} today={today} />
        </>
      )}
    </div>
  );
}
