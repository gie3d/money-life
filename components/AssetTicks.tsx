"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import { groupBy } from "@/lib/group";

export type TickAsset = { id: number; name: string; color: string; categoryId: number; category: string; value: number; pastReturn?: number | null };

/**
 * Assets to tick, grouped by category (given in the categories' order), each category with a box that ticks all of
 * its assets. Submits the ticked ids as `asset`; `onChange` gets them as they change.
 */
export default function AssetTicks({ assets, initial, currency, onChange }: {
  assets: TickAsset[]; initial: number[]; currency: string; onChange?: (ids: number[]) => void;
}) {
  const [ticked, setTicked] = useState(() => new Set(initial));
  const set = (ids: number[], on: boolean) => {
    const next = new Set(ticked);
    for (const id of ids) if (on) next.add(id); else next.delete(id);
    setTicked(next);
    onChange?.([...next]);
  };

  return (
    <div className="space-y-3">
      {groupBy(assets, (a) => a.categoryId).map(({ key, items }) => {
        const ids = items.map((a) => a.id);
        const on = ids.filter((id) => ticked.has(id)).length;
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
              <span className="min-w-0 flex-1 truncate font-bold">{items[0].category}</span>
              <span className="num text-sm font-bold">{money(items.reduce((s, a) => s + a.value, 0), currency)}</span>
            </label>
            <ul className="divide-y divide-line border-t border-line">
              {items.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-2.5 pl-10 pr-4">
                    <input type="checkbox" name="asset" value={a.id} checked={ticked.has(a.id)} onChange={(e) => set([a.id], e.target.checked)} className="size-5 accent-[var(--brand)]" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{a.name}</span>
                    <span className="num">{money(a.value, currency)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
