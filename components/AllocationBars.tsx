"use client";

import { useState } from "react";
import { money } from "@/lib/format";

export type AllocationRow = { id: string; label: string; color: string; value: number; cost: number | null };

/**
 * Where the money sits, as a sorted list of bars: one per category or liquidity group, switched at the top. Each bar
 * is the group's share of the total value; under it the value and, for investments, what it cost.
 */
export default function AllocationBars({ byCategory, byLiquidity, currency }: { byCategory: AllocationRow[]; byLiquidity: AllocationRow[]; currency: string }) {
  const [by, setBy] = useState<"category" | "liquidity">("category");
  const rows = by === "category" ? [...byCategory].sort((a, b) => b.value - a.value) : byLiquidity;
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(...rows.map((r) => r.value), 0);

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-lg">Allocation</h2>
          <p className="text-xs text-ink-3">{by === "category" ? "Share of your total value by category, largest first." : "Share of your total value by how fast it turns into cash."}</p>
        </div>
        <div role="group" aria-label="Allocation by" className="flex gap-1 rounded-full bg-surface-2 p-1">
          {(["category", "liquidity"] as const).map((b) => (
            <button key={b} type="button" aria-pressed={by === b} onClick={() => setBy(b)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${by === b ? "bg-ink text-surface" : "text-ink-3"}`}>
              {b}
            </button>
          ))}
        </div>
      </div>
      {total <= 0 ? (
        <p className="py-8 text-center text-sm text-ink-3">Nothing to show yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const share = r.value / total;
            const gain = r.cost !== null ? r.value - r.cost : null;
            return (
              <li key={r.id} className="grid grid-cols-[minmax(6rem,10rem)_1fr_3.5rem] items-center gap-x-3 gap-y-0.5">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${max > 0 ? (r.value / max) * 100 : 0}%`, background: r.color }} />
                </span>
                <span className="num text-right text-sm font-bold">{(share * 100).toFixed(1)}%</span>
                <span />
                <span className="num text-xs text-ink-3">
                  {money(r.value, currency)}
                  {r.cost !== null && (
                    <> · cost {money(r.cost, currency)}{gain !== null && Math.abs(gain) >= 0.005 && (
                      <span className={gain > 0 ? "text-go-text" : "text-miss-text"}> ({gain > 0 ? "+" : "−"}{money(Math.abs(gain), currency)})</span>
                    )}</>
                  )}
                </span>
                <span />
              </li>
            );
          })}
          <li className="grid grid-cols-[minmax(6rem,10rem)_1fr_3.5rem] items-center gap-x-3 border-t border-line pt-3 text-sm font-bold">
            <span>Total</span>
            <span className="num text-xs font-normal text-ink-3">{money(total, currency)}</span>
            <span className="num text-right">100%</span>
          </li>
        </ul>
      )}
    </section>
  );
}
