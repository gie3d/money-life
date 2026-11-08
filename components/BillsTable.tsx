"use client";

import { useActionState, useState } from "react";
import { deleteBill, resetBillPlan, saveBillPlan } from "@/app/actions/bills";
import { EditBillButton } from "./BillForm";
import ConfirmDelete from "./ConfirmDelete";
import NumberInput from "./NumberInput";
import type { PayFrom } from "./BillFields";
import { ended, EVERY, nextDue, perMonth } from "@/lib/bills";
import { day, money, plainNumber, signedMoney } from "@/lib/format";
import { groupBy } from "@/lib/group";
import type { FormState } from "@/app/actions/auth";
import type { Bill } from "@/lib/types";

type Draft = Record<number, { keep: boolean; amount: string }>;

const draftOf = (bills: Bill[]): Draft =>
  Object.fromEntries(bills.map((b) => [b.id, { keep: !b.planDrop, amount: b.planAmount === null ? "" : plainNumber(b.planAmount) }]));

/**
 * The bills, grouped, with what each costs a month. "Plan changes" opens a what-if: untick a bill to drop it, or type a
 * lower amount, and every total shows what it would come to. The plan is saved apart from the bills, which don't change.
 */
export default function BillsTable({ bills, today, currency, groups, accounts }: {
  bills: Bill[]; today: string; currency: string; groups: string[]; accounts: PayFrom[];
}) {
  const [planning, setPlanning] = useState(bills.some((b) => b.planDrop || b.planAmount !== null));
  const [draft, setDraft] = useState<Draft>(() => draftOf(bills));
  const [state, action, pending] = useActionState<FormState, FormData>(saveBillPlan, undefined);
  const nameOf = (id: number | null) => accounts.find((a) => a.id === id)?.name;

  // Monthly cost of a bill now, and as planned in the draft (ended bills count for neither).
  const now = (b: Bill) => (ended(b, today) ? 0 : perMonth(b.amount, b.everyMonths));
  const planned = (b: Bill) => {
    if (ended(b, today)) return 0;
    const d = draft[b.id];
    if (!d?.keep) return 0;
    const typed = d.amount.trim() === "" ? NaN : Number(d.amount);
    return perMonth(Number.isFinite(typed) ? typed : b.amount, b.everyMonths);
  };
  const sum = (list: Bill[], f: (b: Bill) => number) => list.reduce((s, b) => s + f(b), 0);
  const totalNow = sum(bills, now);
  const totalPlanned = sum(bills, planned);
  const saving = totalNow - totalPlanned;

  const table = (
    <section className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="eyebrow text-left">
              <th className="py-2 pl-4 sm:pl-6">Bill</th>
              <th className="py-2">How often</th>
              <th className="py-2">Next due</th>
              <th className="py-2 text-right">Amount</th>
              {planning && <th className="py-2 text-center">Keep</th>}
              {planning && <th className="py-2 text-right">Planned amount</th>}
              <th className="py-2 text-right">Per month</th>
              {planning && <th className="py-2 text-right">Planned / month</th>}
              {!planning && <th className="py-2 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          {groupBy(bills, (b) => b.group).map(({ key, items }) => {
            const a = sum(items, now);
            const p = sum(items, planned);
            return (
              <tbody key={key}>
                <tr className="bg-surface-2 font-bold">
                  <td className="py-2.5 pl-4 sm:pl-6" colSpan={planning ? 6 : 4}>
                    {key} <span className="text-xs font-normal text-ink-3">{items.length} {items.length === 1 ? "bill" : "bills"}</span>
                  </td>
                  <td className="num py-2.5 text-right">{money(a, currency)}</td>
                  {planning && (
                    <td className={`num py-2.5 text-right ${p < a - 0.005 ? "text-go-text" : ""}`}>{money(p, currency)}</td>
                  )}
                  {!planning && <td />}
                </tr>
                {items.map((b) => {
                  const done = ended(b, today);
                  const due = nextDue(b, today);
                  const d = draft[b.id] ?? { keep: true, amount: "" };
                  const pm = planned(b);
                  return (
                    <tr key={b.id} className={done || (planning && !d.keep) ? "text-ink-3" : ""}>
                      <td className="py-2.5 pl-8 sm:pl-10">
                        <p className={`font-semibold ${planning && !d.keep ? "line-through" : ""}`}>{b.name}</p>
                        {(b.note || b.accountId !== null) && (
                          <p className="text-xs text-ink-3">{[b.accountId !== null ? `From ${nameOf(b.accountId) ?? "a removed asset"}` : null, b.note].filter(Boolean).join(" · ")}</p>
                        )}
                      </td>
                      <td className="py-2.5">{EVERY.find((e) => e.id === b.everyMonths)?.short}</td>
                      <td className="num py-2.5">{done ? "Ended" : due ? day(due) : "—"}</td>
                      <td className="num py-2.5 text-right">{money(b.amount, currency)}</td>
                      {planning && (
                        <td className="py-2.5 text-center">
                          <input
                            type="checkbox"
                            name={`keep-${b.id}`}
                            checked={d.keep}
                            disabled={done}
                            onChange={(e) => setDraft({ ...draft, [b.id]: { ...d, keep: e.target.checked } })}
                            aria-label={`Keep ${b.name}`}
                            className="size-5 accent-[var(--brand)]"
                          />
                        </td>
                      )}
                      {planning && (
                        <td className="py-1.5">
                          <NumberInput
                            name={`plan-${b.id}`}
                            aria-label={`Planned amount for ${b.name} (${currency})`}
                            placeholder={plainNumber(b.amount)}
                            value={d.amount}
                            disabled={done || !d.keep}
                            onValueChange={(v) => setDraft({ ...draft, [b.id]: { ...d, amount: v } })}
                            className="field num ml-auto block w-32 py-2 text-right disabled:opacity-50"
                          />
                        </td>
                      )}
                      <td className="num py-2.5 text-right">{done ? "—" : money(now(b), currency)}</td>
                      {planning && (
                        <td className={`num py-2.5 text-right font-semibold ${pm < now(b) - 0.005 ? "text-go-text" : pm > now(b) + 0.005 ? "text-miss-text" : ""}`}>
                          {done ? "—" : money(pm, currency)}
                        </td>
                      )}
                      {!planning && (
                        <td className="py-1.5 pr-4 sm:pr-6">
                          <div className="flex justify-end">
                            <EditBillButton bill={b} currency={currency} groups={groups} accounts={accounts} />
                            <ConfirmDelete
                              action={deleteBill.bind(null, b.id)}
                              title="Delete this bill?"
                              message={`${b.name} (${money(b.amount, currency)}) will be removed.`}
                              triggerLabel={`Delete ${b.name}`}
                              triggerClassName="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
                            >
                              ×
                            </ConfirmDelete>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
          <tfoot>
            <tr className="font-bold">
              <td className="py-3 pl-4 sm:pl-6" colSpan={planning ? 6 : 4}>Total per month</td>
              <td className="num py-3 text-right">{money(totalNow, currency)}</td>
              {planning && <td className={`num py-3 text-right ${saving > 0.005 ? "text-go-text" : ""}`}>{money(totalPlanned, currency)}</td>}
              {!planning && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-end gap-x-8 gap-y-4 p-5 sm:p-6">
        <Figure label="Per month" value={money(totalNow, currency)} />
        <Figure label="Per year" value={money(totalNow * 12, currency)} />
        {planning && (
          <>
            <Figure label="Planned per month" value={money(totalPlanned, currency)} />
            <Figure
              label="You'd save"
              value={`${signedMoney(saving, currency)} / month`}
              hint={`${signedMoney(saving * 12, currency)} a year${totalNow > 0 ? ` · ${((saving / totalNow) * 100).toFixed(1)}%` : ""}`}
              cls={saving > 0.005 ? "text-go-text" : saving < -0.005 ? "text-miss-text" : ""}
            />
          </>
        )}
        <button type="button" onClick={() => setPlanning(!planning)} className={`btn ml-auto ${planning ? "btn-quiet" : ""}`}>
          {planning ? "Close plan" : "Plan changes"}
        </button>
      </section>

      {planning ? (
        <form action={action} className="space-y-3">
          <p className="text-sm text-ink-3">
            Untick a bill to see the totals without it, or type a lower amount. This is only a plan: your bills stay as they are until you edit them.
          </p>
          {table}
          {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save plan"}</button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={async () => {
                setDraft(draftOf(bills.map((b) => ({ ...b, planAmount: null, planDrop: false }))));
                await resetBillPlan();
              }}
            >
              Reset plan
            </button>
          </div>
        </form>
      ) : (
        table
      )}
    </div>
  );
}

function Figure({ label, value, hint, cls = "" }: { label: string; value: string; hint?: string; cls?: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={`num text-2xl font-bold ${cls}`}>{value}</p>
      {hint && <p className={`num text-xs ${cls || "text-ink-3"}`}>{hint}</p>}
    </div>
  );
}
