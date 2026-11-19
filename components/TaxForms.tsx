"use client";

import { useActionState, useState } from "react";
import { createTaxPlan, type TaxState } from "@/app/actions/tax";
import EditDialog from "./EditDialog";
import NumberInput from "./NumberInput";
import { plainNumber } from "@/lib/format";
import { incomeType, INCOME_TYPES, type IncomeType, type TaxIncome } from "@/lib/tax";

type Save = (prev: TaxState, form: FormData) => Promise<TaxState>;

const Error = ({ state }: { state: TaxState }) =>
  state?.error ? <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p> : null;

function YearAndName({ year, name, years }: { year: number; name: string; years: number[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
      <label className="block space-y-1.5">
        <span className="eyebrow">ปีภาษี</span>
        <select name="year" defaultValue={year} className="field">
          {years.map((y) => <option key={y} value={y}>{y + 543} (ค.ศ. {y})</option>)}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="eyebrow">ชื่อแผน</span>
        <input name="name" required maxLength={80} defaultValue={name} placeholder="เช่น แบบปัจจุบัน หรือ ซื้อ RMF เพิ่ม 100,000" className="field" />
      </label>
    </div>
  );
}

export function NewTaxPlan({ years, year }: { years: number[]; year: number }) {
  const [state, action, pending] = useActionState<TaxState, FormData>(createTaxPlan, undefined);
  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">สร้างแผนภาษี</h2>
        <p className="text-xs text-ink-3">แผนหนึ่งคือการคำนวณภาษีหนึ่งแบบ สร้างได้หลายแผนในปีเดียวกันเพื่อเปรียบเทียบ</p>
      </div>
      <YearAndName year={year} name="" years={years} />
      <Error state={state} />
      <button className="btn" disabled={pending}>{pending ? "กำลังสร้าง…" : "สร้างแผน"}</button>
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
          <span className="eyebrow">ประเภทเงินได้</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value as IncomeType)} className="field">
            {INCOME_TYPES.map((x) => <option key={x.id} value={x.id}>{x.id.replace("_", "(")}) {x.label}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">ชื่อรายการ</span>
          <input name="name" maxLength={80} defaultValue={income?.name ?? ""} placeholder={t.label} className="field" />
        </label>
      </div>
      <p className="text-xs text-ink-3">{t.hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="eyebrow">เงินได้ทั้งปี (บาท)</span>
          <NumberInput math name="amount" required defaultValue={income ? plainNumber(income.amount) : ""} placeholder="0" className="field num" />
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">ภาษีหัก ณ ที่จ่าย</span>
          <NumberInput math name="withheld" defaultValue={income?.withheld ? plainNumber(income.withheld) : ""} placeholder="0" className="field num" />
        </label>
      </div>
      {t.kinds && (
        <label className="block space-y-1.5">
          <span className="eyebrow">ลักษณะ</span>
          <select name="kind" defaultValue={income?.kind ?? t.kinds[0].id} key={type} className="field">
            {t.kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
      )}
      {t.actual && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="expense_mode" value="standard" checked={!actual} onChange={() => setActual(false)} /> หักค่าใช้จ่ายแบบเหมา</label>
            <label className="flex items-center gap-2"><input type="radio" name="expense_mode" value="actual" checked={actual} onChange={() => setActual(true)} /> หักค่าใช้จ่ายตามจริง</label>
          </div>
          {actual && (
            <label className="block space-y-1.5">
              <span className="eyebrow">ค่าใช้จ่ายจริง (มีหลักฐาน)</span>
              <NumberInput math name="actual_expense" defaultValue={income?.actualExpense != null ? plainNumber(income.actualExpense) : ""} placeholder="0" className="field num" />
            </label>
          )}
        </div>
      )}
      {type === "40_4" && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="separate" defaultChecked={income?.separate ?? true} className="mt-1" />
          <span>ถูกหักภาษี ณ ที่จ่ายแล้วและเลือกไม่นำมารวมคำนวณ (ดอกเบี้ย 15% เงินปันผล 10%)</span>
        </label>
      )}
      <Error state={state} />
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : income ? "Save" : "Add income"}</button>
        {!income && state?.saved && !pending && <p role="status" className="text-sm font-semibold text-go-text">เพิ่มแล้ว</p>}
      </div>
    </form>
  );
}

/** The pencil beside a plan's title. */
export function EditTaxPlanButton(props: { save: Save; year: number; name: string; years: number[] }) {
  return <EditDialog label="แก้ไขแผน" title="แผนภาษี">{(close) => <EditTaxPlan {...props} onDone={close} />}</EditDialog>;
}

/** The pencil beside an income. */
export function EditTaxIncomeButton({ save, income }: { save: Save; income: TaxIncome }) {
  return <EditDialog label={`แก้ไข ${income.name}`} title="เงินได้" wide>{(close) => <TaxIncomeForm save={save} income={income} onDone={close} />}</EditDialog>;
}
