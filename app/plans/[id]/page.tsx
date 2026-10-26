import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmDelete from "@/components/ConfirmDelete";
import EditPlanItem from "@/components/EditPlanItem";
import FundingForm from "@/components/FundingForm";
import PlanChart from "@/components/PlanChart";
import PlanItemForm from "@/components/PlanItemForm";
import PlanSettings from "@/components/PlanSettings";
import { deletePlan, deletePlanItem } from "@/app/actions/plans";
import { getPlan, listAccounts, listEntries, listPlanAssets, listPlanItems, listPrices, listTrades } from "@/lib/data";
import { day, money, monthLabel, tone } from "@/lib/format";
import { payments, schedule } from "@/lib/plan";
import { holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { FREQUENCIES, labelOf } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/plans/[id]">) {
  const user = await requireUser();
  const plan = await getPlan(user.id, Number((await params).id) || 0);
  return { title: plan?.name ?? "Plan" };
}

export default async function PlanPage({ params }: PageProps<"/plans/[id]">) {
  const user = await requireUser();
  const id = Number((await params).id);
  const plan = Number.isInteger(id) ? await getPlan(user.id, id) : null;
  if (!plan) notFound();

  const cur = user.currency;
  const [items, funding, accounts, entries, trades, prices] = await Promise.all([
    listPlanItems(user.id, plan.id), listPlanAssets(user.id),
    listAccounts(user.id), listEntries(user.id), listTrades(user.id), listPrices(user.id),
  ]);
  const held = holdings(accounts, entries, trades, prices);
  const chosen = new Set(funding.get(plan.id) ?? []);
  const funds = held.filter((h) => chosen.has(h.account.id)).reduce((s, h) => s + h.value, 0);

  const today = new Date().toISOString().slice(0, 10);
  const all = payments(items);
  const s = schedule(all, funds, plan.monthlySaving, today);
  const fundingAssets = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    color: a.categoryColor,
    category: a.categoryName,
    value: held.find((h) => h.account.id === a.id)?.value ?? 0,
    checked: chosen.has(a.id),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Plans", href: "/plans" }, { label: plan.name }]} />
      <h1 className="text-3xl">{plan.name}</h1>

      <section className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 sm:p-6">
        <Figure label="Total cost" value={money(s.total, cur)} />
        <Figure label="Still to pay" value={money(s.remaining, cur)} />
        <Figure label="Funds today" value={money(funds, cur)} hint={plan.monthlySaving > 0 ? `+ ${money(plan.monthlySaving, cur)} a month` : undefined} />
        {s.low ? (
          <Figure
            label={s.shortFrom ? "Short by up to" : "Left at the tightest"}
            value={money(Math.abs(s.low.balance), cur)}
            hint={s.shortFrom ? `from ${monthLabel(s.shortFrom)}` : monthLabel(s.low.month)}
            cls={tone(s.low.balance)}
          />
        ) : (
          <Figure label="Status" value={items.length === 0 ? "No costs yet" : "All paid"} />
        )}
      </section>

      {s.rows.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="mb-1 text-lg">Month by month</h2>
          <p className="mb-3 text-xs text-ink-3">The bars are what you pay each month. The line is the funds left after paying it. Under the dashed zero line, the plan isn&apos;t covered yet.</p>
          <PlanChart rows={s.rows} currency={cur} />
        </section>
      )}

      <PlanItemForm planId={plan.id} currency={cur} />

      {items.length > 0 && (
        <section className="card divide-y divide-line">
          <h2 className="p-4 text-lg sm:px-6">Costs</h2>
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{it.name}</p>
                <p className="text-xs text-ink-3">
                  {it.frequency === "once"
                    ? day(it.startDate)
                    : `${labelOf(FREQUENCIES, it.frequency)} · ${it.occurrences} payments from ${day(it.startDate)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="num font-semibold">{money(it.amount * it.occurrences, cur)}</p>
                {it.occurrences > 1 && <p className="num text-xs text-ink-3">{money(it.amount, cur)} each</p>}
              </div>
              <EditPlanItem item={it} currency={cur} />
              <ConfirmDelete
                action={deletePlanItem.bind(null, it.id)}
                title={`Delete ${it.name}?`}
                message="This cost, and all of its payments, will be removed from the plan."
                triggerLabel={`Delete ${it.name}`}
                triggerClassName="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
              >
                ×
              </ConfirmDelete>
            </div>
          ))}
        </section>
      )}

      <FundingForm planId={plan.id} assets={fundingAssets} currency={cur} />
      <PlanSettings plan={plan} currency={cur} />

      {s.rows.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="p-4 text-lg sm:px-6">Schedule</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="eyebrow border-y border-line text-left">
                  <th className="py-2 pl-4 sm:pl-6">Month</th>
                  <th className="py-2">To pay</th>
                  <th className="py-2 text-right">This month</th>
                  <th className="py-2 text-right">Paid so far</th>
                  <th className="py-2 pr-4 text-right sm:pr-6">Funds left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {s.rows.filter((r) => r.payments.length > 0).map((r) => (
                  <tr key={r.month}>
                    <td className="py-3 pl-4 font-semibold sm:pl-6">{monthLabel(r.month)}</td>
                    <td className="py-3 text-ink-2">{r.payments.map((p) => `${p.name} (${day(p.date, false)})`).join(", ")}</td>
                    <td className="num py-3 text-right">{money(r.spend, cur)}</td>
                    <td className="num py-3 text-right">{money(r.cumulative, cur)}</td>
                    <td className={`num py-3 pr-4 text-right font-semibold sm:pr-6 ${tone(r.balance)}`}>{money(r.balance, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.past.length > 0 && (
            <p className="border-t border-line p-4 text-xs text-ink-3 sm:px-6">
              {s.past.length} {s.past.length === 1 ? "payment" : "payments"} ({money(s.past.reduce((t, p) => t + p.amount, 0), cur)}) are dated before today, so they count as already paid and aren&apos;t taken from today&apos;s funds again.
            </p>
          )}
        </section>
      )}

      <ConfirmDelete
        action={deletePlan.bind(null, plan.id)}
        title={`Delete ${plan.name}?`}
        message="The plan and all of its costs will be deleted. Your assets aren't touched."
        confirmLabel="Delete plan"
        triggerClassName="btn btn-quiet text-miss-text"
      >
        Delete plan
      </ConfirmDelete>
    </div>
  );
}

function Figure({ label, value, hint, cls = "" }: { label: string; value: string; hint?: string; cls?: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={`num text-xl font-bold ${cls}`}>{value}</p>
      {hint && <p className={`num text-xs ${cls || "text-ink-3"}`}>{hint}</p>}
    </div>
  );
}
