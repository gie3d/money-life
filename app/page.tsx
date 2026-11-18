import Link from "next/link";
import ForecastChart from "@/components/ForecastChart";
import GoalMiniChart, { type MiniPoint } from "@/components/GoalMiniChart";
import Info from "@/components/Info";
import { signSwatch } from "@/components/Sign";
import StaleNotice from "@/components/StaleNotice";
import { listAccounts, listBills, listCategories, listHobbySpending, listMonthlyIncome, listEntries, listGoals, listGoalVersions, listMonthlySpending, listPlanItems, listPlans, listPrices, listSpendingCategories, listTrades } from "@/lib/data";
import { runway } from "@/lib/runway";
import { savingsRate } from "@/lib/savings";
import { goalAssets } from "@/lib/goal-data";
import { monthsBetween, path, standing, targetValue, valueOn, valuesOn, withJoins } from "@/lib/goals";
import { addMonths } from "@/lib/plan";
import { day, money, pct, signedMoney, tone } from "@/lib/format";
import { daysBetween, extendTo, netWorthSeries } from "@/lib/performance";
import { combined, forecast, layered, model, volatility } from "@/lib/forecast";
import { incomePayments, payments } from "@/lib/plan";
import { accountEntries, holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { remindAfterDays } from "@/lib/types";

/**
 * Home answers three questions, each with one figure up front and the detail a tap away: how much you have, whether
 * it's going up, and whether your goals are on track.
 */
/** How far the "Where it's heading" chart looks back and ahead, in months. */
const SPANS = [
  { months: 3, label: "±3 months" },
  { months: 6, label: "±6 months" },
  { months: 12, label: "±1 year" },
  { months: 36, label: "±3 years" },
  { months: 60, label: "±5 years" },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const spanParam = (await searchParams).span;
  const span = SPANS.find((o) => String(o.months) === spanParam)?.months ?? 12;
  const cur = user.currency;

  const [accounts, entries, trades, prices, plans, planItems, categories] = await Promise.all([
    listAccounts(user.id), listEntries(user.id), listTrades(user.id), listPrices(user.id),
    listPlans(user.id), listPlanItems(user.id), listCategories(user.id),
  ]);
  const [goals, goalVersions, { listsOf: goalLists }] = await Promise.all([listGoals(user.id), listGoalVersions(user.id), goalAssets(user.id)]);
  const [spendingCats, monthlySpending, bills, monthlyIncome, hobbies] = await Promise.all([
    listSpendingCategories(user.id), listMonthlySpending(user.id), listBills(user.id), listMonthlyIncome(user.id), listHobbySpending(user.id),
  ]);
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
  // The chosen span (a year by default) back as recorded and ahead on the trend; the trend itself is always the last 12 months.
  const activeItems = planItems.filter((i) => activePlans.has(i.planId));
  // The trend is worked out per asset category (money saved, and investment growth compounding), so the
  // stacked view's layers add up to the total line.
  const catIds = [...new Set(rows.map((h) => h.account.categoryId))];
  const layers = catIds
    .map((id) => {
      const idx = rows.map((h, i) => (h.account.categoryId === id ? i : -1)).filter((i) => i >= 0);
      const c = categories.find((x) => x.id === id);
      return {
        id: String(id), name: c?.name ?? "Other", color: c?.color ?? "#8e8e93", rank: c ? categories.indexOf(c) : Infinity,
        series: extendTo(netWorthSeries(idx.map((i) => lists[i]), null, today), today),
        model: model(idx.map((i) => ({ entries: lists[i], investment: rows[i].investment })), today, 12),
      };
    })
    .sort((a, b) => a.rank - b.rank);
  // The likely range comes from how much all the investments together have swung month to month.
  const trendModel = { ...combined(layers.map((l) => l.model)), volatility: volatility(rows.map((h, i) => ({ entries: lists[i], investment: h.investment })), today, 12) };
  const ahead = forecast(history, today, payments(activeItems), span, 12, incomePayments(activeItems), trendModel);
  const layerRows = layered(ahead.points, layers, today);
  const layerInfo = layers.map(({ id, name, color }) => ({ id, name, color }));
  const planDue = ahead.payments.reduce((s, p) => s + p.amount, 0);
  const incomeDue = ahead.income.reduce((s, p) => s + p.amount, 0);
  const hasPlans = planDue > 0 || incomeDue > 0;
  // Costs and income together, in date order, for the list under "More detail".
  const planned = [...ahead.payments.map((p) => ({ ...p, income: false })), ...ahead.income.map((p) => ({ ...p, income: true }))].sort((a, b) => a.date.localeCompare(b.date));

  // How long the money you can reach within days would last on your essentials, if nothing came in.
  // How much of what comes in you keep, over the last 6 whole months with income recorded.
  const keep = savingsRate(today, monthlyIncome, monthlySpending, hobbies, bills, 6);
  const run = runway(rows.map((h) => ({ liquidity: h.account.liquidity, value: h.value })), spendingCats, monthlySpending, bills, today);

  const forecastEnd = hasPlans ? ahead.end.afterPlans : ahead.end.trend;

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
                The trend splits the last 12 months (or the time since your first record) in two: the money you put in or took out, averaged per month, and what your investments earned on their own. Both carry on: the money you put in adds up month by month, and your investments keep growing at their recent rate, compounding. A large one-off deposit therefore counts as money put in, not as growth.
                {ahead.end.low !== null && " The shaded band is a likely range: how far your investments could drift either way if the coming months swing as much as the last 12 did. About two times in three the value should land inside it; the money you put in is taken as certain."}
                {hasPlans && " The dotted line also takes off the costs in your plans, and adds their income, as they fall due."} It is a forecast only: your assets are not changed.
              </Info>
            </h2>
            <p className="text-xs text-ink-3">
              {ahead.basisMonths >= 1 ? (
                <>
                  Putting in <span className={`font-semibold ${tone(trendModel.saved)}`}>{signedMoney(trendModel.saved, cur)} a month</span>
                  {trendModel.invested > 0 && <>, investments growing <span className={`font-semibold ${tone(trendModel.rate)}`}>{pct((1 + trendModel.rate) ** 12 - 1)} a year</span></>}
                </>
              ) : "Not enough history for a trend yet"}
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">By {day(ahead.end.date)}{hasPlans && ", after plans"}</p>
            <p className={`num text-2xl font-extrabold ${forecastEnd < 0 ? "text-miss-text" : ""}`}>{money(forecastEnd, cur)}</p>
            {ahead.end.low !== null && ahead.end.high !== null && (
              <p className="num text-xs text-ink-3">likely {money(ahead.end.low, cur)} – {money(ahead.end.high, cur)}</p>
            )}
          </div>
        </div>
        <nav aria-label="How far to look" className="mb-3 inline-flex rounded-full bg-surface-2 p-0.5 text-xs font-semibold">
          {SPANS.map((o) => (
            <Link key={o.months} href={o.months === 12 ? "/" : `/?span=${o.months}`} scroll={false} aria-current={o.months === span ? "true" : undefined}
              className={`rounded-full px-3 py-1 ${o.months === span ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"}`}>
              {o.label}
            </Link>
          ))}
        </nav>
        <ForecastChart withBand={ahead.end.low !== null} points={ahead.points} layerRows={layerRows} layers={layerInfo} today={today} currency={cur} withPlans={hasPlans} />
        {hasPlans && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold text-ink-2">More detail</summary>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
              <Stat label="On trend" value={money(ahead.end.trend, cur)} />
              {planDue > 0 && <Stat label="Plan costs due" value={`−${money(planDue, cur)}`} cls="text-miss-text" />}
              {incomeDue > 0 && <Stat label="Plan income due" value={`+${money(incomeDue, cur)}`} cls="text-go-text" />}
              {hasPlans && <Stat label="After plans" value={money(ahead.end.afterPlans, cur)} cls={ahead.end.afterPlans < 0 ? "text-miss-text" : ""} />}
            </div>
            {planned.length > 0 && (
              <ul className="mt-3 divide-y divide-line">
                {planned.map((p, i) => (
                  <li key={`${p.itemId}-${p.date}-${i}`} className="flex items-center gap-3 py-2">
                    <span className="num w-24 shrink-0 text-ink-3">{day(p.date)}</span>
                    <span className="min-w-0 flex-1 truncate">{p.name}<span className="text-ink-3"> · {itemPlan.get(p.itemId)}</span></span>
                    <span className={`num font-semibold ${p.income ? "text-go-text" : ""}`}>{p.income ? "+" : ""}{money(p.amount, cur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </details>
        )}
      </section>

      {/* Could I cope without income? */}
      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg">
          Your safety net
          <Info label="About how long it would last">
            If nothing came in, how many months the assets you can turn into cash within days ({money(run.liquid, cur)}) would cover.
            Essentials are your Must and Need spending (and categories not sorted yet), averaged over the last {run.basisMonths || 6} whole months you recorded, plus your bills.
            Investments that take months or years to sell, and retirement money, are left out.
          </Info>
        </h2>
        <p className="mt-2 text-sm text-ink-2">How long it would last if nothing came in</p>
        {run.essentialMonths === null ? (
          <p className="mt-1 text-sm text-ink-3">
            Record your <Link href="/spending" className="font-semibold text-brand-dk">everyday spending</Link> or add your <Link href="/bills" className="font-semibold text-brand-dk">bills</Link> to see how long your cash would last.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="eyebrow">On essentials</p>
              <p className={`num text-2xl font-extrabold ${run.essentialMonths < 3 ? "text-miss-text" : ""}`}>{duration(run.essentialMonths)}</p>
              <p className="num text-xs text-ink-3">{money(run.essentials, cur)} a month</p>
            </div>
            {run.usualMonths !== null && run.usual > run.essentials && (
              <div>
                <p className="eyebrow">At your usual spending</p>
                <p className="num text-lg font-semibold">{duration(run.usualMonths)}</p>
                <p className="num text-xs text-ink-3">{money(run.usual, cur)} a month</p>
              </div>
            )}
            {run.essentialMonths < 3 && <p className="text-sm text-ink-3 sm:ml-auto sm:max-w-56">A common rule of thumb is to keep 3–6 months of essentials within easy reach.</p>}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-2 border-t border-line pt-4">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              Savings rate
              <Info label="About the savings rate">
                What you kept of your income over the last {keep.months.length || 6} whole months you recorded it: income less everyday spending, hobbies and bills (at their monthly cost), over income. Type each month&apos;s income on the Everyday spending page.
              </Info>
            </p>
            {keep.rate === null ? (
              <p className="text-sm text-ink-3"><Link href="/spending" className="font-semibold text-brand-dk">Add your income</Link> next to a month&apos;s spending to see it.</p>
            ) : (
              <p className={`num text-2xl font-extrabold ${keep.rate < 0 ? "text-miss-text" : ""}`}>{Math.round(keep.rate * 100)}%</p>
            )}
          </div>
          {keep.perMonth !== null && (
            <p className="num text-xs text-ink-3">
              {signedMoney(keep.perMonth, cur)} a month on average, over {keep.months.length} {keep.months.length === 1 ? "month" : "months"}
              {ahead.basisMonths >= 1 && <> · your assets took in {signedMoney(trendModel.saved, cur)} a month</>}
            </p>
          )}
        </div>
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
                    <GoalMiniChart points={chart} today={today} currency={cur} target={final ? milestone : null} label={`${goal.name}: your value against the plan until ${day(date)}`} />
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
                      <span className="flex items-center gap-1.5"><span className={`h-1 w-5 rounded-full ${signSwatch}`} />Actual</span>
                      <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-ink-3" />Plan</span>
                      <span className="flex items-center gap-1.5"><span className={`h-0.5 w-5 ${signSwatch}`} />Carrying on as planned</span>
                      {final && <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-go" />Target</span>}
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

/** "4.2 months", "under a month", or "2.5 years" past two years. */
function duration(months: number) {
  if (months < 1) return "Under a month";
  if (months >= 24) return `${(months / 12).toFixed(1)} years`;
  return `${months.toFixed(1)} months`;
}

function Stat({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={`num font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
