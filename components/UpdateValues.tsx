"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateValues } from "@/app/actions/money";
import DatePicker from "./DatePicker";
import NumberInput from "./NumberInput";
import { money, signedMoney, unitPrice, units as fmtUnits } from "@/lib/format";
import { groupBy } from "@/lib/group";
import type { FormState } from "@/app/actions/auth";

export type ValueRow = {
  id: number;
  name: string;
  color: string;
  categoryId: number;
  category: string;
  investment: boolean;
  /** Units held, for an investment. */
  units: number | null;
  /** Price per unit (investment) or balance (cash, saving) now; null when none is recorded yet. */
  current: number | null;
  /** What the asset is worth now. */
  value: number;
};

const parse = (s: string) => (s.trim() === "" ? NaN : Number(s));
const tone = (n: number) => (n > 0.005 ? "text-go-text" : n < -0.005 ? "text-miss-text" : "text-ink-3");
const pctOf = (change: number, base: number) => (base > 0 ? `${change >= 0 ? "+" : "−"}${Math.abs((change / base) * 100).toFixed(1)}%` : "");

/**
 * Every asset in one table, grouped by category: type a new price (investments) or balance (cash, saving) and see what
 * it makes the asset, its category and everything worth, row by row, before saving. Empty boxes are left unchanged.
 */
export default function UpdateValues({ rows, currency }: { rows: ValueRow[]; currency: string }) {
  // After a save the boxes start empty again, over the values just saved.
  const [fresh, setFresh] = useState(0);
  const [saved, setSaved] = useState<number | null>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const count = rows.filter((r) => String(form.get(`v-${r.id}`) ?? "").trim() !== "").length;
    const result = await updateValues(prev, form);
    if (!result?.error) {
      setSaved(count);
      setFresh((n) => n + 1);
    }
    return result;
  }, undefined);

  return (
    <form action={action} className="space-y-4" onChange={() => setSaved(null)}>
      <Table key={fresh} rows={rows} currency={currency} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      {saved !== null && !state?.error && (
        <p role="status" className="rounded-xl bg-go-soft px-3 py-2 text-sm font-medium text-go-text">
          Saved {saved} {saved === 1 ? "value" : "values"}. <Link href="/" className="underline">Back to Home</Link>
        </p>
      )}
      <div className="flex gap-2">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save values"}</button>
        <Link href="/" className="btn btn-quiet">Cancel</Link>
      </div>
    </form>
  );
}

