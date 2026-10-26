"use client";

import { useActionState } from "react";
import { updatePrice } from "@/app/actions/money";
import DatePicker from "./DatePicker";
import EditDialog from "./EditDialog";
import NumberInput from "./NumberInput";
import { day, plainNumber } from "@/lib/format";
import type { FormState } from "@/app/actions/auth";

/**
 * Edit one row of the price history. A price entered by hand can change in date and amount.
 * A price that comes from a trade stays on its trade's day; saving a new amount records a price
 * for that day, which takes the trade's place in the history. The trade itself is left alone.
 */
export default function EditPriceButton({ accountId, row, currency }: { accountId: number; row: { id?: number; date: string; price: number }; currency: string }) {
  return (
    <EditDialog label={`Edit price from ${day(row.date)}`} title="Edit price">
      {(close) => <EditForm accountId={accountId} row={row} currency={currency} onDone={close} />}
    </EditDialog>
  );
}

function EditForm({ accountId, row, currency, onDone }: { accountId: number; row: { id?: number; date: string; price: number }; currency: string; onDone: () => void }) {
  const fromTrade = row.id === undefined;
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await updatePrice(accountId, row.id ?? null, prev, form);
    if (!result?.error) onDone();
    return result;
  }, undefined);

  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg">Edit price</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="block space-y-1.5">
          <span className="eyebrow">Date</span>
          {fromTrade ? (
            <>
              <input type="hidden" name="date" value={row.date} />
              <p className="field num">{day(row.date)}</p>
            </>
          ) : (
            <DatePicker name="date" label="Date" defaultValue={row.date} />
          )}
        </div>
        <label className="block space-y-1.5">
          <span className="eyebrow">Price per unit ({currency})</span>
          <NumberInput name="price" required placeholder="0" defaultValue={plainNumber(row.price)} className="field" />
        </label>
      </div>
      {fromTrade && <p className="text-xs text-ink-3">This price comes from a trade on that day. Saving here records a price of your own for the day, which replaces it in the history; the trade is unchanged.</p>}
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-quiet">Cancel</button>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}
