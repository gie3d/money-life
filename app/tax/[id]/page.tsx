import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmDelete from "@/components/ConfirmDelete";
import Markdown from "@/components/Markdown";
import NotesEditor from "@/components/NotesEditor";
import { EditTaxPlanButton } from "@/components/TaxForms";
import TaxWorkspace from "@/components/TaxWorkspace";
import { deleteTaxPlan, duplicateTaxPlan, updateTaxNotes, updateTaxPlan } from "@/app/actions/tax";
import { rulesAssumed, taxYears } from "@/lib/tax";
import { getTaxPlan, listTaxIncomes } from "@/lib/tax-data";
import { requireUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/tax/[id]">) {
  const user = await requireUser();
  const plan = await getTaxPlan(user.id, Number((await params).id) || 0);
  return { title: plan ? `Tax ${plan.year} · ${plan.name}` : "Tax" };
}

export default async function TaxPlanPage({ params }: PageProps<"/tax/[id]">) {
  const user = await requireUser();
  const id = Number((await params).id);
  const plan = Number.isInteger(id) ? await getTaxPlan(user.id, id) : null;
  if (!plan) notFound();

  const incomes = await listTaxIncomes(user.id, plan.id);
  const now = new Date().getFullYear();
  const years = [...new Set([...taxYears(now), plan.year])].sort((a, b) => b - a);

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

      <TaxWorkspace planId={plan.id} year={plan.year} incomes={incomes} deductions={plan.deductions} />
    </div>
  );
}
