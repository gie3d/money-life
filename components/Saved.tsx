import type { ReactNode } from "react";

/** The note a form shows once it has saved, with anything to do next. */
export default function Saved({ children }: { children?: ReactNode }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-go-soft px-3 py-2 text-sm font-semibold text-go-text">
      <span>✓ Saved</span>
      {children}
    </div>
  );
}
