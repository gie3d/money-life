"use client";

import { useActionState, useState } from "react";
import { addTrade } from "@/app/actions/money";
import TradeFields from "./TradeFields";
import type { FormState } from "@/app/actions/auth";

export default function TradeForm({ accountId, currency }: { accountId: number; currency: string }) {
  // The fields hold their own state, so a saved trade is cleared by starting them afresh.
  const [fresh, setFresh] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await addTrade(accountId, prev, form);
    if (!result?.error) setFresh((n) => n + 1);
    return result;
  }, undefined);

  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <h2 className="text-lg">Record a trade</h2>
      <TradeFields key={fresh} currency={currency} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save trade"}</button>
    </form>
  );
}
