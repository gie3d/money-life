"use client";

import { useActionState } from "react";
import { deleteTrade } from "@/app/actions/money";
import type { FormState } from "@/app/actions/auth";
import ConfirmDelete from "./ConfirmDelete";

export default function DeleteTradeButton({ accountId, tradeId, label }: { accountId: number; tradeId: number; label: string }) {
  const [state, action] = useActionState<FormState, FormData>(deleteTrade.bind(null, accountId, tradeId), undefined);
  return (
    <ConfirmDelete
      action={action}
      error={state?.error}
      title="Delete this trade?"
      message={`${label}. Units held, cost and profit are worked out again without it.`}
      triggerLabel={label}
      triggerClassName="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
    >
      ×
    </ConfirmDelete>
  );
}
