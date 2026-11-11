import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import JournalForm from "@/components/JournalForm";
import { goalAssets } from "@/lib/goal-data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "New journal entry" };

export default async function NewEntryPage() {
  const user = await requireUser();
  const { ticks } = await goalAssets(user.id);
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Journal", href: "/journal" }, { label: "New entry" }]} />
      <h1 className="text-3xl">New entry</h1>
      <JournalForm assets={ticks} />
    </div>
  );
}
