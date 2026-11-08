"use client";

import { useState } from "react";
import AssetTicks, { type TickAsset } from "./AssetTicks";
import DatePicker from "./DatePicker";
import NumberInput from "./NumberInput";
import { money, plainNumber } from "@/lib/format";
import { path, requiredMonthly, targetValue } from "@/lib/goals";
import { addMonths } from "@/lib/plan";
import type { Goal, GoalVersion } from "@/lib/types";

const pctText = (f: number | null | undefined, fallback: string) => (f === null || f === undefined ? fallback : plainNumber(Math.round(f * 10000) / 100));
const parse = (s: string) => (s.trim() === "" ? NaN : Number(s));

/**
 * The fields of a goal and its plan: blank for a new goal, or filled from the goal and its current plan to revise it.
 * The preview runs the plan from what the ticked assets are worth now, so the effect of each number shows at once.
 */
export default function GoalFields({ currency, assets, goal, plan, today }: {
  currency: string; assets: TickAsset[]; goal?: Goal; plan?: GoalVersion; today: string;
}) {
  const [kind, setKind] = useState<"retirement" | "other">(goal?.kind ?? "retirement");
  const [mode, setMode] = useState<"amount" | "spending">(plan?.targetMode ?? (goal?.kind === "other" ? "amount" : "spending"));
  const [birth, setBirth] = useState(goal?.birthDate ?? "");
  const [f, setF] = useState({
    age: String(goal?.retireAge ?? 60),
    target: plan?.targetAmount != null ? plainNumber(plan.targetAmount) : "",
    spending: plan?.monthlySpending != null ? plainNumber(plan.monthlySpending) : "",
    withdrawal: pctText(plan?.withdrawalRate, "4"),
    ret: pctText(plan?.expectedReturn, "6"),
    inflation: pctText(plan?.inflation, "2.5"),
    monthly: plan ? plainNumber(plan.monthlyContribution) : "",
    growth: pctText(plan?.contributionGrowth, "0"),
  });
  const [targetDate, setTargetDate] = useState(goal?.kind === "other" ? (plan?.targetDate ?? "") : "");
  const [ticked, setTicked] = useState<number[]>(goal?.accountIds ?? []);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  // The preview: from today and what the ticked assets are worth now.
  const now = assets.filter((a) => ticked.includes(a.id)).reduce((s, a) => s + a.value, 0);
  const goalDate = kind === "retirement" ? (birth ? addMonths(birth, (parse(f.age) || 0) * 12) : "") : targetDate;
  const draft = {
    startDate: today, startValue: now, targetDate: goalDate, targetMode: mode,
    targetAmount: parse(f.target), monthlySpending: parse(f.spending), withdrawalRate: parse(f.withdrawal) / 100,
    expectedReturn: parse(f.ret) / 100, inflation: (parse(f.inflation) || 0) / 100,
    monthlyContribution: parse(f.monthly) || 0, contributionGrowth: (parse(f.growth) || 0) / 100,
  };
  const ready = goalDate > today && Number.isFinite(draft.expectedReturn)
    && (mode === "amount" ? draft.targetAmount > 0 : draft.monthlySpending > 0 && draft.withdrawalRate > 0);
  const target = ready ? targetValue(draft) : 0;
  const end = ready ? path(draft).at(-1)!.value : 0;
  const need = ready ? requiredMonthly(draft, 0, now) : null;

  const pct = (name: string, label: string, key: keyof typeof f, hint?: string) => (
    <label className="block space-y-1.5">
      <span className="eyebrow">{label}</span>
      <div className="relative">
        <NumberInput name={name} value={f[key]} onValueChange={set(key)} className="field pr-8" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">%</span>
      </div>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="eyebrow">Name</span>
          <input name="name" required defaultValue={goal?.name ?? (kind === "retirement" ? "Retirement" : "")} placeholder="e.g. Retirement, Kids' education" className="field" />
        </label>
        {goal ? (
          <input type="hidden" name="kind" value={kind} />
        ) : (
          <div className="block space-y-1.5">
            <span className="eyebrow">Kind</span>
            <div className="flex gap-2">
              {(["retirement", "other"] as const).map((k) => (
                <label key={k} className="cursor-pointer">
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => { setKind(k); if (k === "other") setMode("amount"); }} className="peer sr-only" />
                  <span className="inline-block rounded-full bg-surface-2 px-5 py-2 text-sm font-semibold text-ink-3 peer-checked:bg-ink peer-checked:text-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-sky">
                    {k === "retirement" ? "Retirement" : "Other goal"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-base font-bold">When</legend>
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
            <p className="text-xs text-ink-3">Usually today. An earlier date compares you with the plan from then.</p>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-base font-bold">Target</legend>
        {kind === "retirement" && (
          <div className="flex gap-2">
            {(["spending", "amount"] as const).map((m) => (
              <label key={m} className="cursor-pointer">
                <input type="radio" name="target_mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="peer sr-only" />
                <span className="inline-block rounded-full bg-surface-2 px-4 py-1.5 text-sm font-semibold text-ink-3 peer-checked:bg-ink peer-checked:text-surface">
                  {m === "spending" ? "Monthly spending" : "Fixed amount"}
                </span>
              </label>
            ))}
          </div>
        )}
        {kind === "other" && <input type="hidden" name="target_mode" value="amount" />}
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
            {pct("withdrawal_rate", "Withdrawal rate", "withdrawal", "Taken out each year. 4% needs a fund of 25 years' spending.")}
            {pct("inflation", "Inflation a year", "inflation")}
          </div>
        )}
        {mode === "amount" && <input type="hidden" name="inflation" value={f.inflation} />}
        {mode === "amount" && <input type="hidden" name="withdrawal_rate" value={f.withdrawal} />}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-base font-bold">How you get there</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="eyebrow">Put in each month ({currency})</span>
            <NumberInput name="monthly_contribution" value={f.monthly} onValueChange={set("monthly")} placeholder="0" className="field" />
          </label>
          {pct("contribution_growth", "Raise it each year by", "growth", "e.g. with your salary. 0 keeps it the same.")}
          {pct("expected_return", "Expected return a year", "ret", "Before inflation. Your Performance tab shows what you've had.")}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-base font-bold">Assets that count</legend>
        <p className="text-xs text-ink-3">What you are building the goal with, e.g. RMF, SSF, retirement insurance. Leave out money meant for other things.</p>
        <AssetTicks assets={assets} initial={goal?.accountIds ?? []} currency={currency} onChange={setTicked} />
      </fieldset>

      {plan && (
        <label className="block space-y-1.5">
          <span className="eyebrow">What changed (optional)</span>
          <input name="plan_note" placeholder="e.g. Raised contributions after promotion" className="field" />
        </label>
      )}

      <div className="rounded-2xl bg-surface-2 p-4 text-sm">
        {ready ? (
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div><p className="eyebrow">Target</p><p className="num text-lg font-bold">{money(target, currency)}</p></div>
            <div>
              <p className="eyebrow">On this plan by then</p>
              <p className={`num text-lg font-bold ${end >= target ? "text-go-text" : "text-miss-text"}`}>{money(end, currency)}</p>
              <p className="num text-xs text-ink-3">from {money(now, currency)} today</p>
            </div>
            {need !== null && (
              <div>
                <p className="eyebrow">Needed each month</p>
                <p className="num text-lg font-bold">{money(need, currency)}</p>
                <p className="text-xs text-ink-3">{f.growth && parse(f.growth) > 0 ? `rising ${f.growth}% a year` : "to land on the target"}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-ink-3">Fill in the date, target and return to see where this plan leads.</p>
        )}
      </div>
    </div>
  );
}
