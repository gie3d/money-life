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
/** The editor's words, in English unless a page passes `thai`. */
const WORDS = {
  en: { edit: "Edit notes", title: "Notes", add: "Add notes", view: "Notes view", tabs: { write: "Write", preview: "Preview" }, empty: "Nothing to preview yet.", anything: "Anything worth keeping…",
    help: "Markdown is supported: headings (#), **bold**, *italic*, lists, [links](url), `code`, > quotes, tables and - [ ] checklists.", cancel: "Cancel", saving: "Saving…", save: "Save notes" },
  th: { edit: "แก้ไขบันทึก", title: "บันทึก", add: "Add notes", view: "มุมมองบันทึก", tabs: { write: "Write", preview: "Preview" }, empty: "ยังไม่มีอะไรให้แสดง", anything: "สิ่งที่อยากจดไว้…",
    help: "รองรับ Markdown: หัวข้อ (#), **ตัวหนา**, *ตัวเอียง*, รายการ, [ลิงก์](url), `โค้ด`, > คำพูด, ตาราง และ - [ ] รายการตรวจสอบ", cancel: "Cancel", saving: "Saving…", save: "Save notes" },
};
type Words = (typeof WORDS)["en"];

export default function NotesEditor({ notes, save, placeholder, thai = false }: { notes: string | null; save: Save; placeholder?: string; thai?: boolean }) {
  const w = thai ? WORDS.th : WORDS.en;
  return (
    <EditDialog label={w.edit} title={w.title} wide trigger={notes ? undefined : w.add}>
      {(close) => <NotesForm notes={notes ?? ""} save={save} placeholder={placeholder} onDone={close} w={w} />}
    </EditDialog>
  );
}

function NotesForm({ notes, save, placeholder, onDone, w }: { notes: string; save: Save; placeholder?: string; onDone: () => void; w: Words }) {
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
        <h2 className="text-lg">{w.title}</h2>
        <div role="tablist" aria-label={w.view} className="flex gap-1 rounded-full bg-surface-2 p-1">
          {(["write", "preview"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-ink text-surface" : "text-ink-3"}`}>
              {w.tabs[t]}
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
        placeholder={`${placeholder ?? w.anything}\n\n**bold**, *italic*, - lists, [links](https://example.com), | tables |`}
        className={`field min-h-64 w-full resize-y font-mono text-sm leading-relaxed ${tab === "write" ? "" : "hidden"}`}
        aria-label={w.title}
      />
      {tab === "preview" && (
        <div className="min-h-64 rounded-xl border border-line p-4">
          {text.trim() ? <Markdown>{text}</Markdown> : <p className="text-sm text-ink-3">{w.empty}</p>}
        </div>
      )}
      <p className="text-xs text-ink-3">{w.help}</p>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-quiet">{w.cancel}</button>
        <button className="btn" disabled={pending}>{pending ? w.saving : w.save}</button>
      </div>
    </form>
  );
}
