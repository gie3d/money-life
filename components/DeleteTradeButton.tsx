"use client";

import { useActionState } from "react";
import { deleteTotal, deleteTrade } from "@/app/actions/money";
import type { FormState } from "@/app/actions/auth";
import ConfirmDelete from "./ConfirmDelete";

/** Deletes an entered trade, or with `totalId` the total a worked-out trade comes from. */
export default function DeleteTradeButton({ accountId, tradeId, totalId, label }: { accountId: number; tradeId: number; totalId?: number; label: string }) {
  const [state, action] = useActionState<FormState, FormData>(
    totalId !== undefined ? deleteTotal.bind(null, accountId, totalId) : deleteTrade.bind(null, accountId, tradeId),
    undefined,
  );
  return (
    <ConfirmDelete
      action={action}
      error={state?.error}
      title={totalId !== undefined ? "Delete this total?" : "Delete this trade?"}
      message={`${label}. Units held, cost and profit are worked out again without it.`}
      triggerLabel={label}
      triggerClassName="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
    >
      ×
    </ConfirmDelete>
  );
}
