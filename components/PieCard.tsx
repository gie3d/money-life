"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { money } from "@/lib/format";

export type PieSlice = { id: string; label: string; value: number; color: string };

export default function PieCard({ title, subtitle, slices, currency }: { title: string; subtitle: string; slices: PieSlice[]; currency: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="text-base">{title}</h2>
      <p className="text-xs text-ink-3">{subtitle}</p>
      {total <= 0 ? (
        <p className="py-12 text-center text-sm text-ink-3">Nothing to show yet.</p>
      ) : (
        <>
          <div className="h-44" role="img" aria-label={`${title}: ${slices.map((s) => `${s.label} ${((s.value / total) * 100).toFixed(0)}%`).join(", ")}`}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={slices} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="92%" paddingAngle={slices.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
                  {slices.map((s) => <Cell key={s.id} fill={s.color} />)}
                </Pie>
                <Tooltip
                  formatter={(v) => [`${money(Number(v), currency)} · ${((Number(v) / total) * 100).toFixed(1)}%`]}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
                  itemStyle={{ color: "var(--ink)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* The legend carries the numbers, so the chart never depends on colour alone. */}
          <ul className="mt-3 space-y-1.5 text-sm">
            {slices.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="num font-semibold">{((s.value / total) * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