function Table({ rows, currency }: { rows: ValueRow[]; currency: string }) {
  const [typed, setTyped] = useState<Record<number, string>>({});
  // A price typed on a category row, copied into every investment under it (each can still be changed after).
  const [catTyped, setCatTyped] = useState<Record<number, string>>({});
  const setCategory = (items: ValueRow[], categoryId: number, raw: string) => {
    setCatTyped((c) => ({ ...c, [categoryId]: raw }));
    setTyped((t) => ({ ...t, ...Object.fromEntries(items.filter((r) => r.investment).map((r) => [r.id, raw])) }));
  };
  // What each asset would be worth with what is typed so far; unchanged where nothing is.
  const newValue = (r: ValueRow) => {
    const v = parse(typed[r.id] ?? "");
    if (!Number.isFinite(v)) return r.value;
    return r.investment ? (r.units ?? 0) * v : v;
  };
  const sum = (list: ValueRow[], f: (r: ValueRow) => number) => list.reduce((s, r) => s + f(r), 0);
  const now = sum(rows, (r) => r.value);
  const next = sum(rows, newValue);

  return (
    <>
      <div className="card flex flex-wrap items-end gap-x-8 gap-y-3 p-5 sm:p-6">
        <div className="w-full max-w-xs space-y-1.5">
          <span className="eyebrow">As of</span>
          <DatePicker name="date" label="As of" />
        </div>
        <div>
          <p className="eyebrow">Total now</p>
          <p className="num text-xl font-bold">{money(now, currency)}</p>
        </div>
        <div>
          <p className="eyebrow">Total after</p>
          <p className="num text-xl font-bold">{money(next, currency)}</p>
          <p className={`num text-xs font-semibold ${tone(next - now)}`}>{signedMoney(next - now, currency)} {pctOf(next - now, now)}</p>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="eyebrow text-left">
                <th className="py-2 pl-4 sm:pl-6">Asset</th>
                <th className="py-2 text-right">Now</th>
                <th className="py-2 text-right">New</th>
                <th className="py-2 text-right">Value now</th>
                <th className="py-2 text-right">New value</th>
                <th className="py-2 pr-4 text-right sm:pr-6">Change</th>
              </tr>
            </thead>
            {groupBy(rows, (r) => r.categoryId).map(({ key, items }) => {
              const a = sum(items, (r) => r.value);
              const b = sum(items, newValue);
              return (
                <tbody key={key}>
                  <tr className="bg-surface-2 font-bold">
                    <td className="py-2.5 pl-4 sm:pl-6" colSpan={2}>
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: items[0].color }} />
                        {items[0].category}
                      </span>
                      {items.filter((r) => r.investment).length > 1 && <p className="text-xs font-normal text-ink-3">One price for all {items.filter((r) => r.investment).length} investments</p>}
                    </td>
                    <td className="py-1.5">
                      {items.filter((r) => r.investment).length > 1 && (
                        <NumberInput
                          aria-label={`New price per unit for every investment in ${items[0].category} (${currency})`}
                          placeholder="Price for all"
                          value={catTyped[key] ?? ""}
                          onValueChange={(raw) => setCategory(items, key, raw)}
                          className="field num ml-auto block w-40 bg-surface py-2 text-right font-normal"
                        />
                      )}
                    </td>
                    <td className="num py-2.5 text-right">{money(a, currency)}</td>
                    <td className="num py-2.5 text-right">{money(b, currency)}</td>
                    <td className={`num py-2.5 pr-4 text-right sm:pr-6 ${tone(b - a)}`}>
                      {Math.abs(b - a) > 0.005 ? <>{signedMoney(b - a, currency)} <span className="block text-xs">{pctOf(b - a, a)}</span></> : "—"}
                    </td>
                  </tr>
                  {items.map((r) => {
                    const v = newValue(r);
                    const change = v - r.value;
                    const has = Number.isFinite(parse(typed[r.id] ?? ""));
                    return (
                      <tr key={r.id}>
                        <td className="py-2.5 pl-8 sm:pl-10">
                          <p className="font-semibold">{r.name}</p>
                          <p className="num text-xs text-ink-3">{r.investment ? `Price per unit · ${fmtUnits(r.units ?? 0)} units` : "Balance"}</p>
                        </td>
                        <td className="num py-2.5 text-right text-ink-3">
                          {r.current === null ? "—" : r.investment ? unitPrice(r.current, currency) : money(r.current, currency)}
                        </td>
                        <td className="py-1.5">
                          <NumberInput
                            name={`v-${r.id}`}
                            aria-label={`New ${r.investment ? "price per unit" : "balance"} of ${r.name} (${currency})`}
                            placeholder={r.current === null ? "0" : String(r.current)}
                            value={typed[r.id] ?? ""}
                            onValueChange={(raw) => setTyped((t) => ({ ...t, [r.id]: raw }))}
                            className="field num ml-auto block w-40 py-2 text-right"
                          />
                        </td>
                        <td className="num py-2.5 text-right">{money(r.value, currency)}</td>
                        <td className={`num py-2.5 text-right ${has ? "font-semibold" : "text-ink-3"}`}>{money(v, currency)}</td>
                        <td className={`num py-2.5 pr-4 text-right sm:pr-6 ${tone(change)}`}>
                          {has && Math.abs(change) > 0.005 ? <>{signedMoney(change, currency)} <span className="block text-xs">{pctOf(change, r.value)}</span></> : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
            <tfoot>
              <tr className="font-bold">
                <td className="py-3 pl-4 sm:pl-6" colSpan={3}>Total</td>
                <td className="num py-3 text-right">{money(now, currency)}</td>
                <td className="num py-3 text-right">{money(next, currency)}</td>
                <td className={`num py-3 pr-4 text-right sm:pr-6 ${tone(next - now)}`}>
                  {Math.abs(next - now) > 0.005 ? <>{signedMoney(next - now, currency)} <span className="block text-xs">{pctOf(next - now, now)}</span></> : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </>
  );
}
