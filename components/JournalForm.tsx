"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import DatePicker from "./DatePicker";
import Markdown from "./Markdown";
import { saveEntry } from "@/app/actions/journal";
import type { FormState } from "@/app/actions/auth";
import { groupBy } from "@/lib/group";
import { MOODS, type JournalEntry } from "@/lib/types";

export type JournalAsset = { id: number; name: string; color: string; categoryId: number; category: string };

/** Write or change a journal entry: when it's about, a title, how it felt, and the text in Markdown with a preview. */
export default function JournalForm({ entry, assets }: { entry?: JournalEntry; assets: JournalAsset[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEntry.bind(null, entry?.id ?? null), undefined);
  const [text, setText] = useState(entry?.body ?? "");
  const [mood, setMood] = useState(entry?.mood ?? "");
  // A new entry starts about everything; so does one saved with no assets picked.
  const [ticked, setTicked] = useState(() => new Set(entry && entry.accountIds.length > 0 ? entry.accountIds : assets.map((a) => a.id)));
  const [tab, setTab] = useState<"write" | "preview">("write");

  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <DatePicker name="date" label="Date" defaultValue={entry?.date} />
      <label className="block text-sm font-semibold">
        Title
        <input name="title" required maxLength={120} defaultValue={entry?.title} placeholder="e.g. The year we bought the house" className="field mt-1 w-full font-normal" />
      </label>

      {assets.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Which assets is this about?</legend>
          <p className="text-xs text-ink-3">Tick the ones you&apos;re writing about; the entry will show what they were worth that day.</p>
          <AssetPicker assets={assets} ticked={ticked} setTicked={setTicked} />
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-semibold">How did it feel? <span className="font-normal text-ink-3">(optional)</span></legend>
        <input type="hidden" name="mood" value={mood} />
        <div className="mt-1.5 flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button key={m.id} type="button" aria-pressed={mood === m.id} onClick={() => setMood(mood === m.id ? "" : m.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${mood === m.id ? "bg-ink text-surface" : "bg-surface-2 text-ink-2"}`}>
              <span aria-hidden>{m.emoji}</span> {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">What is on your mind?</span>
          <div role="tablist" aria-label="Entry view" className="flex gap-1 rounded-full bg-surface-2 p-1">
            {(["write", "preview"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${tab === t ? "bg-ink text-surface" : "text-ink-3"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {/* The text stays in the form while previewing, so saving from either tab keeps it. */}
        <textarea name="body" value={text} onChange={(e) => setText(e.target.value)} rows={28} maxLength={20_000} required
          placeholder={"What's going on, what you're worried or proud about, what you hope for…\n\n**bold**, *italic*, - lists, > quotes"}
          aria-label="Entry in Markdown"
          className={`field min-h-[34rem] w-full resize-y font-mono text-sm leading-relaxed ${tab === "write" ? "" : "hidden"}`} />
        {tab === "preview" && (
          <div className="min-h-[34rem] rounded-xl border border-line p-4">
            {text.trim() ? <Markdown>{text}</Markdown> : <p className="text-sm text-ink-3">Nothing to preview yet.</p>}
          </div>
        )}
        <p className="text-xs text-ink-3">Markdown is supported: headings (#), **bold**, *italic*, lists, [links](url), &gt; quotes and - [ ] checklists.</p>
      </div>

      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <Link href={entry ? `/journal/${entry.id}` : "/journal"} className="btn btn-quiet">Cancel</Link>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save entry"}</button>
      </div>
    </form>
  );
}

/**
 * Assets to tick, folded into one line that says what is picked. Opened, it is a short scrolling list: a box for
 * everything at the top, then each category with its assets under it.
 */
function AssetPicker({ assets, ticked, setTicked }: { assets: JournalAsset[]; ticked: Set<number>; setTicked: (s: Set<number>) => void }) {
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
                      <input type="checkbox" name="asset" value={a.id} checked={ticked.has(a.id)} onChange={(e) => set([a.id], e.target.checked)} className={box} />
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
