import type { Metadata } from "next";
import Link from "next/link";
import SectionTabs from "@/components/SectionTabs";
import { NewTaxPlan } from "@/components/TaxForms";
import { money } from "@/lib/format";
import { calculate, taxYears } from "@/lib/tax";
import { listTaxIncomes, listTaxPlans } from "@/lib/tax-data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Tax" };

const THB = (n: number) => money(n, "THB");

export default async function TaxPage() {
  const user = await requireUser();
  const [plans, incomes] = await Promise.all([listTaxPlans(user.id), listTaxIncomes(user.id)]);
  const now = new Date().getFullYear();
  const years = [...new Set(plans.map((p) => p.year))];

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <SectionTabs section="future" current="/tax" />
      <div>
        <h1 className="text-3xl">Tax</h1>
        <p className="mt-1 text-sm text-ink-3">
          Work out your Thai personal income tax for a year: what you earned, what you can deduct, and what is left to pay or comes back.
          Keep several plans for the same year to compare.
        </p>
      </div>

      {years.map((year) => {
        const mine = plans.filter((p) => p.year === year).map((p) => ({ p, r: calculate(year, incomes.filter((i) => i.planId === p.id), p.deductions) }));
        const lowest = Math.min(...mine.map((x) => x.r.tax));
        return (
          <section key={year} className="space-y-3">
            <h2 className="text-xl">
              {year} <span className="text-sm font-semibold text-ink-3">พ.ศ. {year + 543} · filed by Mar 31, {year + 1}</span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {mine.map(({ p, r }) => (
                <Link key={p.id} href={`/tax/${p.id}`} className="card block space-y-3 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg">{p.name}</h3>
                    {mine.length > 1 && r.tax === lowest && r.assessable > 0 && <span className="rounded-full bg-go-soft px-2.5 py-0.5 text-xs font-bold text-go-text">Lowest tax</span>}
                  </div>
                  {r.assessable === 0 ? (
                    <p className="text-sm text-ink-3">No income yet. Open it to add some.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div><p className="eyebrow">Income</p><p className="num font-bold">{THB(r.assessable)}</p></div>
                        <div><p className="eyebrow">Net income</p><p className="num font-bold">{THB(r.net)}</p></div>
                        <div><p className="eyebrow">Tax</p><p className="num font-bold">{THB(r.tax)}</p></div>
                      </div>
                      <p className="text-sm text-ink-3">
                        {(r.effectiveRate * 100).toFixed(1)}% of income · top rate {Math.round(r.marginal * 100)}% ·{" "}
                        {r.balance > 0 ? <span className="font-semibold text-ink">{THB(r.balance)} to pay</span>
                          : r.balance < 0 ? <span className="font-semibold text-go-text">{THB(-r.balance)} back</span>
                          : "nothing to pay"}
                      </p>
                    </>
                  )}
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <NewTaxPlan years={taxYears(now)} year={now} />
    </div>
  );
}
