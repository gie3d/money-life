"use client";

import { useActionState, useRef } from "react";
import { addSpendingCategory, moveSpendingCategory, removeSpendingCategory, renameSpendingCategory, restoreSpendingCategory } from "@/app/actions/spending";
import ConfirmDelete from "./ConfirmDelete";
import EditDialog from "./EditDialog";
import type { FormState } from "@/app/actions/auth";

export type CategoryItem = { id: number; name: string; color: string; months: number };

const icon = "grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent";

/**
 * The everyday categories: add one, rename, move up or down, remove. A removed category that has amounts keeps them
 * in past months and can be put back.
 */
export default function SpendingCategories({ active, archived }: { active: CategoryItem[]; archived: CategoryItem[] }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, add, pending] = useActionState<FormState, FormData>(async (prev, data) => {
    const result = await addSpendingCategory(prev, data);
    if (!result?.error) form.current?.reset();
    return result;
  }, undefined);

  return (
    <section className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">Categories</h2>
        <p className="text-xs text-ink-3">Your own list. Removing one keeps what it had in past months.</p>
      </div>

      <ul className="divide-y divide-line">
        {active.map((c, i) => (
          <li key={c.id} className="flex items-center gap-1 py-1.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
            <span className="ml-1.5 min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
            <span className="num mr-1 hidden text-xs text-ink-3 sm:inline">{c.months > 0 ? `${c.months} ${c.months === 1 ? "month" : "months"}` : "unused"}</span>
            <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => moveSpendingCategory(c.id, -1)} className={icon}>↑</button>
            <button type="button" aria-label={`Move ${c.name} down`} disabled={i === active.length - 1} onClick={() => moveSpendingCategory(c.id, 1)} className={icon}>↓</button>
            <EditDialog label={`Rename ${c.name}`} title="Rename category">
              {(close) => <RenameForm item={c} onDone={close} />}
            </EditDialog>
            <ConfirmDelete
              action={removeSpendingCategory.bind(null, c.id)}
              title={`Remove ${c.name}?`}
              message={c.months > 0
                ? `It goes off the list for new months. The ${c.months} ${c.months === 1 ? "month" : "months"} it has keep their amounts, and you can put it back.`
                : "It has no amounts yet, so it is deleted."}
              confirmLabel="Remove"
              triggerLabel={`Remove ${c.name}`}
              triggerClassName={icon}
            >
              ×
            </ConfirmDelete>
          </li>
        ))}
      </ul>

      <form ref={form} action={add} className="flex gap-2">
        <input name="name" required maxLength={60} placeholder="New category, e.g. Pets" aria-label="New category name" className="field min-w-0 flex-1" />
        <button className="btn shrink-0" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      </form>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}

      {archived.length > 0 && (
        <div>
          <p className="eyebrow">Removed</p>
          <ul className="mt-1 divide-y divide-line">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="size-2.5 shrink-0 rounded-full opacity-50" style={{ background: c.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ink-3">{c.name} <span className="num text-xs">· {c.months} {c.months === 1 ? "month" : "months"}</span></span>
                <button type="button" onClick={() => restoreSpendingCategory(c.id)} className="rounded-full px-3 py-1 text-xs font-semibold text-brand hover:bg-surface-2">Put back</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function RenameForm({ item, onDone }: { item: CategoryItem; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, data) => {
    const result = await renameSpendingCategory(item.id, prev, data);
    if (!result?.error) onDone();
    return result;
  }, undefined);
  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg">Rename category</h2>
      <input name="name" required maxLength={60} defaultValue={item.name} aria-label="Category name" className="field w-full" autoFocus />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-quiet">Cancel</button>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
