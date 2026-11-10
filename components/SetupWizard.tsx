"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { completeSetup, type SetupAsset } from "@/app/actions/setup";
import type { FormState } from "@/app/actions/auth";
import NumberInput from "./NumberInput";
import { money } from "@/lib/format";
import { CURRENCIES, isInvestment, LIQUIDITY, type Category } from "@/lib/types";

type Row = SetupAsset & { key: number };

/** How quickly each kind usually turns into cash, as the starting choice. */
const LIQUID_BY_TYPE: Record<string, string> = { cash: "immediate", saving: "days", investment: "days" };
const EXAMPLES: Record<string, string> = { cash: "e.g. Wallet, current account", saving: "e.g. Savings account", investment: "e.g. S&P 500 fund, Bitcoin" };
const parse = (s: string | undefined) => (s && s.trim() !== "" ? Number(s.replace(/,/g, "")) : NaN);

/**
 * The first-run setup, a step at a time: the currency, which kinds of assets you have, what each is worth today, and
 * then a goal if you like. Nothing is saved until the last step.
 */
export default function SetupWizard({ categories, currency: initialCurrency, canChangeCurrency, name }: {
  categories: Category[];
  currency: string;
  canChangeCurrency: boolean;
  name: string;
}) {
  const steps = canChangeCurrency ? ["currency", "kinds", "values", "done"] as const : ["kinds", "values", "done"] as const;
  const [at, setAt] = useState(0);
  const step = steps[at];
  const [currency, setCurrency] = useState(initialCurrency);
  const [picked, setPicked] = useState<number[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [state, action, pending] = useActionState<FormState, FormData>(completeSetup, undefined);

  const typeOf = (id: number) => categories.find((c) => c.id === id)?.type ?? "cash";
  const blank = (categoryId: number, key: number): Row => ({ key, categoryId, name: "", liquidity: LIQUID_BY_TYPE[typeOf(categoryId)] ?? "immediate" });

  // Ticking a kind adds an empty row for it; unticking drops its rows.
  const toggle = (id: number) => {
    if (picked.includes(id)) {
      setPicked(picked.filter((x) => x !== id));
      setRows(rows.filter((r) => r.categoryId !== id));
    } else {
      setPicked([...picked, id]);
      setRows([...rows, blank(id, nextKey)]);
      setNextKey(nextKey + 1);
    }
  };
  const add = (categoryId: number) => { setRows([...rows, blank(categoryId, nextKey)]); setNextKey(nextKey + 1); };
  const edit = (key: number, patch: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) => setRows(rows.filter((r) => r.key !== key));

  const valueOf = (r: Row) => (isInvestment({ type: typeOf(r.categoryId) }) ? parse(r.units) * parse(r.price) : parse(r.balance));
  const named = rows.filter((r) => r.name.trim() !== "");
  const total = named.reduce((s, r) => s + (Number.isFinite(valueOf(r)) ? valueOf(r) : 0), 0);
  const missing = named.filter((r) => !Number.isFinite(valueOf(r))).length;
  const ordered = categories.filter((c) => picked.includes(c.id));

  return (
    <div className="space-y-5">
      <ol className="flex gap-1.5" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= at ? "bg-brand" : "bg-line"}`} aria-current={i === at ? "step" : undefined}>
            <span className="sr-only">Step {i + 1} of {steps.length}</span>
          </li>
        ))}
      </ol>

      {step === "currency" && (
        <section className="card space-y-4 p-5 sm:p-6">
          <div>
            <p className="eyebrow">Step {at + 1} of {steps.length}</p>
            <h1 className="text-2xl">Welcome, {name}. Which currency do you count in?</h1>
            <p className="mt-1 text-sm text-ink-3">Every amount in the app is in this currency.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <button key={c} type="button" onClick={() => setCurrency(c)} aria-pressed={currency === c}
                className={`rounded-full px-5 py-2 text-sm font-bold ${currency === c ? "bg-ink text-surface" : "bg-surface-2 text-ink-3"}`}>
                {c}
              </button>
            ))}
          </div>
          <Nav onNext={() => setAt(at + 1)} />
        </section>
      )}

      {step === "kinds" && (
        <section className="card space-y-4 p-5 sm:p-6">
          <div>
            <p className="eyebrow">Step {at + 1} of {steps.length}</p>
            <h1 className="text-2xl">What do you have?</h1>
            <p className="mt-1 text-sm text-ink-3">Tick every kind that applies. You can add more kinds later in Settings.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((c) => {
              const on = picked.includes(c.id);
              return (
                <button key={c.id} type="button" onClick={() => toggle(c.id)} aria-pressed={on}
                  className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left ${on ? "border-brand bg-brand-soft" : "border-transparent bg-surface-2"}`}>
                  <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block text-xs text-ink-3">{isInvestment(c) ? "Tracked in units and price, with profit or loss" : "Tracked as a balance"}</span>
                  </span>
                  <span className={`grid size-6 place-items-center rounded-full text-sm font-bold ${on ? "bg-brand text-white" : "bg-surface text-transparent"}`} aria-hidden>✓</span>
                </button>
              );
            })}
          </div>
          <Nav onBack={at > 0 ? () => setAt(at - 1) : undefined} onNext={() => setAt(at + 1)} disabled={picked.length === 0} hint={picked.length === 0 ? "Tick at least one" : undefined} />
        </section>
      )}

      {step === "values" && (
        <section className="space-y-4">
          <div className="card p-5 sm:p-6">
            <p className="eyebrow">Step {at + 1} of {steps.length}</p>
            <h1 className="text-2xl">What is each one worth today?</h1>
            <p className="mt-1 text-sm text-ink-3">A rough figure is fine: you can correct it any time, and from now on you only update the numbers.</p>
          </div>
          {ordered.map((c) => {
            const inv = isInvestment(c);
            return (
              <div key={c.id} className="card space-y-3 p-5 sm:p-6">
                <h2 className="flex items-center gap-2 text-lg">
                  <span className="size-3 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </h2>
                {rows.filter((r) => r.categoryId === c.id).map((r) => (
                  <div key={r.key} className="space-y-3 rounded-2xl bg-surface-2 p-3 sm:p-4">
                    <div className="flex items-end gap-2">
                      <label className="block min-w-0 flex-1 space-y-1.5">
                        <span className="eyebrow">Name</span>
                        <input value={r.name} onChange={(e) => edit(r.key, { name: e.target.value })} placeholder={EXAMPLES[c.type] ?? ""} className="field bg-surface" />
                      </label>
                      <button type="button" onClick={() => remove(r.key)} aria-label={`Remove ${r.name || "this asset"}`} className="grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface hover:text-miss-text">✕</button>
                    </div>
                    <div className={`grid gap-3 ${inv ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                      {inv ? (
                        <>
                          <label className="block space-y-1.5">
                            <span className="eyebrow">Units you hold</span>
                            <NumberInput value={r.units ?? ""} onValueChange={(v) => edit(r.key, { units: v })} placeholder="0" className="field bg-surface" />
                          </label>
                          <label className="block space-y-1.5">
                            <span className="eyebrow">Price of one today ({currency})</span>
                            <NumberInput value={r.price ?? ""} onValueChange={(v) => edit(r.key, { price: v })} placeholder="0" className="field bg-surface" />
                          </label>
                          <label className="block space-y-1.5">
                            <span className="eyebrow">You paid in total (optional)</span>
                            <NumberInput value={r.cost ?? ""} onValueChange={(v) => edit(r.key, { cost: v })} placeholder="Same as value" className="field bg-surface" />
                          </label>
                        </>
                      ) : (
                        <label className="block space-y-1.5">
                          <span className="eyebrow">Balance today ({currency})</span>
                          <NumberInput value={r.balance ?? ""} onValueChange={(v) => edit(r.key, { balance: v })} placeholder="0" className="field bg-surface" />
                        </label>
                      )}
                      <label className="block space-y-1.5">
                        <span className="eyebrow">Could become cash in</span>
                        <select value={r.liquidity} onChange={(e) => edit(r.key, { liquidity: e.target.value })} className="field bg-surface">
                          {LIQUIDITY.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                      </label>
                    </div>
                    {inv && Number.isFinite(valueOf(r)) && (
                      <p className="num text-sm text-ink-3">Worth <span className="font-semibold text-ink">{money(valueOf(r), currency)}</span> today
                        {parse(r.cost) >= 0 && <> · {valueOf(r) - parse(r.cost) >= 0 ? "up" : "down"} {money(Math.abs(valueOf(r) - parse(r.cost)), currency)} on what you paid</>}
                      </p>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => add(c.id)} className="text-sm font-semibold text-brand">+ Another {c.name.toLowerCase()} asset</button>
              </div>
            );
          })}
          <div className="card p-5 sm:p-6">
            <p className="num text-sm text-ink-3">{named.length} {named.length === 1 ? "asset" : "assets"} · <span className="font-semibold text-ink">{money(total, currency)}</span> in total</p>
            <Nav onBack={() => setAt(at - 1)} onNext={() => setAt(at + 1)} disabled={named.length === 0 || missing > 0}
              hint={named.length === 0 ? "Name at least one asset" : missing > 0 ? `${missing} still ${missing === 1 ? "needs" : "need"} a value` : undefined} />
          </div>
        </section>
      )}

      {step === "done" && (
        <form action={action} className="card space-y-5 p-5 sm:p-6">
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="assets" value={JSON.stringify(named.map((r): SetupAsset => ({ categoryId: r.categoryId, name: r.name, liquidity: r.liquidity, balance: r.balance, units: r.units, price: r.price, cost: r.cost })))} />
          <div>
            <p className="eyebrow">Last step</p>
            <h1 className="text-2xl">You have <span className="num">{money(total, currency)}</span></h1>
            <p className="mt-1 text-sm text-ink-3">across {named.length} {named.length === 1 ? "asset" : "assets"}. One more, if you like: is there something you&apos;re saving for?</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button name="next" value="goal" disabled={pending} className="rounded-2xl bg-brand-soft p-4 text-left hover:brightness-95 disabled:opacity-60">
              <span className="block font-bold text-brand">Save and set a goal</span>
              <span className="block text-sm text-ink-3">Retirement, a house, a child&apos;s education: see if you&apos;re on track.</span>
            </button>
            <button name="next" value="home" disabled={pending} className="rounded-2xl bg-surface-2 p-4 text-left hover:brightness-95 disabled:opacity-60">
              <span className="block font-bold">Save and go to Home</span>
              <span className="block text-sm text-ink-3">You can add a goal any time under Future.</span>
            </button>
          </div>
          {pending && <p className="text-sm text-ink-3">Saving…</p>}
          {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
          <button type="button" onClick={() => setAt(at - 1)} className="text-sm font-semibold text-ink-3">← Back</button>
        </form>
      )}

      <p className="text-center text-xs text-ink-3">
        Don&apos;t want the walkthrough? <Link href="/accounts#new-asset" className="font-semibold">Add assets one at a time</Link>
      </p>
    </div>
  );
}

function Nav({ onBack, onNext, disabled = false, hint }: { onBack?: () => void; onNext: () => void; disabled?: boolean; hint?: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      {onBack && <button type="button" onClick={onBack} className="btn btn-quiet">Back</button>}
      <span className="ml-auto text-xs text-ink-3">{hint}</span>
      <button type="button" onClick={onNext} disabled={disabled} className="btn">Next</button>
    </div>
  );
}
