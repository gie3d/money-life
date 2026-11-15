"use client";

import { useActionState } from "react";
import { createPlan } from "@/app/actions/plans";
import type { FormState } from "@/app/actions/auth";

export default function PlanForm({ kind = "expense" }: { kind?: "expense" | "income" }) {
  const income = kind === "income";
  const [state, action, pending] = useActionState<FormState, FormData>(createPlan, undefined);
  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">{income ? "Start an income plan" : "Start a plan"}</h2>
        <p className="text-xs text-ink-3">
          {income
            ? "Money you expect to come in, like your salary, a bonus or a new job. You add the amounts and dates next."
            : "Something you are going to pay for, like a new car or a trip to Japan. You add its costs next."}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="kind" value={kind} />
        <input name="name" required maxLength={80} placeholder={income ? "e.g. Salary" : "e.g. New car"} aria-label="Plan name" className="field" />
        <button className="btn shrink-0" disabled={pending}>{pending ? "Creating…" : "Create plan"}</button>
      </div>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
    </form>
  );
}
