"use client";

import { useActionState, useState } from "react";
import { createBill, updateBill } from "@/app/actions/bills";
import BillFields, { type PayFrom } from "./BillFields";
import EditDialog from "./EditDialog";
import type { FormState } from "@/app/actions/auth";
import type { Bill } from "@/lib/types";

/** The "Add a bill" card. */
export default function BillForm({ currency, groups, accounts }: { currency: string; groups: string[]; accounts: PayFrom[] }) {
  // The fields hold their own state, so a saved bill is cleared by starting them afresh.
  const [fresh, setFresh] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await createBill(prev, form);
    if (!result?.error) setFresh((n) => n + 1);
    return result;
  }, undefined);
  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">Add a bill</h2>
        <p className="text-xs text-ink-3">Something you pay regularly: rent, electricity, phone, internet, a subscription.</p>
      </div>
      <BillFields key={fresh} currency={currency} groups={groups} accounts={accounts} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Adding…" : "Add bill"}</button>
    </form>
  );
}

/** A pencil that opens a bill in a dialog to change it. */
export function EditBillButton({ bill, currency, groups, accounts }: { bill: Bill; currency: string; groups: string[]; accounts: PayFrom[] }) {
  return (
    <EditDialog label={`Edit ${bill.name}`} title="Edit bill" wide>
      {(close) => <EditForm bill={bill} currency={currency} groups={groups} accounts={accounts} onDone={close} />}
    </EditDialog>
  );
}

function EditForm({ bill, currency, groups, accounts, onDone }: { bill: Bill; currency: string; groups: string[]; accounts: PayFrom[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await updateBill(bill.id, prev, form);
    if (!result?.error) onDone();
    return result;
  }, undefined);
  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg">Edit bill</h2>
      <BillFields currency={currency} bill={bill} groups={groups} accounts={accounts} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-quiet">Cancel</button>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}
