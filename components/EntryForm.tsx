"use client";

import { useActionState, useState, type ReactNode } from "react";
import { addEntry } from "@/app/actions/money";
import DatePicker from "./DatePicker";
import NumberInput from "./NumberInput";
import Saved from "./Saved";
import { money } from "@/lib/format";
import type { FormState } from "@/app/actions/auth";

type Mode = "balance" | "deposit" | "withdraw";
const MODES: { id: Mode; label: string }[] = [
  { id: "balance", label: "Balance" },
  { id: "deposit", label: "Deposit" },
  { id: "withdraw", label: "Withdraw" },
];

/**
 * Records a balance: the new total, or an amount put in or taken out, which is added to or taken from the balance
 * as of that date. `entries` are the balances already recorded, to preview the new total.
 */
export default function EntryForm({ accountId, currency, entries, initialMode = "balance", title = "Record a balance", after }: {
  accountId: number;
  currency: string;
  entries: { date: string; value: number }[];
  initialMode?: "balance" | "deposit" | "withdraw";
  title?: string;
  /** Shown with the "Saved" note, such as links on to what comes next. */
  after?: ReactNode;
}) {
  // The fields hold their own state, so a saved balance is cleared by starting them afresh.
  const [fresh, setFresh] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await addEntry(accountId, prev, form);
    if (!result?.error) setFresh((n) => n + 1);
    return result;
  }, undefined);

  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <h2 className="text-lg">{title}</h2>
      {fresh > 0 && !pending && !state?.error && <Saved key={fresh}>{after}</Saved>}
      <Fields key={fresh} currency={currency} entries={entries} initialMode={initialMode} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}

function Fields({ currency, entries, initialMode }: { currency: string; entries: { date: string; value: number }[]; initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");

  const before = [...entries].filter((e) => e.date <= date).sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.value ?? 0;
  const later = entries.filter((e) => e.date > date).length;
  const typed = amount.trim() === "" ? NaN : Number(amount);
  const after = mode === "deposit" ? before + typed : mode === "withdraw" ? before - typed : typed;

  return (
    <>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Set the balance, or add or take out an amount</legend>
        {MODES.map((m) => (
          <label key={m.id} className="cursor-pointer">
            <input type="radio" name="mode" value={m.id} checked={mode === m.id} onChange={() => setMode(m.id)} className="peer sr-only" />
            <span className="inline-block rounded-full bg-surface-2 px-5 py-2 text-sm font-semibold text-ink-3 peer-checked:bg-ink peer-checked:text-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky">
              {m.label}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="block space-y-1.5">
          <span className="eyebrow">Date</span>
          <DatePicker name="date" label="Date" onChange={setDate} />
        </div>
        <label className="block space-y-1.5">
          <span className="eyebrow">{mode === "balance" ? "New balance" : mode === "deposit" ? "Amount put in" : "Amount taken out"} ({currency})</span>
          <NumberInput name="value" required placeholder="0" value={amount} onValueChange={setAmount} className="field" />
        </label>
      </div>
      <div className="space-y-1 rounded-xl bg-surface-2 px-4 py-3 text-sm">
        <p className="text-ink-3">
          Balance before: <span className="num font-semibold text-ink">{money(before, currency)}</span>
          {Number.isFinite(after) && (
            <>
              {"  →  "}New total: <span className={`num font-bold ${after < 0 ? "text-miss-text" : "text-ink"}`}>{money(after, currency)}</span>
              {mode !== "balance" && <span className="text-ink-3"> ({mode === "deposit" ? "+" : "−"}{money(typed, currency)})</span>}
            </>
          )}
        </p>
        {after < 0 && <p className="font-semibold text-miss-text">That is more than the balance on this date.</p>}
        {later > 0 && date && (
          <p className="text-xs text-ink-3">{later} {later === 1 ? "balance is" : "balances are"} recorded after this date and will stay as recorded.</p>
        )}
      </div>
      <p className="-mt-1 text-xs text-ink-3">
        Use Deposit and Withdraw for money you move in or out, so it isn&apos;t counted as a gain or a loss. Use Balance for interest, or to correct the total.
      </p>
      <label className="block space-y-1.5">
        <span className="eyebrow">Note (optional)</span>
        <input name="note" className="field" />
      </label>
    </>
  );
}
