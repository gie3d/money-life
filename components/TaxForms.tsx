"use client";

import { useActionState, useState, type ReactNode } from "react";
import { createTaxPlan, type TaxState } from "@/app/actions/tax";
import EditDialog from "./EditDialog";
import NumberInput from "./NumberInput";
import { plainNumber } from "@/lib/format";
import { incomeType, INCOME_TYPES, type Deductions, type IncomeType, type TaxIncome, type YearRules } from "@/lib/tax";

type Save = (prev: TaxState, form: FormData) => Promise<TaxState>;

const Error = ({ state }: { state: TaxState }) =>
  state?.error ? <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p> : null;

function YearAndName({ year, name, years }: { year: number; name: string; years: number[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
      <label className="block space-y-1.5">
        <span className="eyebrow">Tax year</span>
        <select name="year" defaultValue={year} className="field">
          {years.map((y) => <option key={y} value={y}>{y} (พ.ศ. {y + 543})</option>)}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="eyebrow">Name</span>
        <input name="name" required maxLength={80} defaultValue={name} placeholder="e.g. As it is, or With RMF 100k" className="field" />
      </label>
    </div>
  );
}

export function NewTaxPlan({ years, year }: { years: number[]; year: number }) {
  const [state, action, pending] = useActionState<TaxState, FormData>(createTaxPlan, undefined);
  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">Start a tax plan</h2>
        <p className="text-xs text-ink-3">One way of working out a year&apos;s tax. Make as many as you like for the same year to compare them.</p>
      </div>
      <YearAndName year={year} name="" years={years} />
      <Error state={state} />
      <button className="btn" disabled={pending}>{pending ? "Creating…" : "Create plan"}</button>
    </form>
  );
}

