"use client";

import { useState } from "react";
import { Brush, Line, LineChart } from "recharts";

/** Which slice of a chart's rows is showing. Starts as everything, and starts over when the rows change length. */
export function useRange(length: number) {
  const [r, setR] = useState({ length, start: 0, end: length - 1 });
  const fresh = r.length !== length;
  const start = fresh ? 0 : Math.min(r.start, length - 1);
  const end = fresh ? length - 1 : Math.min(r.end, length - 1);
  return { start, end, set: (startIndex: number, endIndex: number) => setR({ length, start: startIndex, end: endIndex }) };
}

export type Range = ReturnType<typeof useRange>;

/**
 * The overview strip under a chart: the whole series in miniature with a highlighted window. Drag the handles to
 * resize it, or the window itself to slide it. Put the returned element inside the chart, and give the chart the
 * rows `range.start..range.end` is controlling (recharts slices them itself).
 */
export function rangeBrush<T extends object>({ rows, dataKey, keys, range, format, type = "linear" }: {
  rows: T[]; dataKey: keyof T & string; keys: (keyof T & string)[]; range: Range; format: (value: string) => string;
  type?: "linear" | "stepAfter" | "monotone";
}) {
  return (
    <Brush
      dataKey={dataKey}
      height={44}
      travellerWidth={10}
      stroke="var(--ink-3)"
      fill="var(--surface-2)"
      startIndex={range.start}
      endIndex={range.end}
      tickFormatter={(v) => format(String(v))}
      onChange={(e) => {
        if (typeof e.startIndex === "number" && typeof e.endIndex === "number") range.set(e.startIndex, e.endIndex);
      }}
    >
      <LineChart data={rows}>
        {keys.map((k) => (
          <Line key={k} type={type} dataKey={k} stroke="var(--brand)" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls />
        ))}
      </LineChart>
    </Brush>
  );
}

/** "Showing 3 Jan 2025 – 9 Mar 2026", with a way back to everything once the window is narrowed. */
export function RangeLabel({ from, to, range, length }: { from: string; to: string; range: Range; length: number }) {
  const zoomed = range.start > 0 || range.end < length - 1;
  return (
    <p className="mb-1 flex items-center gap-3 text-sm text-ink-2">
      <span>Showing {from} – {to}</span>
      {zoomed && (
        <button type="button" onClick={() => range.set(0, length - 1)} className="text-xs font-semibold text-brand-dk">
          Show all
        </button>
      )}
    </p>
  );
}
