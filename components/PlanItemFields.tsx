"use client";

import { useState } from "react";
import DatePicker from "./DatePicker";
import NumberInput from "./NumberInput";
import { plainNumber } from "@/lib/format";
import { FREQUENCIES, type Frequency, type PlanItem } from "@/lib/types";

/** The inputs of one cost, blank for a new one or filled from `item` when editing. */
export default function PlanItemFields({ currency, item }: { currency: string; item?: PlanItem }) {
  const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? "once");
  const repeats = frequency !== "once";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="eyebrow">What it is</span>
        <input name="name" required maxLength={80} defaultValue={item?.name} placeholder="e.g. Down payment" className="field" />
      </label>
      <label className="block space-y-1.5">
        <span className="eyebrow">Amount ({currency}){repeats ? " each time" : ""}</span>
        <NumberInput name="amount" required placeholder="0" defaultValue={item ? plainNumber(item.amount) : ""} className="field" />
      </label>
      <label className="block space-y-1.5">
        <span className="eyebrow">How often</span>
        <select name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="field">
          {FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </label>
      <div className="block space-y-1.5">
        <span className="eyebrow">{repeats ? "First payment" : "Date"}</span>
        <DatePicker name="date" label={repeats ? "First payment" : "Date"} defaultValue={item?.startDate} />
      </div>
      {repeats ? (
        <label className="block space-y-1.5">
          <span className="eyebrow">Number of payments</span>
          <input name="occurrences" type="number" min={1} max={600} step={1} required defaultValue={item && item.frequency !== "once" ? item.occurrences : 12} className="field" />
        </label>
      ) : (
        <input type="hidden" name="occurrences" value="1" />
      )}
    </div>
  );
}
