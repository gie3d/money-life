import type { Metadata } from "next";
import Link from "next/link";
import AllPlansChart, { type AllPlansRow } from "@/components/AllPlansChart";
import Breadcrumb from "@/components/Breadcrumb";
import PlanForm from "@/components/PlanForm";
import { listAccounts, listEntries, listPlanAssets, listPlanItems, listPlans, listPrices, listTrades } from "@/lib/data";
import { day, money, monthLabel, tone } from "@/lib/format";
import { finish, monthsText, payments, schedule } from "@/lib/plan";
import { holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Plans" };

export default async function PlansPage() {
  const user = await requireUser();
  const cur = user.currency;
  const [plans, items, funding, accounts, entries, trades, prices] = await Promise.all([
    listPlans(user.id), listPlanItems(user.id), listPlanAssets(user.id),
    listAccounts(user.id), listEntries(user.id), listTrades(user.id), listPrices(user.id),
  ]);
  const held = holdings(accounts, entries, trades, prices);
  const today = new Date().toISOString().slice(0, 10);
  const active = plans.filter((p) => !p.archived);
  const archivedCount = plans.length - active.length;

  // All active plans together: their payments in one schedule, drawn on the funds of every account any of them uses
  // (an account shared by two plans counts once) plus all their monthly savings.
  const PALETTE = ["#fd6217", "#2f7dd1", "#2a9d6f", "#8a5cd0", "#d1a22f", "#d14f8b", "#4b5d73", "#17a2b8"];
  const activeIds = new Set(active.map((p) => p.id));
  const planOf = new Map(items.map((i) => [i.id, i.planId]));
  const fundIds = new Set(active.flatMap((p) => funding.get(p.id) ?? []));
  const pooled = held.filter((h) => fundIds.has(h.account.id)).reduce((s, h) => s + h.value, 0);
  const saving = active.reduce((s, p) => s + p.monthlySaving, 0);
  const combined = schedule(payments(items.filter((i) => activeIds.has(i.planId))), pooled, saving, today);
  const series = active.map((p, i) => ({ key: `p${p.id}`, name: p.name, color: PALETTE[i % PALETTE.length] }));
  const chartRows = combined.rows.map((r) => {
    const row: AllPlansRow = { month: r.month, balance: r.balance };
    for (const p of active) row[`p${p.id}`] = r.payments.filter((x) => planOf.get(x.itemId) === p.id).reduce((s, x) => s + x.amount, 0);
    return row;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Plans" }]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Plans</h1>
          <p className="text-sm text-ink-3">Plan something you are going to pay for, and see if your assets cover it, month by month.</p>
        </div>
        {plans.length > 0 && (
          <Link href="/plans/all" className="text-sm font-semibold text-brand">
            All plans ({plans.length}{archivedCount > 0 ? `, ${archivedCount} archived` : ""}) →
          </Link>
        )}
      </div>

      {active.length === 0 && archivedCount > 0 && (
        <p className="text-sm text-ink-3">All your plans are archived. Open <Link href="/plans/all" className="font-semibold text-brand">All plans</Link> to bring one back.</p>
      )}

      {chartRows.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="mb-1 text-lg">All plans together</h2>
          <p className="mb-3 text-xs text-ink-3">
            Each bar is what you pay that month, split by plan. The line is the funds left after paying everything
            {pooled > 0 || saving > 0 ? <>, from {money(pooled, cur)} of chosen assets{saving > 0 && <> plus {money(saving, cur)} a month</>}</> : null}. Under the dashed zero line, the plans aren&apos;t covered yet.
            {combined.shortFrom && <span className="font-semibold text-miss-text"> Short from {monthLabel(combined.shortFrom)}.</span>}
          </p>
          <AllPlansChart rows={chartRows} series={series} currency={cur} />
        </section>
      )}

      {active.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {active.map((plan) => {
            const mine = items.filter((i) => i.planId === plan.id);
            const ids = new Set(funding.get(plan.id) ?? []);
            const funds = held.filter((h) => ids.has(h.account.id)).reduce((s, h) => s + h.value, 0);
            const s = schedule(payments(mine), funds, plan.monthlySaving, today);
            const all = payments(mine);
            const next = all.find((p) => p.date >= today);
            const end = finish(all, today);
            const paidShare = s.total > 0 ? (s.total - s.remaining) / s.total : 0;
            return (
              <Link key={plan.id} href={`/plans/${plan.id}`} className="card block space-y-3 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg">{plan.name}</h2>
                  <p className="num text-lg font-bold">{money(s.total, cur)}</p>
                </div>
                {mine.length === 0 ? (
                  <p className="text-sm text-ink-3">No costs yet. Open it to add some.</p>
                ) : (
                  <>
                    {end && (
                      <div className="space-y-1.5">
                        <p className="text-sm">
                          {end.done ? (
                            <span className="font-semibold text-go-text">Finished {day(end.date)}</span>
                          ) : (
                            <>Finishes <span className="font-semibold">{day(end.date)}</span><span className="text-ink-3"> · in {monthsText(end.monthsLeft)}</span></>
                          )}
                        </p>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${Math.round(paidShare * 100)}% paid`}>
                          <div className="h-full rounded-full bg-brand" style={{ width: `${paidShare * 100}%` }} />
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-ink-3">
                      {s.remaining > 0 ? <>Still to pay <span className="num font-semibold text-ink">{money(s.remaining, cur)}</span>{next && <> · next {day(next.date)}</>}</> : "Everything is already paid."}
                    </p>
                    {s.low && (
                      <p className={`text-sm font-semibold ${tone(s.low.balance)}`}>
                        {s.shortFrom ? `Short from ${monthLabel(s.shortFrom)} by up to ${money(-s.low.balance, cur)}` : `Covered, with ${money(s.low.balance, cur)} left at the tightest point`}
                      </p>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      )}
      <PlanForm />
    </div>
  );
}
