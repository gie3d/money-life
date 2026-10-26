"use client";

import { useActionState, useState } from "react";
import { updateValues } from "@/app/actions/money";
import DatePicker from "./DatePicker";
import EditDialog from "./EditDialog";
import NumberInput from "./NumberInput";
import { money, plainNumber } from "@/lib/format";
import type { FormState } from "@/app/actions/auth";

export type ValueRow = {
  id: number;
  name: string;
  color: string;
  investment: boolean;
  /** Units held, for an investment. */
  units: number | null;
  /** Price per unit (investment) or balance (cash, saving) now; null when none is recorded yet. */
  current: number | null;
};

/** The "Update values" button and its dialog: one date, then a new price or balance per asset. */
export default function UpdateValues({ rows, currency }: { rows: ValueRow[]; currency: string }) {
  return (
    <EditDialog label="Update values" title="Update values" trigger="Update values" wide>
      {(close) => <Form rows={rows} currency={currency} onDone={close} />}
    </EditDialog>
  );
}

function Form({ rows, currency, onDone }: { rows: ValueRow[]; currency: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await updateValues(prev, form);
    if (!result?.error) onDone();
    return result;
  }, undefined);

  return (
    <form action={action} className="space-y-4">
      <div>
        <h2 className="text-lg">Update values</h2>
        <p className="text-xs text-ink-3">Enter today&apos;s price for investments and today&apos;s balance for cash and saving. Leave an asset as it is to keep it unchanged.</p>
      </div>
      <div className="max-w-xs space-y-1.5">
        <span className="eyebrow">As of</span>
        <DatePicker name="date" label="As of" />
      </div>
      <ul className="max-h-[45vh] divide-y divide-line overflow-y-auto rounded-2xl border border-line">
        {rows.map((r) => <Row key={r.id} row={r} currency={currency} />)}
      </ul>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-quiet">Cancel</button>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save values"}</button>
      </div>
    </form>
  );
}

function Row({ row, currency }: { row: ValueRow; currency: string }) {
  const [value, setValue] = useState(row.current === null ? "" : plainNumber(row.current));
  const typed = Number(value.replace(/,/g, ""));
  // For an investment the number is a price, so show what it makes the holding worth.
  const worth = row.investment && row.units !== null && value.trim() !== "" && Number.isFinite(typed) ? row.units * typed : null;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-semibold">{row.name}</p>
        <p className="num text-xs text-ink-3">
          {row.investment ? `Price per unit · ${row.units} units` : "Balance"}
          {worth !== null && ` · worth ${money(worth, currency)}`}
        </p>
      </div>
      <NumberInput
        name={`v-${row.id}`}
        aria-label={`${row.investment ? "Price per unit" : "Balance"} of ${row.name} (${currency})`}
        placeholder="0"
        value={value}
        onValueChange={setValue}
        className="field num w-44 text-right"
      />
    </li>
  );
}
