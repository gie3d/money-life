"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { deleteAllData, type SettingsState } from "@/app/actions/settings";

/** Wipes everything entered. Because it can't be undone, the button stays off until DELETE is typed. */
export default function DeleteAllData() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const titleId = useId();

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!open && wasOpen.current) button.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <button ref={button} type="button" onClick={() => setOpen(true)} className="btn !bg-miss">Delete all data</button>
      {open && (
        <dialog
          ref={dialog}
          aria-labelledby={titleId}
          onClose={() => setOpen(false)}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/50"
        >
          <Form titleId={titleId} onCancel={() => setOpen(false)} />
        </dialog>
      )}
    </>
  );
}

function Form({ titleId, onCancel }: { titleId: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(deleteAllData, undefined);
  const [typed, setTyped] = useState("");
  const ready = typed.trim().toLowerCase() === "delete";

  return (
    <form action={action} className="space-y-4">
      <h2 id={titleId} className="text-lg">Delete all your data?</h2>
      <p className="text-sm text-ink-2">
        This permanently deletes every asset with its balances, trades and prices, all your categories, and all your plans. It can&apos;t be undone.
        Your account and sign-in stay, with a fresh set of starter categories.
      </p>
      <label className="block space-y-1.5">
        <span className="eyebrow">Type DELETE to confirm</span>
        <input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus className="field" />
      </label>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-quiet">Cancel</button>
        <button className="btn !bg-miss" disabled={!ready || pending}>{pending ? "Deleting…" : "Delete everything"}</button>
      </div>
    </form>
  );
}
