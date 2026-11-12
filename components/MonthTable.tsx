
import MiniBars from "./MiniBars";
import { money } from "@/lib/format";

export type TableRow = {
  key: string; name: string; color: string; /** A small tag after the name, e.g. a category's tier. */ badge?: string; muted?: boolean;
  /** The last 12 months, null where nothing is recorded. */ trend: { key: string; value: number | null }[]; trendLabel: string;
  /** One per column; null where nothing is recorded. */ cells: (number | null)[]; average: number | null;
};
export type TableView = { id: string; label: string; heading: string; rows: TableRow[] };

/** The months side by side for each row, switchable between categories and must / need / want. */
export default function MonthTable({ hint, months, selected, currency, views, view: viewId, total }: {
  hint: string; view: string; months: { key: string; label: string }[]; selected: string; currency: string;
  views: TableView[]; total: Omit<TableRow, "average" | "name" | "color" | "key">;
}) {
  const view = views.find((v) => v.id === viewId) ?? views[0];
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg">Each {view.heading.toLowerCase()}, month by month</h2>
      <p className="text-xs text-ink-3">{hint}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="num w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="text-right text-xs text-ink-3">
              <th className="py-2 text-left font-semibold">{view.heading}</th>
              <th className="py-2 pl-3 text-left font-semibold">12 months</th>
              {months.map((m) => <th key={m.key} className={`py-2 pl-3 font-semibold ${m.key === selected ? "text-ink" : ""}`}>{m.label}</th>)}
              <th className="py-2 pl-3 font-semibold">Average</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {view.rows.map((r) => (
              <tr key={r.key}>
                <td className="py-2 pr-3 text-left">
                  <span className={`flex items-center gap-2 font-semibold ${r.muted ? "text-ink-3" : ""}`}>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />{r.name}
                    {r.badge && <span className="rounded-full bg-surface-2 px-2 text-[10px] font-semibold text-ink-3">{r.badge}</span>}
                  </span>
                </td>
                <td className="py-2 pl-3"><MiniBars values={r.trend} selected={selected} color={r.color} label={r.trendLabel} currency={currency} /></td>
                {months.map((m, i) => (
                  <td key={m.key} className={`py-2 pl-3 text-right ${m.key === selected ? "font-bold" : ""} ${r.cells[i] === null ? "text-ink-3" : ""}`}>{r.cells[i] === null ? "–" : money(r.cells[i]!, currency)}</td>
                ))}
                <td className="py-2 pl-3 text-right text-ink-3">{r.average === null ? "–" : money(r.average, currency)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="py-2 pr-3 text-left">Total</td>
              <td className="py-2 pl-3"><MiniBars values={total.trend} selected={selected} color="var(--ink-2)" label={total.trendLabel} currency={currency} /></td>
              {months.map((m, i) => <td key={m.key} className={`py-2 pl-3 text-right ${(total.cells[i] ?? 0) > 0 ? "" : "text-ink-3"}`}>{(total.cells[i] ?? 0) > 0 ? money(total.cells[i]!, currency) : "–"}</td>)}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
