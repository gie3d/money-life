"use client";

import { useActionState, useState } from "react";
import EditDialog from "./EditDialog";
import Markdown from "./Markdown";
import type { FormState } from "@/app/actions/auth";

type Save = (prev: FormState, form: FormData) => Promise<FormState>;

/**
 * Opens notes (of an asset or a plan) in a dialog to write in Markdown, with a preview of how they will look.
 * `save` is the server action that stores them, bound to what they belong to; it reads the "notes" field.
 */
export default function NotesEditor({ notes, save, placeholder }: { notes: string | null; save: Save; placeholder?: string }) {
  return (
    <EditDialog label="Edit notes" title="Notes" wide trigger={notes ? undefined : "Add notes"}>
      {(close) => <NotesForm notes={notes ?? ""} save={save} placeholder={placeholder} onDone={close} />}
    </EditDialog>
  );
}

function NotesForm({ notes, save, placeholder, onDone }: { notes: string; save: Save; placeholder?: string; onDone: () => void }) {
  const [text, setText] = useState(notes);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await save(prev, form);
    if (!result?.error) onDone();
    return result;
  }, undefined);

  return (
    <form action={action} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg">Notes</h2>
        <div role="tablist" aria-label="Notes view" className="flex gap-1 rounded-full bg-surface-2 p-1">
          {(["write", "preview"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${tab === t ? "bg-ink text-surface" : "text-ink-3"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {/* The text stays in the form while previewing, so saving from either tab keeps it. */}
      <textarea
        name="notes"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        maxLength={20_000}
        placeholder={`${placeholder ?? "Anything worth keeping…"}\n\n**bold**, *italic*, - lists, [links](https://example.com), | tables |`}
        className={`field min-h-64 w-full resize-y font-mono text-sm leading-relaxed ${tab === "write" ? "" : "hidden"}`}
        aria-label="Notes in Markdown"
      />
      {tab === "preview" && (
        <div className="min-h-64 rounded-xl border border-line p-4">
          {text.trim() ? <Markdown>{text}</Markdown> : <p className="text-sm text-ink-3">Nothing to preview yet.</p>}
        </div>
      )}
      <p className="text-xs text-ink-3">Markdown is supported: headings (#), **bold**, *italic*, lists, [links](url), `code`, &gt; quotes, tables and - [ ] checklists.</p>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-quiet">Cancel</button>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save notes"}</button>
      </div>
    </form>
  );
}
