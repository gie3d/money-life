import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmDelete from "@/components/ConfirmDelete";
import Info from "@/components/Info";
import Markdown from "@/components/Markdown";
import NotesEditor from "@/components/NotesEditor";
import { EditTaxIncomeButton, EditTaxPlanButton, TaxDeductionsForm, TaxIncomeForm } from "@/components/TaxForms";
import {
  addTaxIncome, deleteTaxIncome, deleteTaxPlan, duplicateTaxPlan, saveTaxDeductions, updateTaxIncome, updateTaxNotes, updateTaxPlan,
} from "@/app/actions/tax";
import { money } from "@/lib/format";
import { calculate, incomeType, rulesAssumed, rulesFor, taxYears } from "@/lib/tax";
import { getTaxPlan, listTaxIncomes } from "@/lib/tax-data";
import { requireUser } from "@/lib/session";

const THB = (n: number) => money(n, "THB");
const typeLabel = (id: string) => id.replace("_", "(") + ")";

export async function generateMetadata({ params }: PageProps<"/tax/[id]">) {
  const user = await requireUser();
  const plan = await getTaxPlan(user.id, Number((await params).id) || 0);
  return { title: plan ? `Tax ${plan.year} · ${plan.name}` : "Tax" };
}

function Step({ n, title, sub, children }: { n: number; title: string; sub: string; children: ReactNode }) {
  return (
    <section className="card space-y-4 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-extrabold text-brand">{n}</span>
        <div>
          <h2 className="text-lg">{title}</h2>
          <p className="text-xs text-ink-3">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, hint, strong, minus }: { label: ReactNode; value: number; hint?: ReactNode; strong?: boolean; minus?: boolean }) {
  return (
    <li className={`flex items-baseline gap-3 py-2 text-sm ${strong ? "font-bold" : ""}`}>
      <span className="min-w-0 flex-1">{label}{hint && <span className="block text-xs font-normal text-ink-3">{hint}</span>}</span>
      <span className="num shrink-0">{minus && value > 0 ? "−" : ""}{THB(value)}</span>
    </li>
  );
}

