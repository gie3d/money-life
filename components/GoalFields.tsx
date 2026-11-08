"use client";

import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TickAsset } from "./AssetTicks";
import DatePicker from "./DatePicker";
import NumberInput from "./NumberInput";
import { axisDate, compactMoney, day, dayWithAge, money, pct, plainNumber } from "@/lib/format";
import { LIFE_END_AGE, path, reachDate, requiredMonthly, retirementPath, targetValue, type Plan } from "@/lib/goals";
import { groupBy } from "@/lib/group";
import { addMonths } from "@/lib/plan";
import type { Goal, GoalVersion } from "@/lib/types";

const pctText = (f: number | null | undefined, fallback: string) => (f === null || f === undefined ? fallback : plainNumber(Math.round(f * 10000) / 100));
const parse = (s: string) => (s.trim() === "" ? NaN : Number(s));
type Row = { on: boolean; rate: string; monthly: string };

/**
 * The fields of a goal and its plan: blank for a new goal, or filled from the goal and its current plan to revise it.
 * Each ticked asset has its own expected growth and monthly amount; the chart runs the plan from what they are worth
 * now, so every number typed shows straight away as the savings line against the target.
 */
export default function GoalFields({ currency, assets, goal, plan, today }: {
  currency: string; assets: TickAsset[]; goal?: Goal; plan?: GoalVersion; today: string;
}) {
  const [kind, setKind] = useState<"retirement" | "other">(goal?.kind ?? "retirement");
  const [mode, setMode] = useState<"amount" | "spending">(plan?.targetMode ?? (goal?.kind === "other" ? "amount" : "spending"));
  const [birth, setBirth] = useState(goal?.birthDate ?? "");
  const [targetDate, setTargetDate] = useState(goal?.kind === "other" ? (plan?.targetDate ?? "") : "");
  const [f, setF] = useState({
    age: String(goal?.retireAge ?? 60),
    target: plan?.targetAmount != null ? plainNumber(plan.targetAmount) : "",
    spending: plan?.monthlySpending != null ? plainNumber(plan.monthlySpending) : "",
    withdrawal: pctText(plan?.withdrawalRate, "4"),
    inflation: pctText(plan?.inflation, "2.5"),
    growth: pctText(plan?.contributionGrowth, "0"),
    defaultRate: pctText(plan?.expectedReturn, "5"),
  });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const [rows, setRows] = useState<Record<number, Row>>(() => Object.fromEntries(assets.map((a) => {
    const mine = plan?.assets.find((x) => x.accountId === a.id);
    return [a.id, {
      on: goal?.accountIds.includes(a.id) ?? false,
      rate: mine ? pctText(mine.rate, "") : "",
      monthly: mine && mine.monthly > 0 ? plainNumber(mine.monthly) : "",
    }];
  })));
  const setRow = (id: number, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const setMany = (ids: number[], on: boolean) => setRows((r) => ({ ...r, ...Object.fromEntries(ids.map((id) => [id, { ...r[id], on }])) }));

  // The plan as typed, from today and what the ticked assets are worth now.
  const ticked = assets.filter((a) => rows[a.id]?.on);
  const fallback = parse(f.defaultRate) / 100;
  const goalDate = kind === "retirement" ? (birth ? addMonths(birth, (parse(f.age) || 0) * 12) : "") : targetDate;
  const draft: Plan = {
    startDate: today, startValue: 0, targetDate: goalDate, targetMode: mode,
    targetAmount: parse(f.target), monthlySpending: parse(f.spending), withdrawalRate: parse(f.withdrawal) / 100,
    expectedReturn: fallback, inflation: (parse(f.inflation) || 0) / 100, monthlyContribution: 0,
    contributionGrowth: (parse(f.growth) || 0) / 100,
    assets: ticked.map((a) => {
      const r = parse(rows[a.id].rate);
      return { accountId: a.id, startValue: a.value, rate: Number.isFinite(r) ? r / 100 : fallback, monthly: parse(rows[a.id].monthly) || 0 };
    }),
  };
  const now = ticked.reduce((s, a) => s + a.value, 0);
  const monthlyTotal = draft.assets!.reduce((s, a) => s + a.monthly, 0);
  const ready = goalDate > today && ticked.length > 0 && draft.assets!.every((a) => Number.isFinite(a.rate))
    && (mode === "amount" ? (draft.targetAmount ?? 0) > 0 : (draft.monthlySpending ?? 0) > 0 && draft.withdrawalRate > 0);
  const target = ready ? targetValue(draft) : 0;
  const points = ready ? path(draft) : [];
  const end = points.at(-1)?.value ?? 0;
  const need = ready ? requiredMonthly(draft, 0) : null;
  const reach = ready ? reachDate(draft, 0) : null;
  // After retiring: the money being spent down, up to the age of 95 (only when the plan has monthly spending).
  const showRetired = ready && kind === "retirement" && mode === "spending" && !!birth && (parse(f.age) || 0) < LIFE_END_AGE;
  const retired = showRetired ? retirementPath(draft, end, addMonths(birth, LIFE_END_AGE * 12)) : [];
  const lastsToAge = retired.length > 0 && retired.at(-1)!.value <= 0
    ? Math.floor((Date.parse(`${retired.at(-1)!.date}T00:00:00Z`) - Date.parse(`${birth}T00:00:00Z`)) / (365.25 * 86_400_000)) : null;
  const chart: { date: string; savings?: number; paidIn?: number; retired?: number }[] = [
    ...points.map((p, i) => ({ date: p.date, savings: p.value, paidIn: now + p.contributed, ...(showRetired && i === points.length - 1 ? { retired: p.value } : {}) })),
    ...retired.slice(1).map((p) => ({ date: p.date, retired: p.value })),
  ];

  const pctInput = (name: string, label: string, key: keyof typeof f, hint?: string) => (
    <label className="block space-y-1.5">
      <span className="eyebrow">{label}</span>
      <div className="relative">
        <NumberInput name={name} value={f[key]} onValueChange={set(key)} className="field pr-8" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">%</span>
      </div>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </label>
  );
  const chip = (checked: boolean) =>
    `inline-block rounded-full px-4 py-1.5 text-sm font-semibold ${checked ? "bg-ink text-surface" : "bg-surface-2 text-ink-3"}`;

  return (
    <div className="space-y-5">
      {/* The goal: what and when */}
      <section className="card space-y-4 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="eyebrow">Name</span>
            <input name="name" required defaultValue={goal?.name ?? "Retirement"} placeholder="e.g. Retirement, Kids' education" className="field" />
          </label>
          {goal ? <input type="hidden" name="kind" value={kind} /> : (
            <div className="block space-y-1.5">
              <span className="eyebrow">Kind</span>
              <div className="flex gap-2">
                {(["retirement", "other"] as const).map((k) => (
                  <label key={k} className="cursor-pointer">
                    <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => { setKind(k); if (k === "other") setMode("amount"); }} className="sr-only" />
                    <span className={chip(kind === k)}>{k === "retirement" ? "Retirement" : "Other goal"}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {kind === "retirement" ? (
            <>
              <div className="block space-y-1.5">
                <span className="eyebrow">Birth date</span>
                <DatePicker name="birth_date" label="Birth date" defaultValue={goal?.birthDate ?? undefined} onChange={setBirth} />
              </div>
              <label className="block space-y-1.5">
                <span className="eyebrow">Retire at age</span>
                <NumberInput name="retire_age" value={f.age} onValueChange={set("age")} className="field" />
                {goalDate && <p className="text-xs text-ink-3">That is {day(goalDate)}.</p>}
              </label>
            </>
          ) : (
            <div className="block space-y-1.5">
              <span className="eyebrow">Goal date</span>
              <DatePicker name="target_date" label="Goal date" defaultValue={plan?.targetDate} onChange={setTargetDate} />
            </div>
          )}
          <div className="block space-y-1.5">
            <span className="eyebrow">Plan starts</span>
            <DatePicker name="start_date" label="Plan starts" defaultValue={today} />
            <p className="text-xs text-ink-3">Usually today.</p>
          </div>
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-base font-bold">Target</span>
            {kind === "retirement" && (["spending", "amount"] as const).map((m) => (
              <label key={m} className="cursor-pointer">
                <input type="radio" name="target_mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
                <span className={chip(mode === m)}>{m === "spending" ? "Monthly spending" : "Fixed amount"}</span>
              </label>
            ))}
            {kind === "other" && <input type="hidden" name="target_mode" value="amount" />}
          </div>
          {mode === "amount" ? (
            <label className="block max-w-sm space-y-1.5">
              <span className="eyebrow">Amount to have on the date ({currency})</span>
              <NumberInput name="target_amount" value={f.target} onValueChange={set("target")} placeholder="0" className="field" />
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1.5">
                <span className="eyebrow">Spending a month ({currency})</span>
                <NumberInput name="monthly_spending" value={f.spending} onValueChange={set("spending")} placeholder="0" className="field" />
                <p className="text-xs text-ink-3">In today&apos;s money; inflation is added.</p>
              </label>
              {pctInput("withdrawal_rate", "Withdrawal rate", "withdrawal", "Taken out each year. 4% needs 25 years' spending.")}
              {pctInput("inflation", "Inflation a year", "inflation")}
            </div>
          )}
          {mode === "amount" && <><input type="hidden" name="inflation" value={f.inflation} /><input type="hidden" name="withdrawal_rate" value={f.withdrawal} /></>}
        </div>
      </section>

      {/* The chart, right where the numbers are typed */}
      <section className="card p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-end gap-x-8 gap-y-3">
          <Figure label="Target" value={ready ? money(target, currency) : "—"} hint={ready ? `on ${day(goalDate)}` : undefined} />
          <Figure label="Savings by then" value={ready ? money(end, currency) : "—"} cls={ready ? (end >= target ? "text-go-text" : "text-miss-text") : ""}
            hint={ready ? (end >= target ? `reaches the target ${reach ? `on ${day(reach)}` : ""}` : `${money(target - end, currency)} short`) : undefined} />
          <Figure label="Put in each month" value={money(monthlyTotal, currency)} hint={parse(f.growth) > 0 ? `rising ${f.growth}% a year` : undefined} />
          {showRetired && (
            <Figure label={`Money at ${LIFE_END_AGE}`} value={money(retired.at(-1)?.value ?? 0, currency)} cls={lastsToAge === null ? "text-go-text" : "text-miss-text"}
              hint={lastsToAge === null ? "after spending as planned" : `runs out at about ${lastsToAge}`} />
          )}
          {need !== null && <Figure label="Needed each month" value={money(need, currency)} hint="to land on the target" />}
        </div>
        {ready ? (
          <>
            <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
              <li className="flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-brand" />Savings</li>
              <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-ink-3" />Money put in</li>
              {showRetired && <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dotted border-sky" />After retiring</li>}
              <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-go" />Target</li>
            </ul>
            <div className="h-72 w-full" role="img" aria-label="Savings growing towards the target, then spent down in retirement">
              <ResponsiveContainer>
                <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goal-savings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => axisDate(d, true)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={40} />
                  <YAxis width={56} tickFormatter={(n: number) => compactMoney(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, (max: number) => Math.max(max, target) * 1.05]} />
                  <ReferenceLine y={target} stroke="var(--go)" strokeWidth={2} />
                  <Tooltip
                    labelFormatter={(d) => dayWithAge(String(d), kind === "retirement" ? birth : null)}
                    formatter={(v, name) => [money(Number(v), currency), name === "savings" ? "Savings" : name === "retired" ? "After retiring" : "Money put in"]}
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
                  />
                  <Area type="monotone" dataKey="savings" stroke="var(--brand)" strokeWidth={2.5} fill="url(#goal-savings)" />
                  {showRetired && <ReferenceLine x={goalDate} stroke="var(--ink-3)" strokeDasharray="2 3" />}
                  <Line type="monotone" dataKey="retired" stroke="var(--sky)" strokeWidth={2.5} strokeDasharray="1 4" strokeLinecap="round" dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="paidIn" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="py-16 text-center text-sm text-ink-3">
            {ticked.length === 0 ? "Tick the assets that count below to see your savings grow." : "Fill in the date and the target to see the chart."}
          </p>
        )}
      </section>

      {/* The assets: tick, then growth and monthly amount for each */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 p-4 sm:px-6">
          <div>
            <h2 className="text-lg">Assets that count</h2>
            <p className="text-xs text-ink-3">Tick what you&apos;re building the goal with, then give each its expected growth and what you&apos;ll put in a month.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="w-36">{pctInput("default_rate", "Growth if blank", "defaultRate")}</div>
            <div className="w-36">{pctInput("contribution_growth", "Raise monthly by", "growth")}</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="eyebrow text-left">
                <th className="w-10 py-2 pl-4 sm:pl-6"><span className="sr-only">Counts</span></th>
                <th className="py-2">Asset</th>
                <th className="py-2 text-right">Value now</th>
                <th className="py-2 text-right">Last 12 months</th>
                <th className="py-2 text-right">Growth a year</th>
                <th className="py-2 pr-4 text-right sm:pr-6">Put in a month</th>
              </tr>
            </thead>
            {groupBy(assets, (a) => a.categoryId).map(({ key, items }) => {
              const ids = items.map((a) => a.id);
              const on = ids.filter((id) => rows[id]?.on).length;
              return (
                <tbody key={key}>
                  <tr className="bg-surface-2 font-bold">
                    <td className="py-2 pl-4 sm:pl-6">
                      <input type="checkbox" checked={on === ids.length} ref={(el) => { if (el) el.indeterminate = on > 0 && on < ids.length; }}
                        onChange={(e) => setMany(ids, e.target.checked)} aria-label={`All of ${items[0].category}`} className="size-4 accent-[var(--brand)]" />
                    </td>
                    <td className="py-2" colSpan={5}>
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: items[0].color }} />
                        {items[0].category}
                      </span>
                    </td>
                  </tr>
                  {items.map((a) => {
                    const r = rows[a.id];
                    return (
                      <tr key={a.id} className={r.on ? "" : "text-ink-3"}>
                        <td className="py-2 pl-4 sm:pl-6">
                          <input type="checkbox" name="asset" value={a.id} checked={r.on} onChange={(e) => setRow(a.id, { on: e.target.checked })}
                            aria-label={`${a.name} counts towards the goal`} className="size-4 accent-[var(--brand)]" />
                        </td>
                        <td className="py-2 pl-4 font-semibold">{a.name}</td>
                        <td className="num py-2 text-right">{money(a.value, currency)}</td>
                        <td className={`num py-2 text-right ${a.pastReturn == null ? "" : a.pastReturn >= 0 ? "text-go-text" : "text-miss-text"}`}>{a.pastReturn == null ? "—" : pct(a.pastReturn)}</td>
                        <td className="py-1.5">
                          <div className="relative ml-auto w-24">
                            <NumberInput name={`rate-${a.id}`} value={r.rate} onValueChange={(v) => setRow(a.id, { rate: v })} disabled={!r.on}
                              placeholder={f.defaultRate} aria-label={`Expected growth a year of ${a.name}`} className="field num py-1.5 pr-7 text-right disabled:opacity-40" />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3">%</span>
                          </div>
                        </td>
                        <td className="py-1.5 pr-4 sm:pr-6">
                          <NumberInput name={`monthly-${a.id}`} value={r.monthly} onValueChange={(v) => setRow(a.id, { monthly: v })} disabled={!r.on}
                            placeholder="0" aria-label={`Put into ${a.name} each month (${currency})`} className="field num ml-auto block w-32 py-1.5 text-right disabled:opacity-40" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
            <tfoot>
              <tr className="font-bold">
                <td className="py-2.5 pl-4 sm:pl-6" colSpan={2}>Ticked</td>
                <td className="num py-2.5 text-right">{money(now, currency)}</td>
                <td colSpan={2} />
                <td className="num py-2.5 pr-4 text-right sm:pr-6">{money(monthlyTotal, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="px-4 pb-4 pt-2 text-xs text-ink-3 sm:px-6">
          &ldquo;Last 12 months&rdquo; is what each asset actually returned, with money put in or taken out set aside, as a guide. Growth is a yearly rate before inflation; a blank one uses &ldquo;Growth if blank&rdquo;.
        </p>
      </section>

      {plan && (
        <section className="card p-5 sm:p-6">
          <label className="block space-y-1.5">
            <span className="eyebrow">What changed (optional)</span>
            <input name="plan_note" placeholder="e.g. Raised contributions after promotion" className="field" />
          </label>
        </section>
      )}
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
