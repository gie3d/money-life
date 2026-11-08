import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { ReviseGoalForm } from "@/components/GoalForm";
import { listGoals, listGoalVersions } from "@/lib/data";
import { goalAssets } from "@/lib/goal-data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Revise plan" };

export default async function ReviseGoalPage({ params }: PageProps<"/goals/[id]/revise">) {
  const user = await requireUser();
  const id = Number((await params).id);
  const goal = (await listGoals(user.id)).find((g) => g.id === id);
  if (!goal) notFound();
  const [versions, { ticks }] = await Promise.all([listGoalVersions(user.id, id), goalAssets(user.id)]);
  const plan = versions.at(-1);
  if (!plan) notFound();
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Goals", href: "/goals" }, { label: goal.name, href: `/goals/${id}` }, { label: "Revise plan" }]} />
      <div>
        <h1 className="text-3xl">Revise plan</h1>
        <p className="mt-1 text-sm text-ink-3">Saves a new version of the plan. The earlier versions are kept, so you can still see how you did against them.</p>
      </div>
      <ReviseGoalForm goal={goal} plan={plan} currency={user.currency} assets={ticks} today={new Date().toISOString().slice(0, 10)} />
    </div>
  );
}
