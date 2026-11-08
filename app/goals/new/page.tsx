import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import GoalForm from "@/components/GoalForm";
import { goalAssets } from "@/lib/goal-data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "New goal" };

export default async function NewGoalPage() {
  const user = await requireUser();
  const { ticks } = await goalAssets(user.id);
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Goals", href: "/goals" }, { label: "New goal" }]} />
      <div>
        <h1 className="text-3xl">New goal</h1>
        <p className="mt-1 text-sm text-ink-3">Money to build up by a date: retirement, a child&apos;s education, a house deposit. The chart updates as you type.</p>
      </div>
      {ticks.length === 0 && <p className="text-sm text-ink-3">Add the assets you&apos;re building it with first, on the Assets page.</p>}
      <GoalForm currency={user.currency} assets={ticks} today={new Date().toISOString().slice(0, 10)} />
    </div>
  );
}
