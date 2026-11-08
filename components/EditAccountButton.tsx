"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateAccount } from "@/app/actions/money";
import EditDialog from "./EditDialog";
import type { FormState } from "@/app/actions/auth";
import { isInvestment, labelOf, LIQUIDITY, TYPES, type Account, type Category } from "@/lib/types";

/**
 * A pencil by the asset's name that opens its name, category and liquidity to change.
 * With records, only categories tracked the same way are offered (see updateAccount).
 */
export default function EditAccountButton({ account, categories, locked }: { account: Account; categories: Category[]; locked: boolean }) {
  return (
    <EditDialog label={`Edit ${account.name}`} title="Edit asset">
      {(close) => <EditForm account={account} categories={categories} locked={locked} onDone={close} />}
    </EditDialog>
  );
}

function EditForm({ account, categories, locked, onDone }: { account: Account; categories: Category[]; locked: boolean; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await updateAccount(account.id, prev, form);
    if (!result?.error) onDone();
    return result;
  }, undefined);
  const offered = locked ? categories.filter((c) => isInvestment(c) === isInvestment(account)) : categories;

  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg">Edit asset</h2>
      <label className="block space-y-1.5">
        <span className="eyebrow">Name</span>
        <input name="name" required defaultValue={account.name} className="field" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="eyebrow">Category</span>
          <select name="category" defaultValue={String(account.categoryId)} className="field">
            {offered.map((c) => <option key={c.id} value={c.id}>{c.name} · {labelOf(TYPES, c.type)}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">Liquidity</span>
          <select name="liquidity" defaultValue={account.liquidity} className="field">
            {LIQUIDITY.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-ink-3">
        {locked
          ? `This asset already has ${isInvestment(account) ? "trades" : "balances"}, so only ${isInvestment(account) ? "investment" : "cash and saving"} categories are offered: the others track assets differently. `
          : "The category decides how it is tracked: Cash and Saving keep a balance, Investment keeps units bought and sold. "}
        Categories are managed on the <Link href="/settings/categories" className="font-semibold text-brand">Categories</Link> page in Settings.
      </p>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-quiet">Cancel</button>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}
