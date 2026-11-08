"use client";

import { useState, type ReactNode } from "react";

/**
 * A table section that starts folded: only its heading row shows (`label` in the first `span` columns, then the
 * `cells`), and clicking it opens the rows underneath. The rows are rendered on the server and passed as children.
 */
export default function CollapsibleRows({ label, span, cells, children, className = "" }: {
  label: ReactNode; span: number; cells: ReactNode; children: ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <tbody className={className}>
      <tr onClick={() => setOpen(!open)} className="cursor-pointer bg-surface-2 font-bold hover:brightness-[0.97]">
        <td className="py-2.5 pl-4 sm:pl-6" colSpan={span}>
          <button type="button" aria-expanded={open} className="inline-flex items-center gap-2 text-left" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden
              className={`shrink-0 text-ink-3 transition-transform ${open ? "rotate-90" : ""}`}>
              <path d="M9 6l6 6-6 6" />
            </svg>
            {label}
          </button>
        </td>
        {cells}
      </tr>
      {open && children}
    </tbody>
  );
}
