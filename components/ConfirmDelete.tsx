"use client";

import { useId, useRef, type ReactNode } from "react";

/**
 * A delete button that asks first. The native <dialog> gives a focus trap, Escape to
 * cancel and a backdrop for free. `action` is a server action (or the dispatcher from
 * useActionState); it only runs once the person confirms.
 */
export default function ConfirmDelete({
  action,
  title,
  message,
  confirmLabel = "Delete",
  triggerLabel,
  triggerClassName,
  error,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  /** Accessible name of the trigger when it shows only an icon. */
  triggerLabel?: string;
  triggerClassName: string;
  error?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <form action={action} className="relative">
      <button type="button" aria-label={triggerLabel} onClick={() => dialog.current?.showModal()} className={triggerClassName}>
        {children}
      </button>
      {error && <p role="alert" className="absolute right-0 top-9 z-10 w-56 rounded-xl bg-miss-soft px-3 py-2 text-xs font-medium text-miss-text">{error}</p>}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        // A click on the backdrop lands on the dialog element itself.
        onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/50"
      >
        <h2 id={titleId} className="text-lg">{title}</h2>
        <p className="mt-2 text-sm text-ink-2">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" autoFocus onClick={() => dialog.current?.close()} className="btn btn-quiet">Cancel</button>
          <button type="submit" onClick={() => dialog.current?.close()} className="btn !bg-miss">{confirmLabel}</button>
        </div>
      </dialog>
    </form>
  );
}
