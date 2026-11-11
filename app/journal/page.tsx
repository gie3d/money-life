import type { Metadata } from "next";
import Link from "next/link";
import { listJournal } from "@/lib/data";
import { day, money } from "@/lib/format";
import { journalMoney } from "@/lib/journal";
import { requireUser } from "@/lib/session";
import { MOODS } from "@/lib/types";

export const metadata: Metadata = { title: "Journal" };

/** A readable one-line start of a Markdown text. */
const excerpt = (md: string) => {
  const t = md.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`~\[\]()!|-]/g, "").replace(/\s+/g, " ").trim();
  return t.length > 160 ? `${t.slice(0, 160).trimEnd()}…` : t;
};

export default async function JournalPage() {
  const user = await requireUser();
  const today = new Date().toISOString().slice(0, 10);
  const [entries, mine] = await Promise.all([listJournal(user.id), journalMoney(user.id, today)]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Journal</h1>
          <p className="text-sm text-ink-3">Write down how this period of life feels, money included, to read back years from now.</p>
        </div>
        <Link href="/journal/new" className="btn">New entry</Link>
      </div>

      {entries.length === 0 ? (
        <Link href="/journal/new" className="card flex items-center justify-between gap-3 p-5 hover:bg-surface-2 sm:p-6">
          <span>
            <span className="block text-lg font-bold">Write your first entry</span>
            <span className="text-sm text-ink-3">What&apos;s life like right now? What are you worried about, proud of, hoping for?</span>
          </span>
          <span className="text-brand">→</span>
        </Link>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => {
            const mood = MOODS.find((m) => m.id === e.mood);
            const worth = mine.worth(e.date, e.accountIds);
            const about = mine.names(e.accountIds);
            return (
              <li key={e.id}>
                <Link href={`/journal/${e.id}`} className="card block space-y-1.5 p-5 hover:bg-surface-2 sm:p-6">
                  <p className="num flex flex-wrap items-center gap-x-3 text-xs text-ink-3">
                    <span>{day(e.date)}</span>
                    {worth !== null && <span>{about.length > 0 ? `${about.length === 1 ? about[0] : `${about.length} assets`} were` : "Everything was"} worth {money(worth, user.currency)} then</span>}
                  </p>
                  <p className="text-lg font-bold">{mood && <span aria-label={mood.label} title={mood.label}>{mood.emoji} </span>}{e.title}</p>
                  <p className="text-sm text-ink-2">{excerpt(e.body)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
