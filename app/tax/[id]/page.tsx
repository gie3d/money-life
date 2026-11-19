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
  return { title: plan ? `ภาษี ${plan.year + 543} · ${plan.name}` : "ภาษี" };
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
    <div className="mx-auto max-w-[77rem] space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "ภาษี", href: "/tax" }, { label: `ปีภาษี ${plan.year + 543}` }, { label: plan.name }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl">
            {plan.name}
            <EditTaxPlanButton save={updateTaxPlan.bind(null, plan.id)} year={plan.year} name={plan.name} years={years} />
          </h1>
          <p className="text-sm text-ink-3">ปีภาษี {plan.year + 543} (ค.ศ. {plan.year}) · เงินได้ 1 ม.ค. – 31 ธ.ค. {plan.year + 543} · ยื่น ภ.ง.ด.90/91 ภายใน 31 มี.ค. {plan.year + 544}</p>
        </div>
        <div className="flex items-center gap-2">
          <form action={duplicateTaxPlan.bind(null, plan.id)}><button className="btn btn-quiet">Duplicate</button></form>
          <ConfirmDelete action={deleteTaxPlan.bind(null, plan.id)} title="ลบแผนภาษีนี้?" message={`“${plan.name}” รวมทั้งเงินได้และค่าลดหย่อนทั้งหมดจะถูกลบ`} triggerClassName="btn btn-quiet">
            Delete
          </ConfirmDelete>
        </div>
      </div>
      {rulesAssumed(plan.year) && (
        <p className="rounded-xl bg-surface-2 px-4 py-2.5 text-sm text-ink-2">ยังไม่มีเกณฑ์ของปีภาษี {plan.year + 543} จึงใช้เกณฑ์ล่าสุดที่มี ซึ่งอาจเปลี่ยนแปลงได้</p>
      )}

      {plan.notes ? (
        <section className="card p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-lg">บันทึก</h2>
            <NotesEditor thai notes={plan.notes} save={updateTaxNotes.bind(null, plan.id)} />
          </div>
          <Markdown>{plan.notes}</Markdown>
        </section>
      ) : (
        <div className="flex items-center gap-3 text-sm text-ink-3">
          <NotesEditor thai notes={null} save={updateTaxNotes.bind(null, plan.id)} placeholder="ที่มาของตัวเลข เอกสารที่ต้องเก็บ…" />
          <span>จดบันทึก: ที่มาของตัวเลข เอกสารที่ต้องเก็บ (หนังสือรับรอง 50 ทวิ ใบเสร็จ)</span>
        </div>
      )}

      <TaxWorkspace planId={plan.id} year={plan.year} incomes={incomes} deductions={plan.deductions} />
    </div>
  );
}
