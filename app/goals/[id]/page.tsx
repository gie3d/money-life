import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmDelete from "@/components/ConfirmDelete";
import GoalChart, { type GoalPoint } from "@/components/GoalChart";
import Markdown from "@/components/Markdown";
import NotesEditor from "@/components/NotesEditor";
import { deleteGoal, deleteGoalVersion, updateGoalNotes } from "@/app/actions/goals";
import { listGoals, listGoalVersions } from "@/lib/data";
import { day, money, signedMoney, tone } from "@/lib/format";
import { goalAssets } from "@/lib/goal-data";
import { monthsBetween, path, reachDate, requiredMonthly, standing, targetValue, valueOn, yearly } from "@/lib/goals";
import { monthsText } from "@/lib/plan";
import { requireUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/goals/[id]">): Promise<Metadata> {
  const user = await requireUser();
  const id = Number((await params).id);
  const goal = (await listGoals(user.id)).find((g) => g.id === id);
  return { title: goal?.name ?? "Goal" };
}

const pct = (f: number) => `${(f * 100).toFixed(f * 100 % 1 === 0 ? 0 : 1)}%`;

export default async function GoalPage({ params, searchParams }: PageProps<"/goals/[id]">) {
  const user = await requireUser();
  const cur = user.currency;
  const id = Number((await params).id);
  const sp = await searchParams;
  const goal = (await listGoals(user.id)).find((g) => g.id === id);
  if (!goal) notFound();
  const [versions, { ticks, listsOf }] = await Promise.all([listGoalVersions(user.id, id), goalAssets(user.id)]);
  const current = versions.at(-1);
  if (!current) notFound();
  // Compare against the current plan, or an earlier version picked below.
  const plan = versions.find((v) => String(v.id) === sp.v) ?? current;
  const isCurrent = plan.id === current.id;

  const today = new Date().toISOString().slice(0, 10);
  const lists = listsOf(goal.accountIds);
  const target = targetValue(plan);
  const s = standing(plan, lists, today);
  const n = monthsBetween(plan.startDate, plan.targetDate);
  const projection = path(plan, s.k, s.actual);
  const projectedEnd = projection.at(-1)!.value;
  const need = requiredMonthly(plan, s.k, s.actual);
  const reach = reachDate(plan, s.k, s.actual);
  const years = yearly(plan, lists, today);

  // One point a month: the plan throughout, the actual value up to today, the projection from today on.
  const points: GoalPoint[] = path(plan).map((pt) => ({
    date: pt.date,
    planned: pt.value,
    actual: pt.date <= today ? valueOn(lists, pt.date) : null,
    projected: pt.k >= s.k ? (projection.find((q) => q.k === pt.k)?.value ?? null) : null,
  }));
  if (s.k < n) points.splice(points.findIndex((p) => p.date > today), 0, { date: today, planned: s.planned, actual: s.actual, projected: s.actual });

  const assets = ticks.filter((a) => goal.accountIds.includes(a.id));
  const ahead = s.gap >= 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Goals", href: "/goals" }, { label: goal.name }]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{goal.kind === "retirement" ? `Retirement at ${goal.retireAge}` : "Goal"} · {day(plan.targetDate)} · in {monthsText(Math.max(0, monthsBetween(today, plan.targetDate)))}</p>
          <h1 className="text-3xl">{goal.name}</h1>
        </div>
        <Link href={`/goals/${id}/revise`} className="btn">Revise plan</Link>
      </div>

      {!isCurrent && (
        <p className="rounded-xl bg-sky-soft px-4 py-2.5 text-sm">
          Comparing with the plan from {day(plan.createdAt.slice(0, 10))}, an earlier version. <Link href={`/goals/${id}`} className="font-semibold underline">Back to the current plan</Link>
        </p>
      )}

      <section className="card grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:p-6 lg:grid-cols-4">
        <Figure label="Target" value={money(target, cur)}
          hint={plan.targetMode === "spending" ? `${money(plan.monthlySpending ?? 0, cur)}/month today, at ${pct(plan.withdrawalRate)} a year` : `on ${day(plan.targetDate)}`} />
        <Figure label="Now" value={money(s.actual, cur)} hint={`${target > 0 ? ((s.actual / target) * 100).toFixed(1) : "0"}% of the target`} />
        <Figure label={ahead ? "Ahead of plan" : "Behind plan"} value={signedMoney(s.gap, cur)} cls={tone(s.gap)} hint={`Plan for today: ${money(s.planned, cur)}`} />
        <Figure label="On track for" value={money(projectedEnd, cur)} cls={projectedEnd >= target ? "text-go-text" : "text-miss-text"}
          hint={reach ? `reaches the target ${reach <= plan.targetDate ? "by" : "only by"} ${day(reach)}` : "doesn't reach the target within 50 years"} />
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="mb-3 text-lg">Plan and actual</h2>
        <GoalChart points={points} target={target} today={today} currency={cur} />
        <p className="mt-2 text-xs text-ink-3">The green line is the target. &ldquo;Carrying on as planned&rdquo; starts from today&apos;s actual value and adds the planned amount each month at the expected return.</p>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg">Why you&apos;re {ahead ? "ahead" : "behind"}</h2>
        <div className="mt-3 grid gap-5 sm:grid-cols-3">
          <Figure label="From what you put in" value={signedMoney(s.fromContributions, cur)} cls={tone(s.fromContributions)}
            hint={`${money(s.actualPaid, cur)} put in against ${money(s.plannedPaid, cur)} planned`} />
          <Figure label="From returns" value={signedMoney(s.fromReturns, cur)} cls={tone(s.fromReturns)}
            hint={`against ${pct(plan.expectedReturn)} a year expected`} />
          {need !== null && (
            <Figure label="To land on the target" value={`${money(need, cur)} / month`}
              hint={need > plan.monthlyContribution * 1.005 ? `${money(need - plan.monthlyContribution, cur)} more than planned` : need < plan.monthlyContribution * 0.995 ? `${money(plan.monthlyContribution - need, cur)} less than planned` : "as planned"}
              cls={need > plan.monthlyContribution * 1.005 ? "text-miss-text" : "text-go-text"} />
          )}
        </div>
        <p className="mt-3 text-xs text-ink-3">
          &ldquo;What you put in&rdquo; is buys and deposits less sales and withdrawals in the goal&apos;s assets since the plan started. The rest of the difference is returns.
          {plan.contributionGrowth > 0 && ` Monthly amounts rise ${pct(plan.contributionGrowth)} each year, as planned.`}
        </p>
      </section>

      <section className="card overflow-hidden">
        <h2 className="p-4 text-lg sm:px-6">Year by year</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="eyebrow text-left">
                <th className="py-2 pl-4 sm:pl-6">Year</th>
                <th className="py-2 text-right">Put in · plan</th>
                <th className="py-2 text-right">Put in · actual</th>
                <th className="py-2 text-right">Value · plan</th>
                <th className="py-2 text-right">Value · actual</th>
                <th className="py-2 pr-4 text-right sm:pr-6">Difference</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year} className={y.actualEnd === null ? "text-ink-3" : ""}>
                  <td className="num py-2.5 pl-4 font-semibold sm:pl-6">{y.year}{String(y.year) === today.slice(0, 4) && <span className="ml-1 text-xs font-normal text-ink-3">to date</span>}</td>
                  <td className="num py-2.5 text-right">{money(y.plannedPaid, cur)}</td>
                  <td className="num py-2.5 text-right">{y.actualPaid === null ? "—" : money(y.actualPaid, cur)}</td>
                  <td className="num py-2.5 text-right">{money(y.plannedEnd, cur)}</td>
                  <td className="num py-2.5 text-right font-semibold">{y.actualEnd === null ? "—" : money(y.actualEnd, cur)}</td>
                  <td className={`num py-2.5 pr-4 text-right sm:pr-6 ${y.actualEnd === null ? "" : tone(y.actualEnd - y.plannedEnd)}`}>
                    {y.actualEnd === null ? "—" : signedMoney(y.actualEnd - y.plannedEnd, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 pb-4 pt-2 text-xs text-ink-3 sm:px-6">For the current year the plan column is the whole year and the actual is to date.</p>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg">The plan</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-3">Started</dt><dd className="num">{day(plan.startDate)} with {money(plan.startValue, cur)}</dd>
            <dt className="text-ink-3">Put in each month</dt><dd className="num">{money(plan.monthlyContribution, cur)}{plan.contributionGrowth > 0 && `, +${pct(plan.contributionGrowth)} a year`}</dd>
            <dt className="text-ink-3">Expected return</dt><dd className="num">{pct(plan.expectedReturn)} a year</dd>
            {plan.targetMode === "spending" && <><dt className="text-ink-3">Inflation</dt><dd className="num">{pct(plan.inflation)} a year</dd></>}
          </dl>
          <h3 className="mt-4 text-sm font-bold">Assets that count</h3>
          <ul className="mt-1 divide-y divide-line text-sm">
            {assets.map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-1.5">
                <span className="size-2 rounded-full" style={{ background: a.color }} />
                <Link href={`/accounts/${a.id}`} className="min-w-0 flex-1 truncate">{a.name}</Link>
                <span className="num">{money(a.value, cur)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-lg">Plan versions</h2>
          <p className="text-xs text-ink-3">Revising keeps the earlier plans. Pick one to see how you did against it.</p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {[...versions].reverse().map((v) => (
              <li key={v.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {day(v.createdAt.slice(0, 10))}
                    {v.id === current.id && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">current</span>}
                    {v.id === plan.id && v.id !== current.id && <span className="ml-2 rounded-full bg-sky-soft px-2 py-0.5 text-xs">showing</span>}
                  </p>
                  <p className="num truncate text-xs text-ink-3">
                    {money(targetValue(v), cur)} by {day(v.targetDate)} · {money(v.monthlyContribution, cur)}/month · {pct(v.expectedReturn)}
                    {v.note && ` · ${v.note}`}
                  </p>
                </div>
                {v.id !== plan.id && <Link href={v.id === current.id ? `/goals/${id}` : `/goals/${id}?v=${v.id}`} className="text-xs font-semibold text-brand">Compare</Link>}
                {v.id !== current.id && (
                  <ConfirmDelete
                    action={deleteGoalVersion.bind(null, id, v.id)}
                    title="Delete this plan version?"
                    message={`The plan from ${day(v.createdAt.slice(0, 10))} will be removed. The current plan stays.`}
                    triggerLabel={`Delete the plan from ${day(v.createdAt.slice(0, 10))}`}
                    triggerClassName="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
                  >
                    ×
                  </ConfirmDelete>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {goal.notes ? (
        <section className="card p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-lg">Notes</h2>
            <NotesEditor notes={goal.notes} save={updateGoalNotes.bind(null, id)} placeholder="Why this goal, what you decided, links…" />
          </div>
          <Markdown>{goal.notes}</Markdown>
        </section>
      ) : (
        <div className="flex items-center gap-3 text-sm text-ink-3">
          <NotesEditor notes={null} save={updateGoalNotes.bind(null, id)} placeholder="Why this goal, what you decided, links…" />
          <span>Keep notes on this goal: why, what you decided, links.</span>
        </div>
      )}

      <ConfirmDelete
        action={deleteGoal.bind(null, id)}
        title="Delete this goal?"
        message="The goal and all its plan versions will be deleted. Your assets aren't touched."
        triggerClassName="text-sm font-semibold text-miss-text"
      >
        Delete goal
      </ConfirmDelete>
    </div>
  );
}

function Figure({ label, value, hint, cls = "" }: { label: string; value: string; hint?: string; cls?: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={`num text-xl font-bold ${cls}`}>{value}</p>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
