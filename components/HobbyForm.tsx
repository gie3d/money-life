"use client";

import { useActionState, useState } from "react";
import { createHobbySpending, deleteHobbySpending, updateHobbySpending } from "@/app/actions/spending";
import ConfirmDelete from "./ConfirmDelete";
import DatePicker from "./DatePicker";
import EditDialog from "./EditDialog";
import NumberInput from "./NumberInput";
import type { FormState } from "@/app/actions/auth";
import { money, plainNumber } from "@/lib/format";
import type { Spending } from "@/lib/types";

/** The inputs of one hobby spending, blank for a new one or filled from `item` when editing. */
function Fields({ currency, categories, item, date }: { currency: string; categories: string[]; item?: Spending; date?: string }) {
  const [category, setCategory] = useState(item?.category ?? "");
  const listId = `hobby-categories${item ? `-${item.id}` : ""}`;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="eyebrow">Amount ({currency})</span>
          <NumberInput name="amount" required placeholder="0" defaultValue={item ? plainNumber(item.amount) : ""} className="field" />
        </label>
        <div className="block space-y-1.5">
          <span className="eyebrow">Date</span>
          <DatePicker name="date" label="Date" defaultValue={item?.date ?? date} />
        </div>
        <label className="block space-y-1.5">
          <span className="eyebrow">Hobby</span>
          <input name="category" list={listId} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} placeholder="e.g. Travel" className="field" />
          <datalist id={listId}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">What was it</span>
          <input name="name" required maxLength={120} defaultValue={item?.name ?? undefined} placeholder="e.g. Trip to Japan" className="field" />
        </label>
      </div>
      {/* The categories used most, one tap away. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick a hobby">
        {categories.slice(0, 8).map((c) => (
          <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${category === c ? "bg-ink text-surface" : "bg-surface-2 text-ink-2"}`}>
            {c}
          </button>
        ))}
      </div>
      <label className="block space-y-1.5">
        <span className="eyebrow">How did it feel? (optional)</span>
        <textarea name="note" rows={3} maxLength={5000} defaultValue={item?.note ?? undefined}
          placeholder="e.g. Worth it. The best week of the year, and I came back rested."
          className="field w-full resize-y leading-relaxed" />
        <span className="block text-xs text-ink-3">Why you bought it, how it felt, whether it was worth it: something to read back years from now.</span>
      </label>
    </div>
  );
}

/** The "Add hobby spending" card. After a save it starts afresh, keeping the date so several things from one trip go in quickly. */
export default function HobbyForm({ currency, categories }: { currency: string; categories: string[] }) {
  const [fresh, setFresh] = useState(0);
  const [lastDate, setLastDate] = useState<string | undefined>();
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await createHobbySpending(prev, form);
    if (!result?.error) {
      setLastDate(String(form.get("date") ?? "") || undefined);
      setFresh((n) => n + 1);
    }
    return result;
  }, undefined);
  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">Add hobby spending</h2>
        <p className="text-xs text-ink-3">A trip, a gadget, gear for a sport: what you spend on the things you love.</p>
      </div>
      <Fields key={fresh} currency={currency} categories={categories} date={lastDate} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
    </form>
  );
}

/** A pencil to change one hobby spending and a cross to delete it. */
export function HobbyActions({ item, currency, categories }: { item: Spending; currency: string; categories: string[] }) {
  const label = item.name ?? item.category;
  return (
    <div className="flex shrink-0 items-center">
      <EditDialog label={`Edit ${label}`} title="Edit spending">
        {(close) => <EditForm item={item} currency={currency} categories={categories} onDone={close} />}
      </EditDialog>
      <ConfirmDelete
        action={deleteHobbySpending.bind(null, item.id)}
        title="Delete this?"
        message={`${label} (${money(item.amount, currency)}) will be removed.`}
        triggerLabel={`Delete ${label}`}
        triggerClassName="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
      >
        ×
      </ConfirmDelete>
    </div>
  );
}

function EditForm({ item, currency, categories, onDone }: { item: Spending; currency: string; categories: string[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await updateHobbySpending(item.id, prev, form);
    if (!result?.error) onDone();
    return result;
  }, undefined);
  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg">Edit spending</h2>
      <Fields currency={currency} categories={categories} item={item} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-quiet">Cancel</button>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}
