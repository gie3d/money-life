/**
 * The app's three sections and the pages under each. The top bar (and the bottom bar on a phone) shows the sections;
 * a section with more than one page shows them as tabs at the top of each.
 */
export type SectionId = "home" | "assets" | "future";

export type SubPage = { href: string; label: string; hint: string };

export const SECTIONS: { id: SectionId; href: string; label: string; pages: SubPage[] }[] = [
  { id: "home", href: "/", label: "Home", pages: [] },
  {
    id: "assets",
    href: "/accounts",
    label: "Assets",
    pages: [
      { href: "/accounts", label: "Assets", hint: "What you own" },
      { href: "/performance", label: "Performance", hint: "How it's done" },
    ],
  },
  {
    id: "future",
    href: "/goals",
    label: "Future",
    pages: [
      { href: "/goals", label: "Goals", hint: "Saving toward a target" },
      { href: "/plans", label: "Plans", hint: "Paying for something" },
      { href: "/bills", label: "Bills", hint: "Paying every month" },
    ],
  },
];

/** The section a path belongs to, if any. */
export function sectionOf(pathname: string): SectionId | null {
  if (pathname === "/") return "home";
  for (const s of SECTIONS) if (s.pages.some((p) => pathname === p.href || pathname.startsWith(`${p.href}/`))) return s.id;
  return null;
}

/** Paths of the Record flow: the + button is shown as active on them. */
export const isRecordPath = (pathname: string) => ["/record", "/update", "/welcome"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
