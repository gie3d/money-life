import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { setPlanArchived } from "@/app/actions/plans";
import { listPlanItems, listPlans } from "@/lib/data";
import { day, money } from "@/lib/format";
import { finish, payments, schedule } from "@/lib/plan";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "All plans" };

/** Every plan, active and archived, in one table, with a way to archive or bring back each. */
export default async function AllPlansPage() {
  const user = await requireUser();
  const cur = user.currency;
  const [plans, items] = await Promise.all([listPlans(user.id), listPlanItems(user.id)]);
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...plans].sort((a, b) => Number(a.archived) - Number(b.archived));

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Plans", href: "/plans" }, { label: "All plans" }]} />
      <div>
        <h1 className="text-3xl">All plans</h1>
        <p className="mt-1 text-sm text-ink-3">Active and archived. Archived plans are kept but don&apos;t show on the Plans page or count in the forecast.</p>
      </div>
      {plans.length === 0 ? (
        <p className="text-sm text-ink-3">No plans yet. <Link href="/plans" className="font-semibold text-brand">Create one</Link>.</p>
      ) : (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="eyebrow text-left">
                  <th className="py-2 pl-4 sm:pl-6">Plan</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Total cost</th>
                  <th className="py-2 text-right">Still to pay</th>
                  <th className="py-2">Finishes</th>
                  <th className="py-2 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((plan) => {
                  const all = payments(items.filter((i) => i.planId === plan.id));
                  const s = schedule(all, 0, 0, today);
                  const end = finish(all, today);
                  return (
                    <tr key={plan.id} className={plan.archived ? "text-ink-3" : ""}>
                      <td className="py-2.5 pl-4 font-semibold sm:pl-6"><Link href={`/plans/${plan.id}`} className="hover:underline">{plan.name}</Link></td>
                      <td className="py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${plan.archived ? "bg-surface-2" : "bg-go-soft text-go-text"}`}>{plan.archived ? "Archived" : "Active"}</span>
                      </td>
                      <td className="num py-2.5 text-right">{money(s.total, cur)}</td>
                      <td className="num py-2.5 text-right">{money(s.remaining, cur)}</td>
                      <td className="num py-2.5">{end ? `${end.done ? "Finished " : ""}${day(end.date)}` : "—"}</td>
                      <td className="py-1.5 pr-4 text-right sm:pr-6">
                        <form action={setPlanArchived.bind(null, plan.id, !plan.archived)}>
                          <button className="text-xs font-semibold text-brand hover:underline">{plan.archived ? "Bring back" : "Archive"}</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
