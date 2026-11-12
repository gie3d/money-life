"use client";

import { useState, type ReactNode } from "react";

/**
 * A category in the goal's plan table: its heading row (name, then the group's figures as `cells`), and the asset rows
 * under it, which start folded; a click on the heading opens or folds them. The rows are rendered on the server and passed in.
 * The name stays in view while the table scrolls sideways, like the asset names do.
 */
export default function PlanGroup({ label, count, cells, children }: { label: ReactNode; count: number; cells: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <tbody className="divide-y divide-line">
      <tr onClick={() => setOpen(!open)} className="cursor-pointer bg-surface-2 font-bold">
        <td className="sticky left-0 z-10 border-r border-line bg-surface-2 py-2.5 pl-4 sm:pl-6">
          <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} the ${count} ${count === 1 ? "asset" : "assets"}`}
            className="inline-flex items-center gap-2 text-left" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden
              className={`shrink-0 text-ink-3 transition-transform ${open ? "rotate-90" : ""}`}>
              <path d="M9 6l6 6-6 6" />
            </svg>
            {label}
            <span className="text-xs font-normal text-ink-3">{count}</span>
          </button>
        </td>
        {cells}
      </tr>
      {open && children}
    </tbody>
  );
}
