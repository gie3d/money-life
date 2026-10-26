"use client";

import { useActionState, useRef } from "react";
import { addTrade } from "@/app/actions/money";
import DatePicker from "./DatePicker";
import type { FormState } from "@/app/actions/auth";

export default function TradeForm({ accountId, currency }: { accountId: number; currency: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await addTrade(accountId, prev, form);
    if (!result?.error) ref.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={ref} action={action} className="card space-y-4 p-5 sm:p-6">
      <h2 className="text-lg">Record a trade</h2>
      <fieldset className="flex gap-2">
        <legend className="sr-only">Buy or sell</legend>
        {(["buy", "sell"] as const).map((side) => (
          <label key={side} className="cursor-pointer">
            <input type="radio" name="side" value={side} defaultChecked={side === "buy"} className="peer sr-only" />
            <span className="inline-block rounded-full bg-surface-2 px-5 py-2 text-sm font-semibold capitalize text-ink-3 peer-checked:bg-ink peer-checked:text-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky">
              {side}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="block space-y-1.5">
          <span className="eyebrow">Date</span>
          <DatePicker name="date" label="Date" />
        </div>
        <label className="block space-y-1.5">
          <span className="eyebrow">Units</span>
          <input name="quantity" inputMode="decimal" required placeholder="0" className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">Price per unit ({currency})</span>
          <input name="price" inputMode="decimal" required placeholder="0" className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">Trading fee ({currency})</span>
          <input name="fee" inputMode="decimal" placeholder="0" className="field" />
        </label>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="eyebrow">Note (optional)</span>
          <input name="note" className="field" />
        </label>
      </div>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save trade"}</button>
    </form>
  );
}
