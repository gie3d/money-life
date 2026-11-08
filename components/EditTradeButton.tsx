"use client";

import { useActionState } from "react";
import { updateTotal, updateTrade, updateTransfer } from "@/app/actions/money";
import EditDialog from "./EditDialog";
import TradeFields from "./TradeFields";
import type { FormState } from "@/app/actions/auth";
import type { Trade } from "@/lib/types";

type Target = { id: number; name: string; archived: boolean };
const titleOf = (t: Trade) => (t.transfer ? "Edit transfer" : t.total ? "Edit total" : "Edit trade");

/** A pencil that opens the trade in a dialog, filled in, to change any of it. A total or a transfer is edited as itself. */
export default function EditTradeButton({ trade, currency, label, transferTargets = [] }: { trade: Trade; currency: string; label: string; transferTargets?: Target[] }) {
  return (
    <EditDialog label={label} title={titleOf(trade)}>
      {(close) => <EditForm trade={trade} currency={currency} transferTargets={transferTargets} onDone={close} />}
    </EditDialog>
  );
}

function EditForm({ trade, currency, transferTargets, onDone }: { trade: Trade; currency: string; transferTargets: Target[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = trade.transfer
      ? await updateTransfer(trade.transfer.id, prev, form)
      : trade.total
        ? await updateTotal(trade.accountId, trade.total.id, prev, form)
        : await updateTrade(trade.accountId, trade.id, prev, form);
    if (!result?.error) onDone();
    return result;
  }, undefined);

  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg">{titleOf(trade)}</h2>
      <TradeFields currency={currency} trade={trade} transferTargets={transferTargets} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-quiet">Cancel</button>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}
