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
import PlanGroup from "@/components/PlanGroup";
import { groupBy } from "@/lib/group";
import { monthsBetween, path, reachDate, requiredMonthly, standing, targetValue, valueOn, valuesOn, withJoins, yearly, type PlanAsset } from "@/lib/goals";
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
  const chosen = versions.find((v) => String(v.id) === sp.v) ?? current;
  const isCurrent = chosen.id === current.id;

  const today = new Date().toISOString().slice(0, 10);
  const lists = listsOf(goal.accountIds);
  // Assets the plan gave nothing join it at their first record, so the plan and the table add up to the same.
  const plan = withJoins(chosen, lists);
  const target = targetValue(plan);
  const s = standing(plan, lists, today);
  const n = monthsBetween(plan.startDate, plan.targetDate);
  // Carrying on as planned starts from each asset's actual value today, each at its own expected rate.
  const nowByAsset = plan.assets.length > 0 ? valuesOn(lists, today) : s.actual;
  const projection = path(plan, s.k, nowByAsset);
  const projectedEnd = projection.at(-1)!.value;
  const need = requiredMonthly(plan, s.k, nowByAsset);
  const reach = reachDate(plan, s.k, nowByAsset);
  const years = yearly(plan, lists, today);

  // One point a month: the plan throughout, the actual value up to today, the projection from today on.
  const points: GoalPoint[] = path(plan).map((pt) => ({
    date: pt.date,
    planned: pt.value,
    actual: pt.date <= today ? valueOn(lists, pt.date) : null,
    projected: pt.k >= s.k ? (projection.find((q) => q.k === pt.k)?.value ?? null) : null,
  }));
  if (s.k < n) points.splice(points.findIndex((p) => p.date > today), 0, { date: today, planned: s.planned, actual: s.actual, projected: s.actual });


  // The plan's assets year by year: from the year the plan started to this one, plan against actual at each year's end.
  const yearCols: { year: number; from: string; to: string; toDate: boolean }[] = [];
  for (let y = +plan.startDate.slice(0, 4); y <= +today.slice(0, 4) && `${y}-01-01` <= plan.targetDate; y++) {
    const to = `${y}-12-31` < today ? `${y}-12-31` : today;
    const from = `${y - 1}-12-31` > plan.startDate ? `${y - 1}-12-31` : plan.startDate;
    yearCols.push({ year: y, from, to, toDate: to === today });
  }
  const yearAgo = `${+today.slice(0, 4) - 1}${today.slice(4)}`;
  const listOf = (id: number) => lists.find((l) => l[0]?.accountId === id) ?? [];
  const order = ticks.map((t) => t.id);
  const baseAssets: PlanAsset[] = plan.assets.length > 0 ? plan.assets : goal.accountIds.map((id) => ({ accountId: id, startValue: 0, rate: plan.expectedReturn, monthly: 0 }));
  const planRows = baseAssets
    .map((pa) => {
      const t = ticks.find((x) => x.id === pa.accountId);
      const alone = { ...plan, assets: [pa] };
      const list = listOf(pa.accountId);
      return {
        id: pa.accountId, name: t?.name ?? "A removed asset", categoryId: t?.categoryId ?? 0, category: t?.category ?? "Other",
        color: t?.color ?? "var(--ink-3)", rate: pa.rate, monthly: pa.monthly,
        // Money actually put in over the last 12 months, net of what was taken out (transfers between assets count).
        putIn: list.filter((e) => e.date > yearAgo && e.date <= today).reduce((t, e) => t + e.contribution, 0),
        joined: pa.join?.date ?? null,
        years: yearCols.map((y) => ({
          // Before it joins the plan has nothing to expect of it.
          plan: pa.join && pa.join.date > y.to ? null : path(alone, 0, undefined, monthsBetween(plan.startDate, y.to)).at(-1)!.value,
          actual: valueOn([list], y.to),
        })),
      };
    })
    .sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));
  // A group's year: values add up; growth figures are left out, since they don't add.
  // Years shown in the plan table: the latest few, paged with ‹ ›, or all of them.
  const WINDOW = 3;
  const lastIdx = yearCols.length - 1;
  const showAll = sp.yrs === "all" || yearCols.length <= WINDOW;
  const picked = yearCols.findIndex((c) => String(c.year) === sp.yrs);
  const endIdx = showAll || picked < 0 ? lastIdx : Math.max(picked, WINDOW - 1);
  const startIdx = showAll ? 0 : Math.max(endIdx - WINDOW + 1, 0);
  const shown = yearCols.map((y, i) => ({ ...y, i })).filter((y) => y.i >= startIdx && y.i <= endIdx);
  const yearsHref = (end: number | "all") => {
    const q = new URLSearchParams();
    if (typeof sp.v === "string") q.set("v", sp.v);
    if (end === "all") q.set("yrs", "all");
    else if (end !== lastIdx) q.set("yrs", String(yearCols[end].year));
    const qs = q.toString();
    return `/goals/${id}${qs ? `?${qs}` : ""}`;
  };
  // A group's (or the whole table's) year: every row added up, so the total is the plan the chart draws and the value held.
  const sumYear = (rows: typeof planRows, i: number) => ({
    plan: rows.every((r) => r.years[i].plan === null) ? null : rows.reduce((t, r) => t + (r.years[i].plan ?? 0), 0),
    actual: rows.reduce((t, r) => t + r.years[i].actual, 0),
  });
  const ahead = s.gap >= 0;

  return (
    <div className="mx-auto max-w-[92rem] space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Goals", href: "/goals" }, { label: goal.name }]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{goal.kind === "retirement" ? `Retirement at ${goal.retireAge}` : "Goal"} · {day(plan.targetDate)} · in {monthsText(Math.max(0, monthsBetween(today, plan.targetDate)))}</p>
          <h1 className="text-3xl">{goal.name}</h1>
        </div>
        <Link href={`/goals/${id}/revise`} className="btn">Revise plan</Link>
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
          <div className="shrink-0"><NotesEditor notes={null} save={updateGoalNotes.bind(null, id)} placeholder="Why this goal, what you decided, links…" /></div>
          <span>Keep notes on this goal: why, what you decided, links.</span>
        </div>
      )}

      {!isCurrent && (
        <p className="rounded-xl bg-sky-soft px-4 py-2.5 text-sm">
          Comparing with the plan from {day(plan.createdAt.slice(0, 10))}, an earlier version. <Link href={`/goals/${id}`} className="font-semibold underline">Back to the current plan</Link>
        </p>
      )}

      <section className="card grid grid-cols-1 gap-x-6 gap-y-5 p-5 min-[480px]:grid-cols-2 sm:p-6 lg:grid-cols-4">
        <Figure label="Target" value={money(target, cur)}
          hint={plan.targetMode === "spending" ? `${money(plan.monthlySpending ?? 0, cur)}/month today, at ${pct(plan.withdrawalRate)} a year` : `on ${day(plan.targetDate)}`} />
        <Figure label="Now" value={money(s.actual, cur)} hint={`${target > 0 ? ((s.actual / target) * 100).toFixed(1) : "0"}% of the target`} />
        <Figure label={ahead ? "Ahead of plan" : "Behind plan"} value={signedMoney(s.gap, cur)} cls={tone(s.gap)} hint={`Plan for today: ${money(s.planned, cur)}`} />
        <Figure label="On track for" value={money(projectedEnd, cur)} cls={projectedEnd >= target ? "text-go-text" : "text-miss-text"}
          hint={reach ? `reaches the target ${reach <= plan.targetDate ? "by" : "only by"} ${day(reach)}` : "doesn't reach the target within 50 years"} />
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="mb-3 text-lg">Plan and actual</h2>
        <GoalChart points={points} target={target} today={today} currency={cur} birthDate={goal.birthDate} />
        <p className="mt-2 text-xs text-ink-3">The green line is the target. &ldquo;Carrying on as planned&rdquo; starts from today&apos;s actual value and adds the planned amount each month at the expected return.</p>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg">Why you&apos;re {ahead ? "ahead" : "behind"}</h2>
        <div className="mt-3 grid gap-5 sm:grid-cols-3">
          <Figure label="From what you put in" value={signedMoney(s.fromContributions, cur)} cls={tone(s.fromContributions)}
            hint={`${money(s.actualPaid, cur)} put in against ${money(s.plannedPaid, cur)} planned`} />
          <Figure label="From returns" value={signedMoney(s.fromReturns, cur)} cls={tone(s.fromReturns)}
            hint={plan.assets.length > 1 ? `against the growth you expected for each asset (${pct(plan.expectedReturn)} combined)` : `against ${pct(plan.expectedReturn)} a year expected`} />
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

      {/* The full table is a tap away: the figures above already say where the goal stands. */}
      <details className="card group overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold">Year by year</span>
            <span className="block text-xs text-ink-3">Put in, growth and value each year, plan against actual · <span className={`num font-semibold ${tone(s.gap)}`}>{signedMoney(s.gap, cur)} in total</span></span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-brand"><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span></span>
        </summary>
        <p className="px-4 pb-3 text-xs text-ink-3 sm:px-6">Is it growing as planned? Growth is what the assets gained from returns in the year, apart from money put in.</p>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px] xl:text-sm">
            <thead>
              <tr className="eyebrow text-left">
                <th className="py-1.5 pl-4 sm:pl-6" rowSpan={2}>Year</th>
                <th className="py-1.5 text-center" colSpan={2}>Put in</th>
                <th className="py-1.5 text-center" colSpan={3}>Growth</th>
                <th className="py-1.5 pr-4 text-center sm:pr-6" colSpan={3}>Value at the end</th>
              </tr>
              <tr className="eyebrow">
                {["Plan", "Actual", "Plan", "Actual", "Difference", "Plan", "Actual", "Difference"].map((h, i) => (
                  <th key={i} className={`py-1.5 text-right ${i === 7 ? "pr-4 sm:pr-6" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year} className={y.actualEnd === null ? "text-ink-3" : ""}>
                  <td className="num py-2.5 pl-4 font-semibold sm:pl-6">{y.year}{y.toDate && <span className="ml-1 text-xs font-normal text-ink-3">to date</span>}</td>
                  <td className="num py-2.5 text-right">{money(y.plannedPaid, cur)}</td>
                  <td className="num py-2.5 text-right">{y.actualPaid === null ? "—" : money(y.actualPaid, cur)}</td>
                  <td className="num py-2.5 text-right">{money(y.plannedGrowth, cur)}</td>
                  <td className="num py-2.5 text-right">{y.actualGrowth === null ? "—" : money(y.actualGrowth, cur)}</td>
                  <td className={`num py-2.5 text-right ${y.actualGrowth === null ? "" : tone(y.actualGrowth - y.plannedGrowth)}`}>
                    {y.actualGrowth === null ? "—" : signedMoney(y.actualGrowth - y.plannedGrowth, cur)}
                  </td>
                  <td className="num py-2.5 text-right">{money(y.plannedEnd, cur)}</td>
                  <td className="num py-2.5 text-right font-semibold">{y.actualEnd === null ? "—" : money(y.actualEnd, cur)}</td>
                  <td className={`num py-2.5 pr-4 text-right sm:pr-6 ${y.actualEnd === null ? "" : tone(y.actualEnd - y.plannedEnd)}`}>
                    {y.actualEnd === null ? "—" : signedMoney(y.actualEnd - y.plannedEnd, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-bold">
                <td className="py-3 pl-4 sm:pl-6">In total</td>
                <td className="num py-3 text-right">{money(s.plannedPaid, cur)}</td>
                <td className="num py-3 text-right">{money(s.actualPaid, cur)}</td>
                <td className="num py-3 text-right">{money(s.planned - plan.startValue - s.plannedPaid, cur)}</td>
                <td className="num py-3 text-right">{money(s.actual - plan.startValue - s.actualPaid, cur)}</td>
                <td className={`num py-3 text-right ${tone(s.fromReturns)}`}>{signedMoney(s.fromReturns, cur)}</td>
                <td className="num py-3 text-right">{money(s.planned, cur)}</td>
                <td className="num py-3 text-right">{money(s.actual, cur)}</td>
                <td className={`num py-3 pr-4 text-right sm:pr-6 ${tone(s.gap)}`}>{signedMoney(s.gap, cur)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="px-4 pb-4 pt-2 text-xs text-ink-3 sm:px-6">
          This year is compared up to today. The total runs from {day(plan.startDate)} to today, starting from {money(plan.startValue, cur)}; the years after are the plan alone.
        </p>
      </details>

      <div className="space-y-5">
        <section className="card overflow-hidden">
          <div className="p-4 sm:px-6">
            <h2 className="text-lg">The plan</h2>
            <p className="num mt-1 text-sm text-ink-3">
              Started {day(plan.startDate)} with {money(plan.startValue, cur)} · {money(plan.monthlyContribution, cur)} a month
              {plan.contributionGrowth > 0 && `, rising ${pct(plan.contributionGrowth)} a year`} · {pct(plan.expectedReturn)} a year expected{plan.assets.length > 1 && " combined"}
              {plan.targetMode === "spending" && ` · inflation ${pct(plan.inflation)}`}
            </p>
          </div>
          {yearCols.length > WINDOW && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 text-xs sm:px-6">
              <span className="num text-ink-3">{showAll ? `All ${yearCols.length} years` : `${shown[0].year}–${shown.at(-1)!.year} of ${yearCols[0].year}–${yearCols[lastIdx].year}`}</span>
              {!showAll && (
                <>
                  {startIdx > 0 ? <Link href={yearsHref(endIdx - 1)} scroll={false} className="font-semibold text-brand">‹ Earlier</Link> : <span className="text-ink-3 opacity-50">‹ Earlier</span>}
                  {endIdx < lastIdx ? <Link href={yearsHref(endIdx + 1)} scroll={false} className="font-semibold text-brand">Later ›</Link> : <span className="text-ink-3 opacity-50">Later ›</span>}
                </>
              )}
              <Link href={showAll ? yearsHref(lastIdx) : yearsHref("all")} scroll={false} className="font-semibold text-brand">{showAll ? "Show the latest 3" : "Show all years"}</Link>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: `${44 + shown.length * 12}rem` }}>
              <thead>
                <tr className="eyebrow text-left">
                  <th className={`${stick} bg-surface py-2 pl-4 sm:pl-6`}>Asset</th>
                  <th className="py-2 pl-3 text-right">Growth a year</th>
                  <th className="py-2 pl-3 text-right">Put in a month</th>
                  <th className="py-2 pl-3 text-right">Put in a year<span className="block font-normal normal-case">expected</span></th>
                  <th className="py-2 pl-3 text-right">Put in a year<span className="block font-normal normal-case">actual, last 12 months</span></th>
                  {shown.map((y) => (
                    <th key={y.year} className="py-2 pl-3 text-right">{y.year}{y.toDate && <span className="ml-1 font-normal normal-case">to {day(y.to, false)}</span>}</th>
                  ))}
                </tr>
              </thead>
              {groupBy(planRows, (r) => r.categoryId).map(({ key, items }) => (
                <PlanGroup key={key} count={items.length}
                  label={<span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: items[0].color }} />{items[0].category}</span>}
                  cells={<>
                    <td />
                    <td className="num py-2.5 pl-3 text-right">{money(items.reduce((t, r) => t + r.monthly, 0), cur)}</td>
                    <td className="num py-2.5 pl-3 text-right">{money(items.reduce((t, r) => t + r.monthly, 0) * 12, cur)}</td>
                    <td className="num py-2.5 pl-3 text-right">{money(items.reduce((t, r) => t + r.putIn, 0), cur)}</td>
                    {shown.map((y) => yearCell(`${key}-${y.year}`, sumYear(items, y.i), cur))}
                  </>}>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td className={`${stick} bg-surface py-2.5 pl-8 font-semibold sm:pl-10`}>
                        <Link href={`/accounts/${r.id}`} className="hover:underline">{r.name}</Link>
                        {r.joined && <span className="block text-xs font-normal text-ink-3">expected from {day(r.joined)}</span>}
                      </td>
                      <td className="num py-2.5 pl-3 text-right">{pct(r.rate)}</td>
                      <td className="num py-2.5 pl-3 text-right">{r.monthly > 0 ? money(r.monthly, cur) : "—"}</td>
                      <td className="num py-2.5 pl-3 text-right">{r.monthly > 0 ? money(r.monthly * 12, cur) : "—"}</td>
                      <td className={`num py-2.5 pl-3 text-right ${Math.abs(r.putIn) < 0.005 ? "text-ink-3" : ""}`}>{Math.abs(r.putIn) < 0.005 ? "—" : money(r.putIn, cur)}</td>
                      {shown.map((y) => yearCell(`${r.id}-${y.year}`, r.years[y.i], cur))}
                    </tr>
                  ))}
                </PlanGroup>
              ))}
              <tfoot>
                <tr className="border-t border-line font-bold">
                  <td className={`${stick} bg-surface py-3 pl-4 sm:pl-6`}>Total</td>
                  <td />
                  <td className="num py-3 pl-3 text-right">{money(plan.monthlyContribution, cur)}</td>
                  <td className="num py-3 pl-3 text-right">{money(plan.monthlyContribution * 12, cur)}</td>
                  <td className="num py-3 pl-3 text-right">{money(planRows.reduce((t, r) => t + r.putIn, 0), cur)}</td>
                  {shown.map((y) => yearCell(`total-${y.year}`, sumYear(planRows, y.i), cur))}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="px-4 pb-4 pt-2 text-xs text-ink-3 sm:px-6">
            Each year shows the value the plan expected at its end (today, for this year), the actual value, and how far off it is. Put in a year, actual, is what went in over the last 12 months, less what came out (moving an asset to another counts as out of one and into the other). An asset the plan gave no start value or monthly amount is expected from its first record on, at its own growth rate with nothing put in, and has no expected value before that. The total adds every row, so it matches the plan on the chart.
          </p>
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

/** The first column of the plan table stays put while the years scroll. */
const stick = "sticky left-0 z-10 border-r border-line";

/** One line of a year cell: what it is on the left, the figure on the right. */
function Line({ label, children, cls = "" }: { label: string; children: React.ReactNode; cls?: string }) {
  return (
    <span className={`flex items-baseline justify-between gap-3 ${cls}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">{label}</span>
      <span>{children}</span>
    </span>
  );
}

type YearCell = { plan: number | null; actual: number };

/** One year of one row: the value the plan expected at its end, the actual, and the difference as a share of the expected. */
function yearCell(key: string, c: YearCell, cur: string) {
  const diff = c.actual - (c.plan ?? 0);
  const show = c.plan !== null && c.plan > 0;
  return (
    <td key={key} className="num min-w-44 py-2.5 pl-3 align-top">
      <Line label="Expected" cls="text-ink-2">{c.plan === null ? "—" : money(c.plan, cur)}</Line>
      <Line label="Actual" cls="font-semibold">{money(c.actual, cur)}</Line>
      <Line label="Diff %" cls={`text-xs font-semibold ${show ? tone(diff) : "text-ink-3"}`}>
        {show ? `${diff >= 0 ? "+" : "−"}${Math.abs((diff / c.plan!) * 100).toFixed(1)}%` : "—"}
      </Line>
    </td>
  );
}

function Figure({ label, value, hint, cls = "" }: { label: string; value: string; hint?: string; cls?: string }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className={`num text-xl font-bold [overflow-wrap:anywhere] ${cls}`}>{value}</p>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
