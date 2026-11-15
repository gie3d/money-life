"use client";

import { useState, useTransition, type ReactNode } from "react";
import { reorderAccounts } from "@/app/actions/money";

/** A category's asset rows, which can be dragged into a new order. The order is saved when a row is dropped. */
export default function SortableAssets({ categoryId, rows }: { categoryId: number; rows: { id: number; node: ReactNode }[] }) {
  const [order, setOrder] = useState<number[] | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [, start] = useTransition();
  const ids = rows.map((r) => r.id);
  // Show the order being dragged until the saved one comes back from the server.
  const shown = order && order.length === ids.length && order.every((i) => ids.includes(i)) ? order : ids;
  const byId = new Map(rows.map((r) => [r.id, r.node]));

  const over = (target: number) => {
    if (dragging === null || dragging === target) return;
    const next = shown.filter((i) => i !== dragging);
    next.splice(shown.indexOf(target), 0, dragging);
    setOrder(next);
  };
  const drop = () => {
    setDragging(null);
    if (order) start(() => reorderAccounts(categoryId, order).then(() => setOrder(null)));
  };

  return (
    <>
      {shown.map((id) => (
        <div
          key={id}
          draggable
          onDragStart={(e) => { setDragging(id); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); over(id); }}
          onDrop={(e) => { e.preventDefault(); drop(); }}
          onDragEnd={() => { setDragging(null); }}
          className={`group relative cursor-grab ${dragging === id ? "opacity-40" : ""}`}
        >
          <span aria-hidden className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 select-none text-ink-3 opacity-40 group-hover:opacity-100 sm:left-3" title="Drag to reorder">⠿</span>
          {byId.get(id)}
        </div>
      ))}
    </>
  );
}
