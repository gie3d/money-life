"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** A pencil button that opens `children` in a dialog. The content is mounted only while open, so it starts fresh each time. */
export default function EditDialog({
  label,
  title,
  children,
  trigger,
  wide = false,
}: {
  label: string;
  title: string;
  children: (close: () => void) => ReactNode;
  /** Shown on a regular button instead of the pencil icon. */
  trigger?: ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
    // Leaving the dialog hands focus back to the pencil that opened it.
    if (!open && wasOpen.current) button.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      {trigger ? (
        <button ref={button} type="button" onClick={() => setOpen(true)} className="btn">{trigger}</button>
      ) : (
        <button ref={button} type="button" aria-label={label} title="Edit" onClick={() => setOpen(true)} className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16z" />
          </svg>
        </button>
      )}
      {open && (
        <dialog
          ref={dialog}
          aria-label={title}
          onClose={() => setOpen(false)}
          // A click on the backdrop lands on the dialog element itself.
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-xl"} overflow-visible rounded-3xl bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/50`}
        >
          {children(() => setOpen(false))}
        </dialog>
      )}
    </>
  );
}
