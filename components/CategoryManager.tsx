"use client";

import { useActionState } from "react";
import { createCategory, deleteCategory, renameCategory, setCategoryColor } from "@/app/actions/money";
import ColorPicker from "./ColorPicker";
import ConfirmDelete from "./ConfirmDelete";
import type { FormState } from "@/app/actions/auth";
import { labelOf, nextColor, TYPES, type Category } from "@/lib/types";

export default function CategoryManager({ categories, usage }: { categories: Category[]; usage: Record<number, number> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createCategory, undefined);

  return (
    <section className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">Categories</h2>
        <p className="text-xs text-ink-3">
          Your own groups for assets, like Thai stocks or Gold. Pick its type when you create it: Cash and Saving keep a balance; Investment keeps buys and sells and shows profit or loss. The type can&apos;t be changed afterwards. The colour is used in the charts.
        </p>
      </div>
      <ul className="divide-y divide-line">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} used={usage[c.id] ?? 0} />
        ))}
      </ul>
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        <ColorPicker name="color" label="Colour of the new category" defaultValue={nextColor(categories.map((c) => c.color))} />
        <input name="name" required maxLength={40} placeholder="New category" aria-label="New category name" className="field" />
        <select name="type" defaultValue="investment" aria-label="Type" className="field sm:w-44">
          {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button className="btn shrink-0" disabled={pending}>Add</button>
      </form>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
    </section>
  );
}

function CategoryRow({ category, used }: { category: Category; used: number }) {
  const [state, rename] = useActionState<FormState, FormData>(renameCategory.bind(null, category.id), undefined);
  const [colorState, recolor] = useActionState<FormState, FormData>(setCategoryColor.bind(null, category.id), undefined);
  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <form action={recolor}>
          <ColorPicker name="color" label={`Colour of ${category.name}`} defaultValue={category.color} autoSubmit />
        </form>
        {/* Saves when you leave the field, so there is no extra button per row. */}
        <form action={rename} className="min-w-0 flex-1">
          <input
            name="name"
            defaultValue={category.name}
            maxLength={40}
            aria-label={`Rename ${category.name}`}
            onBlur={(e) => { if (e.currentTarget.value.trim() !== category.name) e.currentTarget.form?.requestSubmit(); }}
            className="w-full rounded-lg bg-transparent px-2 py-1.5 font-medium hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
          />
        </form>
        <span className="rounded-lg bg-surface-2 px-2 py-1.5 text-sm text-ink-2">{labelOf(TYPES, category.type)}</span>
        <span className="hidden w-16 text-right text-xs text-ink-3 sm:block">{used} {used === 1 ? "asset" : "assets"}</span>
        {used === 0 ? (
          <ConfirmDelete
            action={deleteCategory.bind(null, category.id)}
            title={`Delete ${category.name}?`}
            message="No asset uses this category. You can create it again at any time."
            triggerLabel={`Delete ${category.name}`}
            triggerClassName="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
          >
            ×
          </ConfirmDelete>
        ) : (
          <span className="size-8" title="Move its assets to another category before deleting" />
        )}
      </div>
      {(state?.error ?? colorState?.error) && <p role="alert" className="px-2 text-xs font-medium text-miss-text">{state?.error ?? colorState?.error}</p>}
    </li>
  );
}