export function EditTaxPlan({ save, year, name, years, onDone }: { save: Save; year: number; name: string; years: number[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<TaxState, FormData>(async (prev, form) => {
    const r = await save(prev, form);
    if (!r?.error) onDone();
    return r;
  }, undefined);
  return (
    <form action={action} className="space-y-4">
      <YearAndName year={year} name={name} years={years} />
      <Error state={state} />
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}

/** Adds an income, or edits one when `income` is given. */
export function TaxIncomeForm({ save, income, onDone }: { save: Save; income?: TaxIncome; onDone?: () => void }) {
  const [type, setType] = useState<IncomeType>(income?.type ?? "40_1");
  const [actual, setActual] = useState(income?.actualExpense != null);
  // Each income added starts the form empty again.
  const [round, setRound] = useState(0);
  const [state, action, pending] = useActionState<TaxState, FormData>(async (prev, form) => {
    const r = await save(prev, form);
    if (!r?.error) { onDone?.(); if (!income) setRound((n) => n + 1); }
    return r;
  }, undefined);
  const t = incomeType(type);
  return (
    <form action={action} key={round} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="eyebrow">Type of income</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value as IncomeType)} className="field">
            {INCOME_TYPES.map((x) => <option key={x.id} value={x.id}>{x.id.replace("_", "(")}) {x.label} · {x.th}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">Name</span>
          <input name="name" maxLength={80} defaultValue={income?.name ?? ""} placeholder={t.label} className="field" />
        </label>
      </div>
      <p className="text-xs text-ink-3">{t.hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="eyebrow">Income for the year (THB)</span>
          <NumberInput name="amount" required defaultValue={income ? plainNumber(income.amount) : ""} placeholder="0" className="field num" />
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">Tax withheld (ภาษีหัก ณ ที่จ่าย)</span>
          <NumberInput name="withheld" defaultValue={income?.withheld ? plainNumber(income.withheld) : ""} placeholder="0" className="field num" />
        </label>
      </div>
      {t.kinds && (
        <label className="block space-y-1.5">
          <span className="eyebrow">Kind</span>
          <select name="kind" defaultValue={income?.kind ?? t.kinds[0].id} key={type} className="field">
            {t.kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
      )}
      {t.actual && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="expense_mode" value="standard" checked={!actual} onChange={() => setActual(false)} /> Standard rate (หักแบบเหมา)</label>
            <label className="flex items-center gap-2"><input type="radio" name="expense_mode" value="actual" checked={actual} onChange={() => setActual(true)} /> Actual expenses (หักตามจริง)</label>
          </div>
          {actual && (
            <label className="block space-y-1.5">
              <span className="eyebrow">Actual expenses, with receipts</span>
              <NumberInput name="actual_expense" defaultValue={income?.actualExpense != null ? plainNumber(income.actualExpense) : ""} placeholder="0" className="field num" />
            </label>
          )}
        </div>
      )}
      {type === "40_4" && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="separate" defaultChecked={income?.separate ?? true} className="mt-1" />
          <span>Taxed at source as final (15% on interest, 10% on dividends): leave it out of the return</span>
        </label>
      )}
      <Error state={state} />
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : income ? "Save" : "Add income"}</button>
        {!income && state?.saved && !pending && <p role="status" className="text-sm font-semibold text-go-text">Added</p>}
      </div>
    </form>
  );
}

function Amount({ name, label, value, hint }: { name: keyof Deductions; label: string; value: number; hint: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <NumberInput name={name} defaultValue={value ? plainNumber(value) : ""} placeholder="0" className="field num" />
      <span className="block text-xs text-ink-3">{hint}</span>
    </label>
  );
}

function Count({ name, label, value, hint, max = 20 }: { name: keyof Deductions; label: string; value: number; hint: string; max?: number }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <input name={name} type="number" min={0} max={max} step={1} defaultValue={value || ""} placeholder="0" className="field num" />
      <span className="block text-xs text-ink-3">{hint}</span>
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="eyebrow mb-2">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

const k = (n: number) => n.toLocaleString("en-US");

/** Every allowance and deduction of a plan in one form, grouped the way the return lists them. */
export function TaxDeductionsForm({ save, d, rules, year }: { save: Save; d: Deductions; rules: YearRules; year: number }) {
  const [state, action, pending] = useActionState<TaxState, FormData>(save, undefined);
  const [edited, setEdited] = useState(false);
  return (
    <form action={action} onChange={() => setEdited(true)} onSubmit={() => setEdited(false)} className="space-y-6">
      <Group title="ค่าลดหย่อนส่วนตัวและครอบครัว">
        <div className="space-y-1">
          <span className="text-sm font-semibold">ผู้มีเงินได้</span>
          <p className="field text-ink-3">60,000</p>
          <span className="block text-xs text-ink-3">ทุกคนได้รับค่าลดหย่อนส่วนตัว</span>
        </div>
        <label className="flex items-start gap-2 self-center text-sm">
          <input type="checkbox" name="spouse" defaultChecked={d.spouse} className="mt-1" />
          <span><span className="font-semibold">คู่สมรสไม่มีเงินได้</span><span className="block text-xs text-ink-3">จดทะเบียนสมรส 60,000 บาท</span></span>
        </label>
        <Count name="childrenBefore2018" label="บุตรที่เกิดก่อนปี 2561" value={d.childrenBefore2018} hint="คนละ 30,000 บาท อายุไม่เกิน 20 ปี (หรือไม่เกิน 25 ปีถ้ายังเรียนอยู่)" />
        <Count name="childrenFrom2018" label="บุตรที่เกิดตั้งแต่ปี 2561" value={d.childrenFrom2018} hint="30,000 บาท ตั้งแต่บุตรคนที่ 2 คนละ 60,000 บาท" />
        <Count name="parents" label="บิดามารดาที่อุปการะ" value={d.parents} max={4} hint="คนละ 30,000 บาท อายุ 60 ปีขึ้นไป เงินได้ไม่เกิน 30,000 บาท สูงสุด 4 คน" />
        <Count name="disabled" label="ผู้พิการหรือทุพพลภาพที่อุปการะ" value={d.disabled} hint="คนละ 60,000 บาท ต้องมีบัตรคนพิการ" />
        <Amount name="prenatal" label="ค่าฝากครรภ์และค่าคลอดบุตร" value={d.prenatal} hint="ไม่เกิน 60,000 บาทต่อการตั้งครรภ์" />
      </Group>

      <Group title="ประกันและประกันสังคม">
        <Amount name="socialSecurity" label="เงินสมทบประกันสังคม" value={d.socialSecurity} hint={`ตามที่จ่ายจริง ไม่เกิน ${k(rules.socialSecurityCap)} บาท ในปีภาษี ${year + 543}`} />
        <Amount name="lifeInsurance" label="เบี้ยประกันชีวิต" value={d.lifeInsurance} hint="ไม่เกิน 100,000 บาท กรมธรรม์ 10 ปีขึ้นไป" />
        <Amount name="healthInsurance" label="เบี้ยประกันสุขภาพ" value={d.healthInsurance} hint="ไม่เกิน 25,000 บาท รวมกับประกันชีวิตไม่เกิน 100,000 บาท" />
        <Amount name="spouseLifeInsurance" label="เบี้ยประกันชีวิตคู่สมรส" value={d.spouseLifeInsurance} hint="ไม่เกิน 10,000 บาท คู่สมรสไม่มีเงินได้" />
        <Amount name="parentsHealthInsurance" label="เบี้ยประกันสุขภาพบิดามารดา" value={d.parentsHealthInsurance} hint="รวมทุกคนไม่เกิน 15,000 บาท" />
      </Group>

      <Group title="เงินออมและการลงทุน">
        <Amount name="providentFund" label="กองทุนสำรองเลี้ยงชีพ / กบข." value={d.providentFund} hint="ส่วนที่ลูกจ้างจ่าย ไม่เกิน 15% ของค่าจ้าง" />
        <Amount name="rmf" label="กองทุนรวมเพื่อการเลี้ยงชีพ (RMF)" value={d.rmf} hint="ไม่เกิน 30% ของเงินได้ และไม่เกิน 500,000 บาท" />
        <Amount name="pensionInsurance" label="เบี้ยประกันชีวิตแบบบำนาญ" value={d.pensionInsurance} hint="ไม่เกิน 15% ของเงินได้ และไม่เกิน 200,000 บาท" />
        <Amount name="ssf" label="กองทุนรวมเพื่อการออม (SSF)" value={d.ssf} hint={rules.ssfCap > 0 ? `ไม่เกิน 30% ของเงินได้ และไม่เกิน ${k(rules.ssfCap)} บาท` : `ใช้ลดหย่อนปีภาษี ${year + 543} ไม่ได้ (เฉพาะที่ซื้อถึงปี 2567)`} />
        <Amount name="thaiEsg" label="กองทุนรวมไทยเพื่อความยั่งยืน (Thai ESG)" value={d.thaiEsg} hint={`ไม่เกิน 30% ของเงินได้ และไม่เกิน ${k(rules.thaiEsgCap)} บาท แยกวงเงินต่างหาก`} />
        <p className="text-xs text-ink-3 sm:col-span-2 lg:col-span-3">กองทุนสำรองเลี้ยงชีพ RMF ประกันบำนาญ และ SSF รวมกันไม่เกิน 500,000 บาท</p>
      </Group>

      <Group title="ที่อยู่อาศัยและมาตรการกระตุ้นเศรษฐกิจ">
        <Amount name="homeLoanInterest" label="ดอกเบี้ยเงินกู้ซื้อที่อยู่อาศัย" value={d.homeLoanInterest} hint="ไม่เกิน 100,000 บาท" />
        <Amount name="easyEReceipt" label="Easy e-Receipt" value={d.easyEReceipt} hint={rules.easyEReceiptCap > 0 ? `ไม่เกิน ${k(rules.easyEReceiptCap)} บาท ${rules.easyEReceiptNoteTh}` : rules.easyEReceiptNoteTh} />
      </Group>

      <Group title="เงินบริจาค">
        <Amount name="donationDouble" label="บริจาคเพื่อการศึกษา โรงพยาบาลรัฐ สภากาชาดไทย" value={d.donationDouble} hint="หักได้ 2 เท่า ไม่เกิน 10% ของเงินได้หลังหักค่าลดหย่อน" />
        <Amount name="donationGeneral" label="เงินบริจาคทั่วไป" value={d.donationGeneral} hint="วัด มูลนิธิ ไม่เกิน 10% ของเงินได้หลังหักค่าลดหย่อน ตั้งแต่ปี 2569 ต้องผ่าน e-Donation" />
        <Amount name="politicalDonation" label="บริจาคพรรคการเมือง" value={d.politicalDonation} hint="ไม่เกิน 10,000 บาท" />
      </Group>

      <Error state={state} />
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกค่าลดหย่อน"}</button>
        {state?.saved && !edited && !pending && <p role="status" className="text-sm font-semibold text-go-text">บันทึกแล้ว</p>}
      </div>
    </form>
  );
}

/** The pencil beside a plan's title. */
export function EditTaxPlanButton(props: { save: Save; year: number; name: string; years: number[] }) {
  return <EditDialog label="Edit the plan" title="Tax plan">{(close) => <EditTaxPlan {...props} onDone={close} />}</EditDialog>;
}

/** The pencil beside an income. */
export function EditTaxIncomeButton({ save, income }: { save: Save; income: TaxIncome }) {
  return <EditDialog label={`Edit ${income.name}`} title="Income" wide>{(close) => <TaxIncomeForm save={save} income={income} onDone={close} />}</EditDialog>;
}
