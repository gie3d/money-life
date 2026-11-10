import Link from "next/link";
import { SECTIONS, type SectionId } from "@/lib/sections";

/** The pages of a section as tabs at the top of each, with what each is for under its name. */
export default function SectionTabs({ section, current }: { section: SectionId; current: string }) {
  const pages = SECTIONS.find((s) => s.id === section)?.pages ?? [];
  return (
    <nav aria-label={`${SECTIONS.find((s) => s.id === section)?.label} pages`} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {pages.map((p) => {
        const on = p.href === current;
        return (
          <Link key={p.href} href={p.href} aria-current={on ? "page" : undefined}
            className={`shrink-0 rounded-2xl px-4 py-2 ${on ? "bg-ink text-surface" : "bg-surface text-ink-2 hover:bg-surface-2"}`}>
            <span className="block text-sm font-bold">{p.label}</span>
            <span className={`block text-[11px] ${on ? "opacity-75" : "text-ink-3"}`}>{p.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
