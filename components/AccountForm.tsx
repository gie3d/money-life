"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createAccount } from "@/app/actions/money";
import type { FormState } from "@/app/actions/auth";
import type { Category } from "@/lib/types";
import { labelOf, LIQUIDITY, TYPES } from "@/lib/types";

export default function AccountForm({ categories }: { categories: Category[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createAccount, undefined);
  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <h2 className="text-lg">Add an asset</h2>
      <label className="block space-y-1.5">
        <span className="eyebrow">Name</span>
        <input name="name" required placeholder="e.g. Savings account" className="field" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select name="category" label="Category" options={categories.map((c) => ({ id: String(c.id), label: `${c.name} · ${labelOf(TYPES, c.type)}` }))} initial="" />
        <Select name="liquidity" label="Liquidity" options={LIQUIDITY} initial="immediate" />
      </div>
      <p className="text-xs text-ink-3">The category decides how it is tracked: Cash and Saving keep a balance only, Investment keeps the units you buy and sell and shows profit or loss. Categories are managed on the <Link href="/categories" className="font-semibold text-brand">Categories</Link> page. Liquidity is how fast you could turn it into cash; Retirement means locked until you retire.</p>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      {categories.length === 0 && <p className="text-sm text-ink-3">Create a category first, on the <Link href="/categories" className="font-semibold text-brand">Categories</Link> page.</p>}
      <button className="btn" disabled={pending || categories.length === 0}>{pending ? "Adding…" : "Add asset"}</button>
    </form>
  );
}

function Select({ name, label, options, initial }: { name: string; label: string; options: readonly { id: string; label: string }[]; initial: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="eyebrow">{label}</span>
      <select name={name} defaultValue={initial} className="field">
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}
