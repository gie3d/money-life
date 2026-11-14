"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import AssetPicker, { type JournalAsset } from "./AssetPicker";
import DatePicker from "./DatePicker";
import Markdown from "./Markdown";
import { saveEntry } from "@/app/actions/journal";
import type { FormState } from "@/app/actions/auth";
import { MOODS, type JournalEntry } from "@/lib/types";

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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><span className="block text-sm font-semibold">From</span><DatePicker name="date" label="From" defaultValue={entry?.date} /></div>
        <div className="space-y-1">
          <span className="block text-sm font-semibold">To <span className="font-normal text-ink-3">(empty means today)</span></span>
          <DatePicker name="endDate" label="To" defaultValue={entry?.endDate ?? undefined} optional placeholder="Today" />
        </div>
      </div>
      <label className="block text-sm font-semibold">
        Title
        <input name="title" required maxLength={120} defaultValue={entry?.title} placeholder="e.g. The year we bought the house" className="field mt-1 w-full font-normal" />
      </label>

      {assets.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Which assets is this about?</legend>
          <p className="text-xs text-ink-3">Tick the ones you&apos;re writing about; the entry will chart how they moved over the period.</p>
          <AssetPicker name="asset" assets={assets} ticked={ticked} setTicked={setTicked} />
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
