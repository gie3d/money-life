"use client";

import { useActionState, useRef } from "react";
import { setPrice } from "@/app/actions/money";
import DatePicker from "./DatePicker";
import type { FormState } from "@/app/actions/auth";

export default function PriceForm({ accountId, currency }: { accountId: number; currency: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await setPrice(accountId, prev, form);
    if (!result?.error) ref.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={ref} action={action} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">Update the current price</h2>
        <p className="text-xs text-ink-3">The market price of one unit. Entered by hand for now; it&apos;s what turns units into a current value.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="block space-y-1.5">
          <span className="eyebrow">Date</span>
          <DatePicker name="date" label="Date" />
        </div>
        <label className="block space-y-1.5">
          <span className="eyebrow">Price per unit ({currency})</span>
          <input name="price" inputMode="decimal" required placeholder="0" className="field" />
        </label>
      </div>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save price"}</button>
    </form>
  );
}
