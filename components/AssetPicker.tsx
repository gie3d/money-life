"use client";

import { groupBy } from "@/lib/group";

export type JournalAsset = { id: number; name: string; color: string; categoryId: number; category: string };

/**
 * Assets to tick, folded into one line that says what is picked. Opened, it is a short scrolling list: a box for
 * everything at the top, then each category with its assets under it.
 */
export default function AssetPicker({ assets, ticked, setTicked, name }: { assets: JournalAsset[]; ticked: Set<number>; setTicked: (s: Set<number>) => void; name?: string }) {
  const groups = groupBy(assets, (a) => a.categoryId);
  const set = (ids: number[], on: boolean) => {
    const next = new Set(ticked);
    for (const id of ids) if (on) next.add(id); else next.delete(id);
    setTicked(next);
  };
  const all = assets.map((a) => a.id);
  const count = all.filter((id) => ticked.has(id)).length;
  const picked = assets.filter((a) => ticked.has(a.id));
  const summary = count === all.length ? `All ${count} assets` : count === 0 ? "None picked" : picked.length <= 2 ? picked.map((a) => a.name).join(", ") : `${count} of ${all.length} assets`;
  const box = "size-4 accent-[var(--brand)]";

  return (
    <details className="group rounded-xl border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 truncate font-semibold">{summary}</span>
        <span className="shrink-0 text-xs font-semibold text-brand group-open:hidden">Change</span>
        <span className="hidden shrink-0 text-xs font-semibold text-brand group-open:inline">Done</span>
      </summary>
      <div className="max-h-60 overflow-y-auto border-t border-line px-4 py-2">
        <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm font-bold">
          <input type="checkbox" checked={count === all.length} ref={(el) => { if (el) el.indeterminate = count > 0 && count < all.length; }}
            onChange={(e) => set(all, e.target.checked)} className={box} />
          Select all
        </label>
        {groups.map(({ key, items }) => {
          const ids = items.map((a) => a.id);
          const on = ids.filter((id) => ticked.has(id)).length;
          return (
            <div key={key} className="border-t border-line py-1.5">
              <label className="flex cursor-pointer items-center gap-2.5 py-1 text-xs font-bold uppercase tracking-wide text-ink-3">
                <input type="checkbox" checked={on === ids.length} ref={(el) => { if (el) el.indeterminate = on > 0 && on < ids.length; }}
                  onChange={(e) => set(ids, e.target.checked)} aria-label={`All of ${items[0].category}`} className={box} />
                <span className="size-2 rounded-full" style={{ background: items[0].color }} />
                {items[0].category}
              </label>
              <ul className="grid gap-x-4 pl-6 sm:grid-cols-2">
                {items.map((a) => (
                  <li key={a.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm">
                      <input type="checkbox" name={name} value={a.id} checked={ticked.has(a.id)} onChange={(e) => set([a.id], e.target.checked)} className={box} />
                      <span className="truncate">{a.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </details>
  );
}
