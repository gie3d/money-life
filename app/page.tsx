import Link from "next/link";
import ForecastChart from "@/components/ForecastChart";
import GoalMiniChart, { type MiniPoint } from "@/components/GoalMiniChart";
import Info from "@/components/Info";
import StaleNotice from "@/components/StaleNotice";
import { listAccounts, listEntries, listGoals, listGoalVersions, listPlanItems, listPlans, listPrices, listTrades } from "@/lib/data";
import { goalAssets } from "@/lib/goal-data";
import { monthsBetween, path, standing, targetValue, valueOn, valuesOn, withJoins } from "@/lib/goals";
import { addMonths } from "@/lib/plan";
import { day, money, pct, signedMoney, tone } from "@/lib/format";
import { daysBetween, extendTo, netWorthSeries } from "@/lib/performance";
import { forecast } from "@/lib/forecast";
import { payments } from "@/lib/plan";
import { accountEntries, holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { remindAfterDays } from "@/lib/types";

/**
 * Home answers three questions, each with one figure up front and the detail a tap away: how much you have, whether
 * it's going up, and whether your goals are on track.
 */
export default async function Home() {
  const user = await requireUser();
  const cur = user.currency;

  const [accounts, entries, trades, prices, plans, planItems] = await Promise.all([
    listAccounts(user.id), listEntries(user.id), listTrades(user.id), listPrices(user.id),
    listPlans(user.id), listPlanItems(user.id),
  ]);
  const [goals, goalVersions, { listsOf: goalLists }] = await Promise.all([listGoals(user.id), listGoalVersions(user.id), goalAssets(user.id)]);
  const rows = holdings(accounts, entries, trades, prices);
  const today = new Date().toISOString().slice(0, 10);

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <div className="rounded-[28px] bg-gradient-to-br from-[var(--hero-a)] via-[var(--hero-b)] to-[var(--hero-c)] p-6 text-white sm:p-8">
          <p className="text-3xl" aria-hidden>🌱</p>
          <h1 className="mt-2 text-2xl text-white sm:text-3xl">Hi {user.name}, let&apos;s set you up</h1>
          <p className="mt-2 max-w-md opacity-90">Tell us what you have and what it&apos;s worth today. It takes about two minutes, and you can change anything later.</p>
          <Link href="/welcome" className="mt-6 inline-block rounded-full bg-white px-5 py-2.5 font-bold text-[var(--hero-b)]">Start setup →</Link>
        </div>
        <p className="text-center text-sm text-ink-3">
          Prefer to do it yourself? <Link href="/accounts#new-asset" className="font-semibold text-brand">Add one asset at a time</Link>
        </p>
      </div>
    );
  }

  const totalValue = rows.reduce((s, h) => s + h.value, 0);
  // Profit and loss exist only for investments; cash and saving are just a balance.
  const invs = rows.filter((h) => h.investment);
  const invValue = invs.reduce((s, h) => s + h.value, 0);
  const invCost = invs.reduce((s, h) => s + h.cost, 0);
  const invPl = invValue - invCost;
  const invPlPct = invCost > 0 ? invPl / invCost : null;
  const realized = invs.reduce((s, h) => s + h.realized, 0);

  // The change in the total over about a month: from the last value known a month ago (or the first record, if newer).
  const lists = rows.map((h) => accountEntries(h.account, entries, trades, prices));
  const history = extendTo(netWorthSeries(lists, null, today), today);
  const monthAgo = addMonths(today, -1);
  const base = history.filter((p) => p.date <= monthAgo).at(-1) ?? history[0];
  const change = base && base.date < today ? { since: base.date, amount: totalValue - base.value, pct: base.value > 0 ? (totalValue - base.value) / base.value : null } : null;

  // Assets due a new value, by how often their kind changes (see REMIND_AFTER_DAYS), oldest first.
  const stale = rows
    .filter((h) => daysBetween(h.lastDate, today) >= remindAfterDays(h.account.liquidity))
    .sort((a, b) => a.lastDate.localeCompare(b.lastDate))
    .map((h) => ({ name: h.account.name, days: daysBetween(h.lastDate, today) }));

  // Goals, three years out: where each plan should be by then (or at its own date, if sooner), where carrying on
  // from today leads by then, and how each stands against its plan today.
  const goalCards = goals.flatMap((g) => {
    const latest = goalVersions.filter((v) => v.goalId === g.id).at(-1);
    if (!latest) return [];
    const glists = goalLists(g.accountIds);
    const plan = withJoins(latest, glists);
    const s = standing(plan, glists, today);
    const nowBy = plan.assets.length > 0 ? valuesOn(glists, today) : s.actual;
    const n = monthsBetween(plan.startDate, plan.targetDate);
    const final = addMonths(today, 36) >= plan.targetDate;
    const k = final ? n : Math.min(n, monthsBetween(plan.startDate, addMonths(today, 36)));
    const date = final ? plan.targetDate : addMonths(today, 36);
    // One point a month, from six months back to the mark: the plan's path throughout, your actual value up to today,
    // and from today on, that value carried on as planned.
    const carry = path(plan, s.k, nowBy, Math.max(k, s.k));
    const from = addMonths(today, -6);
    const chart: MiniPoint[] = path(plan, 0, undefined, Math.max(k, s.k))
      .filter((q) => q.date >= from)
      .map((q) => ({
        date: q.date, planned: q.value,
        actual: q.date <= today ? valueOn(glists, q.date) : null,
        projected: q.k >= s.k ? (carry.find((c) => c.k === q.k)?.value ?? null) : null,
      }));
    const at = chart.findIndex((q) => q.date > today);
    chart.splice(at < 0 ? chart.length : at, 0, { date: today, planned: s.planned, actual: s.actual, projected: s.actual });
    return [{
      goal: g, plan, s, final, date, chart,
      milestone: final ? targetValue(plan) : path(plan, 0, undefined, k).at(-1)!.value,
      onTrack: path(plan, s.k, nowBy, Math.max(k, s.k)).at(-1)!.value,
    }];
  });

  // Where the total value is heading: the last 12 months' average change carried on, less plan payments.
  // Plans are only subtracted here, in the forecast; nothing is ever taken out of an asset.
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const itemPlan = new Map(planItems.map((i) => [i.id, planName.get(i.planId) ?? ""]));
  // Archived plans are put aside, so their costs are left out.
  const activePlans = new Set(plans.filter((p) => !p.archived).map((p) => p.id));
  // Twelve months back as recorded, twelve ahead on the trend.
  const ahead = forecast(extendTo(netWorthSeries(lists, null, today), today), today, payments(planItems.filter((i) => activePlans.has(i.planId))), 12);
  const planDue = ahead.payments.reduce((s, p) => s + p.amount, 0);

  const forecastEnd = planDue > 0 ? ahead.end.afterPlans : ahead.end.trend;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <StaleNotice items={stale} />

      {/* How much do I have? */}
      <section className="rounded-[28px] bg-gradient-to-br from-[var(--hero-a)] via-[var(--hero-b)] to-[var(--hero-c)] p-6 text-white sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">What you have</p>
        <p className="num mt-1 text-4xl font-extrabold sm:text-5xl">{money(totalValue, cur)}</p>
        {change && (
          <p className="num mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-bold">
            <span className="whitespace-nowrap rounded-full bg-white/20 px-2.5 py-0.5">{change.amount >= 0 ? "▲" : "▼"} {signedMoney(change.amount, cur)}{change.pct !== null && ` · ${pct(change.pct)}`}</span>
            <span className="text-sm font-medium opacity-85">since {day(change.since)}</span>
            <Info label="About this change">
              The change in the total value of all your assets since {day(change.since)}, money you added or took out included.
              {invs.length > 0 && <> Your investments are {signedMoney(invPl, cur)} ({pct(invPlPct)}) on what they cost ({money(invCost, cur)}){realized !== 0 && <>, and sales have locked in {signedMoney(realized, cur)}</>}.</>}
            </Info>
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/accounts" className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold hover:bg-white/30">See assets →</Link>
          <Link href="/performance" className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold hover:bg-white/30">Performance →</Link>
        </div>
      </section>

      {/* Is it going up? */}
      <section className="card p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg">
              Where it&apos;s heading
              <Info>
                The trend carries on the average monthly change in your total value over the last 12 months (or since your first record), money added or taken out included.
                {planDue > 0 && " The red line also takes off the payments in your plans as they fall due."} It is a forecast only: your assets are not changed.
              </Info>
            </h2>
            <p className="text-xs text-ink-3">
              {ahead.basisMonths >= 1 ? <>Going <span className={`font-semibold ${tone(ahead.monthly)}`}>{signedMoney(ahead.monthly, cur)} a month</span> lately</> : "Not enough history for a trend yet"}
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">By {day(ahead.end.date)}{planDue > 0 && ", after plan costs"}</p>
            <p className={`num text-2xl font-extrabold ${forecastEnd < 0 ? "text-miss-text" : ""}`}>{money(forecastEnd, cur)}</p>
          </div>
        </div>
        <ForecastChart points={ahead.points} today={today} currency={cur} withPlans={planDue > 0} />
        {(planDue > 0 || ahead.payments.length > 0) && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold text-ink-2">More detail</summary>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
              <Stat label="On trend" value={money(ahead.end.trend, cur)} />
              {planDue > 0 && <Stat label="Plan costs due" value={`−${money(planDue, cur)}`} cls="text-miss-text" />}
              {planDue > 0 && <Stat label="After plan costs" value={money(ahead.end.afterPlans, cur)} cls={ahead.end.afterPlans < 0 ? "text-miss-text" : ""} />}
            </div>
            {ahead.payments.length > 0 && (
              <ul className="mt-3 divide-y divide-line">
                {ahead.payments.map((p, i) => (
                  <li key={`${p.itemId}-${p.date}-${i}`} className="flex items-center gap-3 py-2">
                    <span className="num w-24 shrink-0 text-ink-3">{day(p.date)}</span>
                    <span className="min-w-0 flex-1 truncate">{p.name}<span className="text-ink-3"> · {itemPlan.get(p.itemId)}</span></span>
                    <span className="num font-semibold">{money(p.amount, cur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </details>
        )}
      </section>

      {/* Am I on track? */}
      {goalCards.length > 0 ? (
        <section className="card p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg">
              Your goals
              <Info label="About goals here">
                Each goal is measured against where its plan should be in three years ({day(addMonths(today, 36))}), or at its own date if that comes sooner.
                &quot;On track&quot; means carrying on as planned from today gets you there. Open a goal for its chart and year-by-year detail.
              </Info>
            </h2>
            <Link href="/goals" className="text-sm font-semibold text-brand">All goals →</Link>
          </div>
          <ul className="divide-y divide-line">
            {goalCards.map(({ goal, s, final, date, milestone, onTrack, chart }) => {
              const share = milestone > 0 ? Math.min(1, s.actual / milestone) : 0;
              const ok = onTrack >= milestone;
              return (
                <li key={goal.id}>
                  <Link href={`/goals/${goal.id}`} className="-mx-2 block space-y-2 rounded-xl px-2 py-3 hover:bg-surface-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-semibold">{goal.name}<span className="font-normal text-ink-3"> · {final ? `last 6 months to ${day(date)}` : "last 6 months and next 3 years"}</span></p>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${ok ? "bg-go-soft text-go-text" : "bg-miss-soft text-miss-text"}`}>
                        {ok ? "On track ✓" : `${money(milestone - onTrack, cur)} short`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${Math.round(share * 100)}% of the way`}>
                      <div className={`h-full rounded-full ${ok ? "bg-go" : "bg-brand"}`} style={{ width: `${share * 100}%` }} />
                    </div>
                    <p className="num text-xs text-ink-3">
                      {money(s.actual, cur)} of {money(milestone, cur)} · {final ? "target" : "3-year mark"} {day(date)}
                    </p>
                    <GoalMiniChart points={chart} today={today} currency={cur} label={`${goal.name}: your value against the plan until ${day(date)}`} />
                    <p className="flex gap-4 text-xs text-ink-3">
                      <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brand" />Actual</span>
                      <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dotted border-brand" />Carrying on</span>
                      <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-ink-3" />Target</span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <Link href="/goals/new" className="card flex items-center justify-between gap-3 p-5 hover:bg-surface-2 sm:p-6">
          <span>
            <span className="block text-lg font-bold">Set a goal</span>
            <span className="text-sm text-ink-3">Retirement, a child&apos;s education, a house: see if you&apos;re on track.</span>
          </span>
          <span className="text-brand">→</span>
        </Link>
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
