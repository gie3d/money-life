"use client";

import { useState } from "react";
import BarsSwitch, { type BarsView } from "./BarsSwitch";
import MonthTable, { type TableView } from "./MonthTable";
import Segmented from "./Segmented";
import type { TableRow } from "./MonthTable";

/**
 * The month-by-month chart and table, one switch above both: spending grouped by category, or by must, need and want.
 * `charts` and `tables` each have a view for every option, with the same ids.
 */
export default function SpendingBreakdown({ options, charts, tables, total, months, selected, currency, average, averageLabel, tableHint }: {
  options: { id: string; label: string }[];
  charts: BarsView[]; tables: TableView[];
  total: Omit<TableRow, "average" | "name" | "color" | "key">;
  months: { key: string; label: string }[]; selected: string; currency: string; average: number | null; averageLabel: string;
  tableHint: string;
}) {
  const [view, setView] = useState(options[0].id);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-semibold text-ink-3">Group by</span>
        <Segmented label="Group the chart and table by" options={options} value={view} onChange={setView} />
      </div>
      <BarsSwitch title="Month by month" views={charts} view={view} selected={selected} currency={currency} average={average} averageLabel={averageLabel} />
      <MonthTable hint={tableHint} months={months} selected={selected} currency={currency} views={tables} view={view} total={total} />
    </div>
  );
}
