import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEntry } from "@/app/actions/journal";
import Breadcrumb from "@/components/Breadcrumb";
import JournalTrend from "@/components/JournalTrend";
import ConfirmDelete from "@/components/ConfirmDelete";
import Markdown from "@/components/Markdown";
import { getJournalEntry } from "@/lib/data";
import { day } from "@/lib/format";
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
  const end = entry.endDate && entry.endDate < today ? entry.endDate : today;
  const trend = mine.trend(entry.date, end, entry.accountIds);
  const mood = MOODS.find((m) => m.id === entry.mood);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Journal", href: "/journal" }, { label: entry.title }]} />
      <article className="card space-y-4 p-5 sm:p-8">
        <header className="space-y-1">
          <p className="num flex flex-wrap items-center gap-x-3 text-sm text-ink-3">
            <span>{day(entry.date)}{end > entry.date && <> – {day(end)}</>}</span>
            {mood && <span>{mood.emoji} {mood.label}</span>}
          </p>
          <h1 className="text-3xl">{entry.title}</h1>
        </header>
        <div className="border-t border-line pt-4"><Markdown>{entry.body}</Markdown></div>
      </article>
      <JournalTrend rows={trend.rows} assets={trend.assets} from={entry.date} to={end} everything={everything} currency={user.currency} />
      <div className="flex justify-end gap-2">
        <ConfirmDelete action={deleteEntry.bind(null, entry.id)} title="Delete this entry?" message="It will be gone for good." triggerLabel="Delete entry" triggerClassName="btn btn-quiet">Delete</ConfirmDelete>
        <Link href={`/journal/${entry.id}/edit`} className="btn">Edit</Link>
      </div>
    </div>
  );
}
