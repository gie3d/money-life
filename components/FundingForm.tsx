"use client";

import { useActionState } from "react";
import { setPlanAssets } from "@/app/actions/plans";
import { money } from "@/lib/format";
import type { FormState } from "@/app/actions/auth";

export type FundingAsset = { id: number; name: string; color: string; category: string; value: number; checked: boolean };

/** Which assets pay for the plan. Their current values add up to the funds the schedule starts from. */
export default function FundingForm({ planId, assets, currency }: { planId: number; assets: FundingAsset[]; currency: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setPlanAssets.bind(null, planId), undefined);

  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">Pay from</h2>
        <p className="text-xs text-ink-3">Tick the assets this plan can use. Their current values are the money available today. An asset used by two plans is counted in both.</p>
      </div>
      {assets.length === 0 ? (
        <p className="text-sm text-ink-3">You have no assets yet. Add some on the Assets page.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {assets.map((a) => (
            <li key={a.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                <input type="checkbox" name="asset" value={a.id} defaultChecked={a.checked} className="size-5 accent-[var(--brand)]" />
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.name}</span>
                  <span className="block text-xs text-ink-3">{a.category}</span>
                </span>
                <span className="num font-semibold">{money(a.value, currency)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <button className="btn" disabled={pending || assets.length === 0}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
