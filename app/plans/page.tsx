import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import PlanForm from "@/components/PlanForm";
import { listAccounts, listEntries, listPlanAssets, listPlanItems, listPlans, listPrices, listTrades } from "@/lib/data";
import { day, money, monthLabel, tone } from "@/lib/format";
import { payments, schedule } from "@/lib/plan";
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

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Plans" }]} />
      <div>
        <h1 className="text-3xl">Plans</h1>
        <p className="text-sm text-ink-3">Plan something you are going to pay for, and see if your assets cover it, month by month.</p>
      </div>

      {plans.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {plans.map((plan) => {
            const mine = items.filter((i) => i.planId === plan.id);
            const ids = new Set(funding.get(plan.id) ?? []);
            const funds = held.filter((h) => ids.has(h.account.id)).reduce((s, h) => s + h.value, 0);
            const s = schedule(payments(mine), funds, plan.monthlySaving, today);
            const next = payments(mine).find((p) => p.date >= today);
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