export default async function TaxPlanPage({ params }: PageProps<"/tax/[id]">) {
  const user = await requireUser();
  const id = Number((await params).id);
  const plan = Number.isInteger(id) ? await getTaxPlan(user.id, id) : null;
  if (!plan) notFound();

  const incomes = await listTaxIncomes(user.id, plan.id);
  const rules = rulesFor(plan.year);
  const r = calculate(plan.year, incomes, plan.deductions);
  const now = new Date().getFullYear();
  const years = [...new Set([...taxYears(now), plan.year])].sort((a, b) => b - a);
  const claimedButCut = r.allowances.filter((l) => l.claimed > l.allowed + 0.005);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Tax", href: "/tax" }, { label: String(plan.year) }, { label: plan.name }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl">
            {plan.name}
            <EditTaxPlanButton save={updateTaxPlan.bind(null, plan.id)} year={plan.year} name={plan.name} years={years} />
          </h1>
          <p className="text-sm text-ink-3">Tax year {plan.year} (พ.ศ. {plan.year + 543}) · income Jan 1 – Dec 31, {plan.year} · file ภ.ง.ด.90/91 by Mar 31, {plan.year + 1}</p>
        </div>
        <div className="flex items-center gap-2">
          <form action={duplicateTaxPlan.bind(null, plan.id)}><button className="btn btn-quiet">Duplicate</button></form>
          <ConfirmDelete action={deleteTaxPlan.bind(null, plan.id)} title="Delete this tax plan?" message={`“${plan.name}” and its incomes and deductions will be gone.`} triggerClassName="btn btn-quiet">
            Delete
          </ConfirmDelete>
        </div>
      </div>
      {rulesAssumed(plan.year) && (
        <p className="rounded-xl bg-surface-2 px-4 py-2.5 text-sm text-ink-2">The rules for {plan.year} aren&apos;t known yet: this uses the latest ones, which may change.</p>
      )}

      {/* The answer first, so it's seen without scrolling. */}
      <section className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 sm:p-6">
        <div><p className="eyebrow">Income</p><p className="num text-xl font-bold">{THB(r.assessable)}</p></div>
        <div><p className="eyebrow">Net income</p><p className="num text-xl font-bold">{THB(r.net)}</p><p className="text-xs text-ink-3">after expenses and deductions</p></div>
        <div><p className="eyebrow">Tax</p><p className="num text-xl font-bold">{THB(r.tax)}</p><p className="text-xs text-ink-3">{(r.effectiveRate * 100).toFixed(2)}% of income · top rate {Math.round(r.marginal * 100)}%</p></div>
        <div>
          <p className="eyebrow">{r.balance < 0 ? "Comes back" : "Still to pay"}</p>
          <p className={`num text-xl font-bold ${r.balance < 0 ? "text-go-text" : ""}`}>{THB(Math.abs(r.balance))}</p>
          <p className="text-xs text-ink-3">after {THB(r.withheld)} withheld</p>
        </div>
      </section>

      {plan.notes ? (
        <section className="card p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-lg">Notes</h2>
            <NotesEditor notes={plan.notes} save={updateTaxNotes.bind(null, plan.id)} />
          </div>
          <Markdown>{plan.notes}</Markdown>
        </section>
      ) : (
        <div className="flex items-center gap-3 text-sm text-ink-3">
          <NotesEditor notes={null} save={updateTaxNotes.bind(null, plan.id)} placeholder="Where the numbers come from, documents to keep…" />
          <span>Keep notes: where the numbers come from, documents to keep (50 ทวิ, receipts).</span>
        </div>
      )}

      <Step n={1} title="Income (เงินได้พึงประเมิน)" sub={`What you earned in ${plan.year}, by type of income under Section 40 of the Revenue Code.`}>
        {incomes.length > 0 && (
          <ul className="divide-y divide-line">
            {incomes.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-12 shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-center text-xs font-bold text-ink-2">{typeLabel(i.type)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{i.name}</span>
                  <span className="block text-xs text-ink-3">
                    {incomeType(i.type).label}
                    {i.withheld > 0 && <> · {THB(i.withheld)} withheld</>}
                    {i.separate && <> · taxed at source, left out</>}
                  </span>
                </span>
                <span className={`num font-semibold ${i.separate ? "text-ink-3 line-through" : ""}`}>{THB(i.amount)}</span>
                <EditTaxIncomeButton save={updateTaxIncome.bind(null, i.id)} income={i} />
                <ConfirmDelete action={deleteTaxIncome.bind(null, i.id)} title="Delete this income?" message={`“${i.name}” will be taken out of the plan.`}
                  triggerLabel={`Delete ${i.name}`} triggerClassName="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </ConfirmDelete>
              </li>
            ))}
            <Row label="Total income" value={r.assessable} strong />
          </ul>
        )}
        <div className={incomes.length > 0 ? "border-t border-line pt-4" : ""}>
          <h3 className="mb-3 text-sm font-bold">{incomes.length > 0 ? "Add another income" : "Add your income"}</h3>
          <TaxIncomeForm save={addTaxIncome.bind(null, plan.id)} />
        </div>
      </Step>

      <Step n={2} title="Expenses and deductions (ค่าใช้จ่ายและค่าลดหย่อน)" sub="Expenses come off each income by its type, worked out for you. Type what you paid for each deduction as it is: the limits are applied in step 3.">
        {r.expenses.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-bold">Expenses (ค่าใช้จ่าย)</h3>
            <ul className="divide-y divide-line">
              {r.expenses.map((e) => <Row key={e.income.id} label={`${typeLabel(e.income.type)} ${e.income.name}`} hint={e.note} value={e.expense} />)}
              <Row label="Total expenses" value={r.expenseTotal} strong />
            </ul>
          </div>
        )}
        <div className="border-t border-line pt-4">
          <h3 className="mb-3 text-sm font-bold">Deductions (ค่าลดหย่อน)</h3>
          <TaxDeductionsForm save={saveTaxDeductions.bind(null, plan.id)} d={plan.deductions} rules={rules} year={plan.year} />
        </div>
      </Step>

      <Step n={3} title="How the tax is worked out (การคำนวณภาษี)" sub="Income, less expenses, less deductions, gives net income. The progressive rates apply to net income.">
        <ul className="divide-y divide-line">
          <Row label="Income" value={r.assessable} />
          <Row label="Less expenses" value={r.expenseTotal} minus />
          <Row label="Income after expenses" value={r.afterExpenses} strong />
        </ul>

        <div>
          <h3 className="mb-1 text-sm font-bold">Deductions allowed</h3>
          <ul className="divide-y divide-line">
            {r.allowances.map((l) => (
              <Row key={l.key} value={l.allowed} minus
                label={<>{l.label}{l.claimed > l.allowed + 0.005 && <span className="ml-2 text-xs font-semibold text-miss-text">of {THB(l.claimed)}</span>}</>}
                hint={l.note} />
            ))}
            {r.retirementCut > 0 && <li className="py-2 text-xs text-miss-text">Retirement savings were over the 500,000 cap together: {THB(r.retirementCut)} not counted (taken off RMF first).</li>}
            <Row label="Total deductions" value={r.allowanceTotal} strong minus />
          </ul>
        </div>

        {r.donations.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-bold">Donations</h3>
            <ul className="divide-y divide-line">
              {r.donations.map((l) => <Row key={l.key} value={l.allowed} minus label={<>{l.label}{l.claimed * (l.key === "donationDouble" ? 2 : 1) > l.allowed + 0.005 && <span className="ml-2 text-xs font-semibold text-miss-text">capped</span>}</>} hint={l.note} />)}
            </ul>
          </div>
        )}

        <ul className="divide-y divide-line border-t-2 border-ink/20">
          <Row label="Net income (เงินได้สุทธิ)" value={r.net} strong />
        </ul>

        <div>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
            Progressive rates
            <Info label="About the rates">The rates on net income, unchanged since tax year 2017: the first 150,000 is free, then each slice is taxed at its own rate. Only the part inside a bracket pays that bracket&apos;s rate.</Info>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-3">
                <tr><th className="py-1.5 font-semibold">Net income</th><th className="py-1.5 text-right font-semibold">Rate</th><th className="py-1.5 text-right font-semibold">Taxed here</th><th className="py-1.5 text-right font-semibold">Tax</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {r.brackets.map((b) => (
                  <tr key={b.from} className={b.taxed > 0 ? "" : "text-ink-3"}>
                    <td className="num py-1.5">{b.upTo === null ? `Over ${b.from.toLocaleString("en-US")}` : `${(b.from === 0 ? 0 : b.from + 1).toLocaleString("en-US")} – ${b.upTo.toLocaleString("en-US")}`}</td>
                    <td className="num py-1.5 text-right">{b.rate === 0 ? "Exempt" : `${Math.round(b.rate * 100)}%`}</td>
                    <td className="num py-1.5 text-right">{b.taxed > 0 ? THB(b.taxed) : "—"}</td>
                    <td className="num py-1.5 text-right">{b.taxed > 0 ? THB(b.tax) : "—"}</td>
                  </tr>
                ))}
                <tr className="font-bold"><td className="py-2" colSpan={3}>Tax by the progressive rates</td><td className="num py-2 text-right">{THB(r.progressiveTax)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {r.minimumTax !== null && (
          <p className="rounded-xl bg-surface-2 px-4 py-2.5 text-sm text-ink-2">
            <span className="font-semibold">Minimum tax:</span> income other than salary is {THB(r.otherIncome)}, 120,000 or more, so the tax is also worked out as
            0.5% of it: {THB(r.minimumTax)}. {r.minimumApplies
              ? <>That is more than the progressive tax, and over 5,000, so it is the tax due.</>
              : r.minimumTax <= 5_000 ? <>At 5,000 or less it is waived; the progressive tax applies.</>
              : <>The progressive tax is higher, so it applies.</>}
          </p>
        )}

        <ul className="divide-y divide-line border-t-2 border-ink/20">
          <Row label="Tax due" value={r.tax} strong />
          <Row label="Less tax withheld" value={r.withheld} minus hint="From your 50 ทวิ certificates" />
          <Row label={r.balance < 0 ? "Refund (ขอคืนภาษี)" : "To pay (ชำระเพิ่ม)"} value={Math.abs(r.balance)} strong />
        </ul>
        {claimedButCut.length > 0 && (
          <p className="text-xs text-ink-3">Amounts in red are what you typed; the deduction is capped at the amount on the right.</p>
        )}
        <p className="text-xs text-ink-3">
          An estimate to plan with, not tax advice. Not covered: the 190,000 exemption at 65 and over, severance and retirement pay
          worked out separately, the dividend tax credit, and filing jointly. Check the Revenue Department (rd.go.th) before you file.
        </p>
      </Step>
    </div>
  );
}
