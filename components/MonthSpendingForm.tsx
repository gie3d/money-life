"use client";

import { useActionState, useState } from "react";
import { saveMonth } from "@/app/actions/spending";
import NumberInput from "./NumberInput";
import type { FormState } from "@/app/actions/auth";
import { money, plainNumber } from "@/lib/format";

export type MonthRow = { id: number; name: string; color: string; amount: number | null; last: number | null; archived: boolean };

const parse = (s: string) => (s.trim() === "" ? 0 : Number(s.replace(/,/g, "")) || 0);

/**
 * What each category came to in one month, all on one form. Last month's amount sits beside each box, and empty
 * boxes can be filled from it in one go. An emptied box clears that category for the month.
 */
export default function MonthSpendingForm({ month, label, prevLabel, rows, currency }: { month: string; label: string; prevLabel: string; rows: MonthRow[]; currency: string }) {
  const start = () => Object.fromEntries(rows.map((r) => [r.id, r.amount === null ? "" : plainNumber(r.amount)]));
  const [values, setValues] = useState<Record<number, string>>(start);
  const [saved, setSaved] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await saveMonth(month, prev, form);
    setSaved(!result?.error);
    return result;
  }, undefined);

  const total = rows.reduce((s, r) => s + parse(values[r.id] ?? ""), 0);
  const lastTotal = rows.reduce((s, r) => s + (r.last ?? 0), 0);
  const canCopy = rows.some((r) => r.last !== null && (values[r.id] ?? "") === "");
  const set = (id: number, v: string) => { setValues((x) => ({ ...x, [id]: v })); setSaved(false); };

  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg">Spending in {label}</h2>
          <p className="text-xs text-ink-3">The total of each category for the month. Leave a box empty if there was none.</p>
        </div>
        {canCopy && (
          <button type="button" className="btn btn-quiet !px-3 !py-1.5 text-xs"
            onClick={() => { setValues((x) => Object.fromEntries(rows.map((r) => [r.id, (x[r.id] ?? "") === "" && r.last !== null ? plainNumber(r.last) : x[r.id] ?? ""]))); setSaved(false); }}>
            Fill empty from {prevLabel}
          </button>
        )}
      </div>

      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[1fr_minmax(7rem,10rem)] items-center gap-x-3 py-2">
            <label htmlFor={`a-${r.id}`} className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
                <span className="truncate">{r.name}</span>
                {r.archived && <span className="rounded-full bg-surface-2 px-2 text-[10px] font-semibold text-ink-3">removed</span>}
              </span>
              <span className="num block pl-[1.125rem] text-xs text-ink-3">{r.last === null ? `Nothing in ${prevLabel}` : `${prevLabel}: ${money(r.last, currency)}`}</span>
            </label>
            <NumberInput id={`a-${r.id}`} name={`a-${r.id}`} value={values[r.id] ?? ""} onValueChange={(v) => set(r.id, v)} placeholder="0" className="field num text-right" />
          </li>
        ))}
        <li className="grid grid-cols-[1fr_minmax(7rem,10rem)] items-center gap-x-3 pt-3 text-sm font-bold">
          <span>Total<span className="num block text-xs font-normal text-ink-3">{prevLabel}: {money(lastTotal, currency)}</span></span>
          <span className="num pr-3 text-right">{money(total, currency)}</span>
        </li>
      </ul>

      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex items-center justify-end gap-3">
        {saved && !pending && <span role="status" className="text-sm font-semibold text-go-text">Saved</span>}
        <button className="btn" disabled={pending}>{pending ? "Saving…" : `Save ${label}`}</button>
      </div>
    </form>
  );
}
