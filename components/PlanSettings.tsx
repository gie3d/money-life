"use client";

import { useActionState, useState } from "react";
import { updatePlan } from "@/app/actions/plans";
import NumberInput from "./NumberInput";
import { plainNumber } from "@/lib/format";
import type { FormState } from "@/app/actions/auth";
import type { Plan } from "@/lib/types";

export default function PlanSettings({ plan, currency }: { plan: Plan; currency: string }) {
  const [saved, setSaved] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await updatePlan(plan.id, prev, form);
    setSaved(!result?.error);
    return result;
  }, undefined);
  return (
    // Editing again clears the "Saved" note, so it never claims more than was saved.
    <form action={action} onChange={() => setSaved(false)} className="card space-y-4 p-5 sm:p-6">
      <h2 className="text-lg">Plan settings</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="eyebrow">Name</span>
          <input name="name" required maxLength={80} defaultValue={plan.name} className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">Saving towards it each month ({currency})</span>
          <NumberInput name="saving" placeholder="0" defaultValue={plan.monthlySaving > 0 ? plainNumber(plan.monthlySaving) : ""} className="field" />
        </label>
      </div>
      <p className="text-xs text-ink-3">Money you expect to set aside every month, on top of the assets chosen below. It is added to the funds month by month.</p>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
        {saved && !pending && <p role="status" className="text-sm font-semibold text-go-text">Saved</p>}
      </div>
    </form>
  );
}
