"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * An expand button that opens its children in a dialog covering the whole screen.
 * The children are only mounted while it is open, so a heavy chart costs nothing until asked for.
 * Escape or the Close button leaves.
 */
export default function FullscreenButton({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${title} in full screen`}
        title="Full screen"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      </button>
      {open && (
        <dialog
          ref={dialog}
          aria-label={title}
          onClose={() => setOpen(false)}
          className="m-0 h-dvh max-h-none w-dvw max-w-none bg-surface p-0 text-ink backdrop:bg-black"
        >
          <div className="flex h-full flex-col gap-3 p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <h2 className="mr-auto text-xl">{title}</h2>
              <button type="button" autoFocus onClick={() => dialog.current?.close()} className="btn btn-quiet">Close</button>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
          </div>
        </dialog>
      )}
    </>
  );
}
