"use client";

import { useActionState, useState } from "react";
import { setPlanAssets } from "@/app/actions/plans";
import { groupBy } from "@/lib/group";
import { money } from "@/lib/format";
import type { FormState } from "@/app/actions/auth";

export type FundingAsset = { id: number; name: string; color: string; categoryId: number; category: string; value: number; checked: boolean };

/**
 * Which assets pay for the plan, grouped by category (given in the categories' order). Their current values add up
 * to the funds the schedule starts from. A category's own box ticks or unticks all of its assets at once.
 */
export default function FundingForm({ planId, assets, currency }: { planId: number; assets: FundingAsset[]; currency: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setPlanAssets.bind(null, planId), undefined);
  const [ticked, setTicked] = useState(() => new Set(assets.filter((a) => a.checked).map((a) => a.id)));
  const groups = groupBy(assets, (a) => a.categoryId);
  const set = (ids: number[], on: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) if (on) next.add(id); else next.delete(id);
      return next;
    });
  const chosen = assets.filter((a) => ticked.has(a.id)).reduce((s, a) => s + a.value, 0);

  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">Pay from</h2>
        <p className="text-xs text-ink-3">Tick the assets this plan can use. Their current values are the money available today. An asset used by two plans is counted in both. This is only a forecast: nothing is ever taken out of your assets.</p>
      </div>
      {assets.length === 0 ? (
        <p className="text-sm text-ink-3">You have no assets yet. Add some on the Assets page.</p>
      ) : (
        <>
          <div className="space-y-3">
            {groups.map(({ key, items }) => {
              const ids = items.map((a) => a.id);
              const on = ids.filter((id) => ticked.has(id)).length;
              const sum = items.reduce((s, a) => s + a.value, 0);
              return (
                <div key={key} className="overflow-hidden rounded-2xl border border-line">
                  <label className="flex cursor-pointer items-center gap-3 bg-surface-2 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={on === ids.length}
                      ref={(el) => { if (el) el.indeterminate = on > 0 && on < ids.length; }}
                      onChange={(e) => set(ids, e.target.checked)}
                      aria-label={`All of ${items[0].category}`}
                      className="size-5 accent-[var(--brand)]"
                    />
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: items[0].color }} />
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {items[0].category}
                      <span className="ml-2 text-xs font-normal text-ink-3">{on} of {ids.length} ticked</span>
                    </span>
                    <span className="num text-sm font-bold">{money(sum, currency)}</span>
                  </label>
                  <ul className="divide-y divide-line border-t border-line">
                    {items.map((a) => (
                      <li key={a.id}>
                        <label className="flex cursor-pointer items-center gap-3 py-3 pl-10 pr-4">
                          <input type="checkbox" name="asset" value={a.id} checked={ticked.has(a.id)} onChange={(e) => set([a.id], e.target.checked)} className="size-5 accent-[var(--brand)]" />
                          <span className="min-w-0 flex-1 truncate font-semibold">{a.name}</span>
                          <span className="num font-semibold">{money(a.value, currency)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-ink-3">Ticked: <span className="num font-semibold text-ink">{money(chosen, currency)}</span></p>
        </>
      )}
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <button className="btn" disabled={pending || assets.length === 0}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
