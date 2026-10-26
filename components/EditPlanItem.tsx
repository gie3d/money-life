"use client";

import { useActionState } from "react";
import { updatePlanItem } from "@/app/actions/plans";
import EditDialog from "./EditDialog";
import PlanItemFields from "./PlanItemFields";
import { day } from "@/lib/format";
import type { FormState } from "@/app/actions/auth";
import type { PlanItem } from "@/lib/types";

export default function EditPlanItem({ item, currency }: { item: PlanItem; currency: string }) {
  return (
    <EditDialog label={`Edit ${item.name}`} title="Edit cost">
      {(close) => <Form item={item} currency={currency} onDone={close} />}
    </EditDialog>
  );
}

function Form({ item, currency, onDone }: { item: PlanItem; currency: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await updatePlanItem(item.id, prev, form);
    if (!result?.error) onDone();
    return result;
  }, undefined);

  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg">Edit cost</h2>
      <PlanItemFields currency={currency} item={item} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-quiet">Cancel</button>
        <button className="btn" disabled={pending} aria-label={`Save changes to ${item.name} from ${day(item.startDate)}`}>{pending ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}
