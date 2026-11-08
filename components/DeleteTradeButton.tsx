"use client";

import { useActionState } from "react";
import { deleteTotal, deleteTrade, deleteTransfer } from "@/app/actions/money";
import type { FormState } from "@/app/actions/auth";
import ConfirmDelete from "./ConfirmDelete";

/** Deletes an entered trade, or the total or transfer (both of its sides) a worked-out trade comes from. */
export default function DeleteTradeButton({ accountId, tradeId, totalId, transferId, label }: {
  accountId: number; tradeId: number; totalId?: number; transferId?: number; label: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    transferId !== undefined ? deleteTransfer.bind(null, transferId)
    : totalId !== undefined ? deleteTotal.bind(null, accountId, totalId)
    : deleteTrade.bind(null, accountId, tradeId),
    undefined,
  );
  return (
    <ConfirmDelete
      action={action}
      error={state?.error}
      title={transferId !== undefined ? "Delete this transfer?" : totalId !== undefined ? "Delete this total?" : "Delete this trade?"}
      message={`${label}. ${transferId !== undefined ? "It is removed from both assets, and their units," : "Units held,"} cost and profit are worked out again without it.`}
      triggerLabel={label}
      triggerClassName="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
    >
      ×
    </ConfirmDelete>
  );
}
