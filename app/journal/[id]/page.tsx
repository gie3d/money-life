import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEntry } from "@/app/actions/journal";
import Breadcrumb from "@/components/Breadcrumb";
import JournalMoney from "@/components/JournalMoney";
import ConfirmDelete from "@/components/ConfirmDelete";
import Markdown from "@/components/Markdown";
import { getJournalEntry } from "@/lib/data";
import { day, money, pct, tone } from "@/lib/format";
import { journalMoney } from "@/lib/journal";
import { requireUser } from "@/lib/session";
import { MOODS } from "@/lib/types";

export const metadata: Metadata = { title: "Journal" };

export default async function EntryPage({ params }: PageProps<"/journal/[id]">) {
  const user = await requireUser();
  const entry = await getJournalEntry(user.id, Number((await params).id));
  if (!entry) notFound();
  const today = new Date().toISOString().slice(0, 10);
  const mine = await journalMoney(user.id, today);
  const everything = mine.isEverything(entry.accountIds);
  const about = mine.names(entry.accountIds);
  const worth = mine.worth(entry.date, entry.accountIds);
  const now = mine.worth(today, entry.accountIds);
  const assets = mine.breakdown(entry.date, entry.accountIds);
  const mood = MOODS.find((m) => m.id === entry.mood);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Journal", href: "/journal" }, { label: entry.title }]} />
      <article className="card space-y-4 p-5 sm:p-8">
        <header className="space-y-1">
          <p className="num flex flex-wrap items-center gap-x-3 text-sm text-ink-3">
            <span>{day(entry.date)}</span>
            {mood && <span>{mood.emoji} {mood.label}</span>}
          </p>
          <h1 className="text-3xl">{entry.title}</h1>
          {worth !== null && (
            <p className="num text-sm text-ink-3">
              {everything ? "Everything you had" : about.length === 1 ? about[0] : `${about.length} assets`}: <span className="font-semibold text-ink-2">{money(worth, user.currency)}</span> then
              {now !== null && <> · {money(now, user.currency)} now{worth > 0 && <span className={tone(now - worth)}> ({pct((now - worth) / worth)})</span>}</>}
            </p>
          )}
        </header>
        <div className="border-t border-line pt-4"><Markdown>{entry.body}</Markdown></div>
      </article>
      {assets.length > 0 && <JournalMoney date={entry.date} assets={assets} everything={everything} currency={user.currency} />}
      <div className="flex justify-end gap-2">
        <ConfirmDelete action={deleteEntry.bind(null, entry.id)} title="Delete this entry?" message="It will be gone for good." triggerLabel="Delete entry" triggerClassName="btn btn-quiet">Delete</ConfirmDelete>
        <Link href={`/journal/${entry.id}/edit`} className="btn">Edit</Link>
      </div>
    </div>
  );
}
