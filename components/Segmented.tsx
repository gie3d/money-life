"use client";

/** A small switch between a few views, shown as pills. */
export default function Segmented({ options, value, onChange, label }: {
  options: { id: string; label: string }[]; value: string; onChange: (id: string) => void; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full bg-surface-2 p-0.5 text-xs font-semibold">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}
          className={`rounded-full px-3 py-1 ${o.id === value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
