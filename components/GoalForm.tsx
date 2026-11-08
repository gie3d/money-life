"use client";

import { useActionState } from "react";
import { createGoal, reviseGoal } from "@/app/actions/goals";
import GoalFields from "./GoalFields";
import type { TickAsset } from "./AssetTicks";
import type { FormState } from "@/app/actions/auth";
import type { Goal, GoalVersion } from "@/lib/types";

/** The "New goal" card. */
export default function GoalForm({ currency, assets, today }: { currency: string; assets: TickAsset[]; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createGoal, undefined);
  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">New goal</h2>
        <p className="text-xs text-ink-3">Money to build up by a date: retirement, a child&apos;s education, a house deposit.</p>
      </div>
      <GoalFields currency={currency} assets={assets} today={today} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <button className="btn" disabled={pending || assets.length === 0}>{pending ? "Creating…" : "Create goal"}</button>
    </form>
  );
}

/** The revise form: the goal and its current plan to change; saving adds a new version and keeps the old ones. */
export function ReviseGoalForm({ goal, plan, currency, assets, today }: { goal: Goal; plan: GoalVersion; currency: string; assets: TickAsset[]; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reviseGoal.bind(null, goal.id), undefined);
  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <GoalFields currency={currency} assets={assets} goal={goal} plan={plan} today={today} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save as new version"}</button>
        <a href={`/goals/${goal.id}`} className="btn btn-quiet">Cancel</a>
      </div>
    </form>
  );
}
