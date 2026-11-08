import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { listGoals, listGoalVersions } from "@/lib/data";
import { day, money, signedMoney } from "@/lib/format";
import { goalAssets } from "@/lib/goal-data";
import { monthsBetween, standing, targetValue } from "@/lib/goals";
import { monthsText } from "@/lib/plan";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await requireUser();
  const cur = user.currency;
  const today = new Date().toISOString().slice(0, 10);
  const [goals, versions, { listsOf }] = await Promise.all([listGoals(user.id), listGoalVersions(user.id), goalAssets(user.id)]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Goals" }]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Goals</h1>
          <p className="mt-1 text-sm text-ink-3">Money to build up by a date, like retirement: the plan, what you&apos;ve actually done, and the difference.</p>
        </div>
        <Link href="/goals/new" className="btn">New goal</Link>
      </div>

      {goals.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-ink-3">No goals yet. Start with your retirement: when, how much, and what you&apos;ll put in.</p>
          <Link href="/goals/new" className="btn mt-4">Create a goal</Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {goals.map((g) => {
            const plan = versions.filter((v) => v.goalId === g.id).at(-1);
            if (!plan) return null;
            const target = targetValue(plan);
            const s = standing(plan, listsOf(g.accountIds), today);
            const share = target > 0 ? Math.min(1, s.actual / target) : 0;
            const ahead = s.gap >= 0;
            return (
              <Link key={g.id} href={`/goals/${g.id}`} className="card block space-y-3 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg">{g.name}</h2>
                    <p className="text-xs text-ink-3">{day(plan.targetDate)} · in {monthsText(Math.max(0, monthsBetween(today, plan.targetDate)))}</p>
                  </div>
                  <p className="num text-lg font-bold">{money(target, cur)}</p>
                </div>
                <div className="space-y-1">
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${Math.round(share * 100)}% of the target`}>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${share * 100}%` }} />
                  </div>
                  <p className="num text-xs text-ink-3">{money(s.actual, cur)} now · {(share * 100).toFixed(1)}% of the target</p>
                </div>
                <p className={`text-sm font-semibold ${ahead ? "text-go-text" : "text-miss-text"}`}>
                  {ahead ? "Ahead of plan" : "Behind plan"} by {signedMoney(s.gap, cur).replace(/^[+−-]/, "")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
