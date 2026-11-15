"use client";

import { useActionState, useState } from "react";
import { addPlanItem } from "@/app/actions/plans";
import PlanItemFields from "./PlanItemFields";
import type { FormState } from "@/app/actions/auth";
import type { PlanItemKind } from "@/lib/types";

export default function PlanItemForm({ planId, currency, kind = "cost" }: { planId: number; currency: string; kind?: PlanItemKind }) {
  const income = kind === "income";
  // The fields hold their own state, so a saved cost is cleared by starting them afresh.
  const [fresh, setFresh] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await addPlanItem(planId, prev, form);
    if (!result?.error) setFresh((n) => n + 1);
    return result;
  }, undefined);

  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">{income ? "Add income" : "Add a cost"}</h2>
        <p className="text-xs text-ink-3">
          {income
            ? "Money you expect in, like a bonus on a date, or a recurring one like your salary. It is added to where your total is heading on Home."
            : "A one-time cost on a date, like a down payment, or one that repeats, like a monthly instalment."}
        </p>
      </div>
      <PlanItemFields key={fresh} currency={currency} kind={kind} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Adding…" : income ? "Add income" : "Add cost"}</button>
    </form>
  );
}
