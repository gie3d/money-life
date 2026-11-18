"use client";

import Link from "next/link";
import { useState } from "react";
import { drift, ON_TARGET } from "@/lib/allocation";
import { money } from "@/lib/format";

/** `target` is the share aimed for (0 to 1), set per category under Settings; null for none. */
export type AllocationRow = { id: string; label: string; color: string; value: number; cost: number | null; target?: number | null };

/**
 * Where the money sits, as a sorted list of bars: one per category or liquidity group, switched at the top. Each bar
 * is the group's share of the total value; under it the value and, for investments, what it cost.
 */
export default function AllocationBars({ byCategory, byLiquidity, currency }: { byCategory: AllocationRow[]; byLiquidity: AllocationRow[]; currency: string }) {
  const [by, setBy] = useState<"category" | "liquidity">("category");
  const rows = by === "category" ? [...byCategory].sort((a, b) => b.value - a.value) : byLiquidity;
  const total = rows.reduce((s, r) => s + r.value, 0);
  // Targets show in the category view only; the bars share one scale with them so a mark sits where its share would.
  const d = drift(rows.map((r) => ({ id: r.id, value: r.value, target: by === "category" ? r.target ?? null : null })));
  const driftOf = new Map(d.rows.map((x) => [x.id, x]));
  const hasTargets = d.rows.some((x) => x.target !== null);
  const scale = Math.max(...d.rows.map((x) => Math.max(x.share, x.target ?? 0)), 0);

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-lg">Allocation</h2>
          <p className="text-xs text-ink-3">
            {by === "category"
              ? <>Share of your total value by category, largest first.{hasTargets ? " The mark on a bar is its target." : <> <Link href="/settings/categories" className="font-semibold text-brand-dk">Set a target</Link> for each to see how far off you are.</>}</>
              : "Share of your total value by how fast it turns into cash."}
          </p>
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
            const t = driftOf.get(r.id)!;
            const off = t.diff !== null && Math.abs(t.diff) > ON_TARGET;
            const gain = r.cost !== null ? r.value - r.cost : null;
            return (
              <li key={r.id} className="grid grid-cols-[minmax(6rem,10rem)_1fr_3.5rem] items-center gap-x-3 gap-y-0.5">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="relative h-3 rounded-full bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${scale > 0 ? (t.share / scale) * 100 : 0}%`, background: r.color }} />
                  {t.target !== null && scale > 0 && (
                    <span className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-ink" style={{ left: `${(t.target / scale) * 100}%` }} />
                  )}
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
                  {t.target !== null && t.diff !== null && t.toTarget !== null && (
                    <span className={off ? "text-miss-text" : "text-go-text"}>
                      {" · "}target {Math.round(t.target * 1000) / 10}%{off
                        ? `, ${Math.abs(Math.round(t.diff * 1000) / 10)} points ${t.diff > 0 ? "over" : "under"} (${t.toTarget > 0 ? "add" : "take out"} ${money(Math.abs(t.toTarget), currency)})`
                        : ", on target"}
                    </span>
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
          {hasTargets && Math.abs(d.targetSum - 1) > 0.0005 && (
            <li className="text-xs text-ink-3">
              Your targets add up to {Math.round(d.targetSum * 1000) / 10}%, not 100%{d.rows.some((x) => x.target === null) ? ": categories without one take the rest" : ""}.{" "}
              <Link href="/settings/categories" className="font-semibold text-brand-dk">Change targets</Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
