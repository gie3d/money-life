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
      <Group title="Family (ค่าลดหย่อนส่วนตัวและครอบครัว)">
        <div className="space-y-1">
          <span className="text-sm font-semibold">You</span>
          <p className="field text-ink-3">60,000</p>
          <span className="block text-xs text-ink-3">Everyone gets the personal allowance</span>
        </div>
        <label className="flex items-start gap-2 self-center text-sm">
          <input type="checkbox" name="spouse" defaultChecked={d.spouse} className="mt-1" />
          <span><span className="font-semibold">Spouse with no income</span><span className="block text-xs text-ink-3">Legally married, 60,000</span></span>
        </label>
        <Count name="childrenBefore2018" label="Children born before 2018" value={d.childrenBefore2018} hint="30,000 each, under 20 (or 25 in school)" />
        <Count name="childrenFrom2018" label="Children born 2018 or later" value={d.childrenFrom2018} hint="30,000; 60,000 from the second child" />
        <Count name="parents" label="Parents you support" value={d.parents} max={4} hint="30,000 each, aged 60+, income under 30,000. Up to 4" />
        <Count name="disabled" label="Disabled dependants" value={d.disabled} hint="60,000 each, with a disability card" />
        <Amount name="prenatal" label="Pregnancy and childbirth" value={d.prenatal} hint="Up to 60,000 a pregnancy" />
      </Group>

      <Group title="Insurance and social security (ประกัน)">
        <Amount name="socialSecurity" label="Social security (ประกันสังคม)" value={d.socialSecurity} hint={`As paid, up to ${k(rules.socialSecurityCap)} in ${year}`} />
        <Amount name="lifeInsurance" label="Life insurance" value={d.lifeInsurance} hint="Up to 100,000; a policy of 10 years or more" />
        <Amount name="healthInsurance" label="Health insurance" value={d.healthInsurance} hint="Up to 25,000; with life insurance up to 100,000" />
        <Amount name="spouseLifeInsurance" label="Spouse's life insurance" value={d.spouseLifeInsurance} hint="Up to 10,000, spouse with no income" />
        <Amount name="parentsHealthInsurance" label="Parents' health insurance" value={d.parentsHealthInsurance} hint="Up to 15,000 for all parents" />
      </Group>

      <Group title="Saving and investing (เงินออมและการลงทุน)">
        <Amount name="providentFund" label="Provident fund / GPF (PVD / กบข.)" value={d.providentFund} hint="Your part, up to 15% of salary" />
        <Amount name="rmf" label="RMF" value={d.rmf} hint="Up to 30% of income, 500,000" />
        <Amount name="pensionInsurance" label="Pension insurance (ประกันบำนาญ)" value={d.pensionInsurance} hint="Up to 15% of income, 200,000" />
        <Amount name="ssf" label="SSF" value={d.ssf} hint={rules.ssfCap > 0 ? `Up to 30% of income, ${k(rules.ssfCap)}` : `Not deductible for ${year} (purchases up to 2024 only)`} />
        <Amount name="thaiEsg" label="Thai ESG" value={d.thaiEsg} hint={`Up to 30% of income, ${k(rules.thaiEsgCap)}; its own cap`} />
        <p className="text-xs text-ink-3 sm:col-span-2 lg:col-span-3">PVD, RMF, pension insurance and SSF together are capped at 500,000.</p>
      </Group>

      <Group title="Spending and home (กระตุ้นเศรษฐกิจและที่อยู่อาศัย)">
        <Amount name="homeLoanInterest" label="Home loan interest" value={d.homeLoanInterest} hint="Up to 100,000" />
        <Amount name="easyEReceipt" label="Easy e-Receipt" value={d.easyEReceipt} hint={rules.easyEReceiptCap > 0 ? `Up to ${k(rules.easyEReceiptCap)}. ${rules.easyEReceiptNote}` : rules.easyEReceiptNote} />
      </Group>

      <Group title="Donations (เงินบริจาค)">
        <Amount name="donationDouble" label="Education, state hospitals, Thai Red Cross" value={d.donationDouble} hint="Counted twice, up to 10% of income after allowances" />
        <Amount name="donationGeneral" label="Other donations" value={d.donationGeneral} hint="Temples, charities: up to 10% after allowances. e-Donation from 2026" />
        <Amount name="politicalDonation" label="Political party" value={d.politicalDonation} hint="Up to 10,000" />
      </Group>

      <Error state={state} />
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save deductions"}</button>
        {state?.saved && !edited && !pending && <p role="status" className="text-sm font-semibold text-go-text">Saved</p>}
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
