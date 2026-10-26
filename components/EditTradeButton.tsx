"use client";

import { useActionState } from "react";
import { updateTrade } from "@/app/actions/money";
import EditDialog from "./EditDialog";
import TradeFields from "./TradeFields";
import type { FormState } from "@/app/actions/auth";
import type { Trade } from "@/lib/types";

/** A pencil that opens the trade in a dialog, filled in, to change any of it. */
export default function EditTradeButton({ trade, currency, label }: { trade: Trade; currency: string; label: string }) {
  return (
    <EditDialog label={label} title="Edit trade">
      {(close) => <EditForm trade={trade} currency={currency} onDone={close} />}
    </EditDialog>
  );
}

function EditForm({ trade, currency, onDone }: { trade: Trade; currency: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await updateTrade(trade.accountId, trade.id, prev, form);
    if (!result?.error) onDone();
    return result;
  }, undefined);

  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg">Edit trade</h2>
      <TradeFields currency={currency} trade={trade} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-quiet">Cancel</button>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}
