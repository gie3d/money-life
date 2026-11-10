import type { Metadata } from "next";
import SectionTabs from "@/components/SectionTabs";
import BillForm from "@/components/BillForm";
import BillsTable from "@/components/BillsTable";
import { dueWithin } from "@/lib/bills";
import { listAccounts, listBills, listCategories } from "@/lib/data";
import { day, money } from "@/lib/format";
import { sortByCategory } from "@/lib/group";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Bills" };

export default async function BillsPage() {
  const user = await requireUser();
  const [bills, accounts, categories] = await Promise.all([listBills(user.id), listAccounts(user.id), listCategories(user.id)]);
  const cur = user.currency;
  const today = new Date().toISOString().slice(0, 10);
  const groups = [...new Set(bills.map((b) => b.group))];
  const payFrom = sortByCategory(accounts, (a) => a.categoryId, categories)
    .map((a) => ({ id: a.id, name: a.name, categoryId: a.categoryId, category: a.categoryName }));
  const soon = dueWithin(bills, today, 30);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <SectionTabs section="future" current="/bills" />
      <div>
        <h1 className="text-3xl">Bills</h1>
        <p className="mt-1 text-sm text-ink-3">What you pay regularly, what it adds up to each month, and what it would come to if you changed some.</p>
      </div>

      {bills.length > 0 && (
        <>
          <BillsTable bills={bills} today={today} currency={cur} groups={groups} accounts={payFrom} />

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg">Due in the next 30 days</h2>
            {soon.length === 0 ? (
              <p className="mt-2 text-sm text-ink-3">Nothing due in the next 30 days.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {soon.map(({ bill, date }) => (
                  <li key={bill.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="num w-28 shrink-0 text-ink-3">{day(date)}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{bill.name}<span className="font-normal text-ink-3"> · {bill.group}</span></span>
                    <span className="num font-semibold">{money(bill.amount, cur)}</span>
                  </li>
                ))}
                <li className="flex items-center gap-3 py-2.5 text-sm font-bold">
                  <span className="flex-1">Total</span>
                  <span className="num">{money(soon.reduce((s, x) => s + x.bill.amount, 0), cur)}</span>
                </li>
              </ul>
            )}
          </section>
        </>
      )}

      <BillForm currency={cur} groups={groups} accounts={payFrom} />
    </div>
  );
}
