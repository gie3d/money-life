import Link from "next/link";

export type Crumb = { label: string; href?: string };

/** The last crumb is the current page and is not a link. */
export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-3">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex min-w-0 items-center gap-2">
              {i > 0 && <span aria-hidden="true">/</span>}
              {last || !c.href ? (
                <span aria-current={last ? "page" : undefined} className={`truncate ${last ? "font-semibold text-ink" : ""}`}>{c.label}</span>
              ) : (
                <Link href={c.href} className="font-medium hover:text-ink">{c.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
