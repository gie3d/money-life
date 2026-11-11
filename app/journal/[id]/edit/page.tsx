import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import JournalForm from "@/components/JournalForm";
import { getJournalEntry } from "@/lib/data";
import { goalAssets } from "@/lib/goal-data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Edit journal entry" };

export default async function EditEntryPage({ params }: PageProps<"/journal/[id]/edit">) {
  const user = await requireUser();
  const entry = await getJournalEntry(user.id, Number((await params).id));
  if (!entry) notFound();
  const { ticks } = await goalAssets(user.id);
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Journal", href: "/journal" }, { label: entry.title, href: `/journal/${entry.id}` }, { label: "Edit" }]} />
      <h1 className="text-3xl">Edit entry</h1>
      <JournalForm entry={entry} assets={ticks} />
    </div>
  );
}
