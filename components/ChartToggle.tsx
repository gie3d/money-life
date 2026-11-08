"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * A tick box that puts assets in or out of the page's charts. What is left out lives in the address as `hide=1,2,3`,
 * so it survives changing period or grouping; `query` is the rest of the address to keep. With several assets (a
 * category, say) it ticks or unticks them all, and shows a dash when only some are in.
 */
export default function ChartToggle({ ids, hidden, query, label }: { ids: number[]; hidden: number[]; query: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const on = ids.filter((id) => !hidden.includes(id)).length;

  const toggle = (checked: boolean) => {
    const off = new Set(hidden);
    for (const id of ids) if (checked) off.delete(id); else off.add(id);
    const params = new URLSearchParams(query);
    if (off.size > 0) params.set("hide", [...off].sort((a, b) => a - b).join(","));
    else params.delete("hide");
    start(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  };

  return (
    <input
      type="checkbox"
      checked={on === ids.length}
      ref={(el) => { if (el) el.indeterminate = on > 0 && on < ids.length; }}
      onChange={(e) => toggle(e.target.checked)}
      disabled={pending}
      aria-label={label}
      className="size-4 cursor-pointer accent-[var(--brand)] disabled:cursor-wait"
    />
  );
}
