"use client";

import { useRef, useState, type ReactNode } from "react";
import { addTaxIncome, deleteTaxIncome, saveTaxDeductionValues, saveTaxIncomeValues, updateTaxIncome } from "@/app/actions/tax";
import ConfirmDelete from "./ConfirmDelete";
import Info from "./Info";
import NumberInput from "./NumberInput";
import { EditTaxIncomeButton, TaxIncomeForm } from "./TaxForms";
import { money, plainNumber } from "@/lib/format";
import { calculate, incomeType, rulesFor, type BracketRow, type Deductions, type TaxIncome, type TaxResult, type YearRules } from "@/lib/tax";

const THB = (n: number) => money(n, "THB");
const k = (n: number) => n.toLocaleString("en-US");
const typeLabel = (id: string) => id.replace("_", "(") + ")";
/** How long typing pauses before the change is saved. */
const SAVE_AFTER_MS = 700;

type Ctx = { rules: YearRules; year: number; be: number };
type Field = { key: keyof Deductions; label: string; hint: (c: Ctx) => string; count?: number; check?: boolean; fixed?: number };
type Tab = { id: string; label: string; fields: Field[]; note?: string; lines: string[] };

// Step 2's tabs, in the order the return (ภ.ง.ด.90/91) lists them. `lines` are the keys of the calculated lines that
// add up to the tab's total.
const TABS: Tab[] = [
  { id: "expense", label: "ค่าใช้จ่าย", fields: [], lines: [] },
  {
    id: "family", label: "ครอบครัว", lines: ["personal", "spouse", "children", "parents", "disabled", "prenatal"],
    fields: [
      { key: "spouse", label: "คู่สมรสไม่มีเงินได้", hint: () => "จดทะเบียนสมรส 60,000 บาท", check: true },
      { key: "childrenBefore2018", label: "บุตรที่เกิดก่อนปี 2561", hint: () => "คนละ 30,000 บาท อายุไม่เกิน 20 ปี (หรือไม่เกิน 25 ปีถ้ายังเรียนอยู่)", count: 20 },
      { key: "childrenFrom2018", label: "บุตรที่เกิดตั้งแต่ปี 2561", hint: () => "30,000 บาท ตั้งแต่บุตรคนที่ 2 คนละ 60,000 บาท", count: 20 },
      { key: "parents", label: "บิดามารดาที่อุปการะ", hint: () => "คนละ 30,000 บาท อายุ 60 ปีขึ้นไป เงินได้ไม่เกิน 30,000 บาท สูงสุด 4 คน", count: 4 },
      { key: "disabled", label: "ผู้พิการหรือทุพพลภาพที่อุปการะ", hint: () => "คนละ 60,000 บาท ต้องมีบัตรคนพิการ", count: 20 },
      { key: "prenatal", label: "ค่าฝากครรภ์และค่าคลอดบุตร", hint: () => "ไม่เกิน 60,000 บาทต่อการตั้งครรภ์" },
    ],
  },
  {
    id: "insurance", label: "ประกัน", lines: ["socialSecurity", "lifeInsurance", "healthInsurance", "spouseLifeInsurance", "parentsHealthInsurance"],
    fields: [
      { key: "socialSecurity", label: "เงินสมทบประกันสังคม", hint: (c) => `ตามที่จ่ายจริง ไม่เกิน ${k(c.rules.socialSecurityCap)} บาท ในปีภาษี ${c.be}` },
      { key: "lifeInsurance", label: "เบี้ยประกันชีวิต", hint: () => "ไม่เกิน 100,000 บาท กรมธรรม์ 10 ปีขึ้นไป" },
      { key: "healthInsurance", label: "เบี้ยประกันสุขภาพ", hint: () => "ไม่เกิน 25,000 บาท รวมกับประกันชีวิตไม่เกิน 100,000 บาท" },
      { key: "spouseLifeInsurance", label: "เบี้ยประกันชีวิตคู่สมรส", hint: () => "ไม่เกิน 10,000 บาท คู่สมรสไม่มีเงินได้" },
      { key: "parentsHealthInsurance", label: "เบี้ยประกันสุขภาพบิดามารดา", hint: () => "รวมทุกคนไม่เกิน 15,000 บาท" },
    ],
  },
  {
    id: "saving", label: "เงินออมและการลงทุน", lines: ["providentFund", "rmf", "pensionInsurance", "ssf", "thaiEsg"],
    note: "กองทุนสำรองเลี้ยงชีพ RMF ประกันบำนาญ และ SSF รวมกันไม่เกิน 500,000 บาท",
    fields: [
      { key: "providentFund", label: "กองทุนสำรองเลี้ยงชีพ / กบข.", hint: () => "ส่วนที่ลูกจ้างจ่าย ไม่เกิน 15% ของค่าจ้าง" },
      { key: "rmf", label: "กองทุนรวมเพื่อการเลี้ยงชีพ (RMF)", hint: () => "ไม่เกิน 30% ของเงินได้ และไม่เกิน 500,000 บาท" },
      { key: "pensionInsurance", label: "เบี้ยประกันชีวิตแบบบำนาญ", hint: () => "ไม่เกิน 15% ของเงินได้ และไม่เกิน 200,000 บาท" },
      { key: "ssf", label: "กองทุนรวมเพื่อการออม (SSF)", hint: (c) => (c.rules.ssfCap > 0 ? `ไม่เกิน 30% ของเงินได้ และไม่เกิน ${k(c.rules.ssfCap)} บาท` : `ใช้ลดหย่อนปีภาษี ${c.be} ไม่ได้ (เฉพาะที่ซื้อถึงปี 2567)`) },
      { key: "thaiEsg", label: "กองทุนรวมไทยเพื่อความยั่งยืน (Thai ESG)", hint: (c) => `ไม่เกิน 30% ของเงินได้ และไม่เกิน ${k(c.rules.thaiEsgCap)} บาท แยกวงเงินต่างหาก` },
    ],
  },
  {
    id: "home", label: "ที่อยู่อาศัยและกระตุ้นเศรษฐกิจ", lines: ["homeLoanInterest", "easyEReceipt"],
    fields: [
      { key: "homeLoanInterest", label: "ดอกเบี้ยเงินกู้ซื้อที่อยู่อาศัย", hint: () => "ไม่เกิน 100,000 บาท" },
      { key: "easyEReceipt", label: "Easy e-Receipt", hint: (c) => (c.rules.easyEReceiptCap > 0 ? `ไม่เกิน ${k(c.rules.easyEReceiptCap)} บาท ${c.rules.easyEReceiptNoteTh}` : c.rules.easyEReceiptNoteTh) },
    ],
  },
  {
    id: "donation", label: "เงินบริจาค", lines: ["politicalDonation", "donationDouble", "donationGeneral"],
    fields: [
      { key: "donationDouble", label: "บริจาคเพื่อการศึกษา โรงพยาบาลรัฐ สภากาชาดไทย", hint: () => "หักได้ 2 เท่า ไม่เกิน 10% ของเงินได้หลังหักค่าลดหย่อน" },
      { key: "donationGeneral", label: "เงินบริจาคทั่วไป", hint: () => "วัด มูลนิธิ ไม่เกิน 10% ของเงินได้หลังหักค่าลดหย่อน ตั้งแต่ปี 2569 ต้องผ่าน e-Donation" },
      { key: "politicalDonation", label: "บริจาคพรรคการเมือง", hint: () => "ไม่เกิน 10,000 บาท" },
    ],
  },
];

type Status = { pending: number; error: string | null };

/**
 * A tax plan's income, deductions and calculation, worked out in the browser on every keystroke. The rates panel
 * (beside the steps on a wide screen, at the bottom on a phone) always shows the result. Changes save on their own
 * shortly after typing stops.
 */
export default function TaxWorkspace({ planId, year, incomes: serverIncomes, deductions }: { planId: number; year: number; incomes: TaxIncome[]; deductions: Deductions }) {
  const [incomes, setIncomes] = useState(serverIncomes);
  const [d, setD] = useState(deductions);
  const [status, setStatus] = useState<Status>({ pending: 0, error: null });
  // The result when the page was opened, so the panel can say what the changes did.
  const [opened] = useState(() => calculate(year, serverIncomes, deductions));
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Rows with an edit not yet saved keep what was typed when the server sends the plan again.
  const [dirty, setDirty] = useState<Set<number>>(new Set());

  // An income added, changed in its dialog or deleted comes back from the server as new props.
  const [seen, setSeen] = useState(serverIncomes);
  if (serverIncomes !== seen) {
    setSeen(serverIncomes);
    setIncomes(serverIncomes.map((s) => (dirty.has(s.id) ? incomes.find((i) => i.id === s.id) ?? s : s)));
  }

  const r = calculate(year, incomes, d);
  const ctx: Ctx = { rules: rulesFor(year), year, be: year + 543 };

  /** Runs `save` once typing pauses, replacing an earlier one for the same thing. */
  const later = (key: string, save: () => Promise<{ error?: string } | undefined>, onDone?: () => void) => {
    const old = timers.current.get(key);
    if (old) clearTimeout(old);
    else setStatus((s) => ({ ...s, pending: s.pending + 1 }));
    timers.current.set(key, setTimeout(async () => {
      timers.current.delete(key);
      let error: string | null = null;
      try { error = (await save())?.error ?? null; } catch { error = "Couldn't save. Check the connection and try again."; }
      setStatus((s) => ({ pending: s.pending - 1, error }));
      if (!timers.current.has(key)) onDone?.();
    }, SAVE_AFTER_MS));
  };

  const setDeduction = (key: keyof Deductions, value: number | boolean) => {
    const next = { ...d, [key]: value };
    setD(next);
    later("deductions", () => saveTaxDeductionValues(planId, next));
  };

  const setIncome = (id: number, patch: Partial<TaxIncome>) => {
    const next = incomes.map((i) => (i.id === id ? { ...i, ...patch } : i));
    setIncomes(next);
    setDirty((s) => new Set(s).add(id));
    const row = next.find((i) => i.id === id)!;
    later(`income-${id}`, () => saveTaxIncomeValues(id, { amount: row.amount, withheld: row.withheld, actualExpense: row.actualExpense }),
      () => setDirty((s) => { const n = new Set(s); n.delete(id); return n; }));
  };

  return (
    <div className="pb-36 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-5 lg:pb-0">
      <div className="space-y-5">
        <Step n={1} title="Income (เงินได้พึงประเมิน)" sub={`What you earned in ${year}, by type under Section 40 of the Revenue Code. Change an amount and the tax updates as you type.`}>
          {incomes.length > 0 && (
            <ul className="divide-y divide-line">
              {incomes.map((i) => <IncomeRow key={i.id} income={i} onChange={(p) => setIncome(i.id, p)} />)}
              <Line label="Total income" value={r.assessable} strong />
            </ul>
          )}
          <div className={incomes.length > 0 ? "border-t border-line pt-4" : ""}>
            <h3 className="mb-3 text-sm font-bold">{incomes.length > 0 ? "Add another income" : "Add your income"}</h3>
            <TaxIncomeForm save={addTaxIncome.bind(null, planId)} />
          </div>
        </Step>

        <Step n={2} title="ค่าใช้จ่ายและค่าลดหย่อน" sub="ค่าใช้จ่ายคำนวณให้อัตโนมัติตามประเภทเงินได้ ค่าลดหย่อนให้กรอกตามที่จ่ายจริง ระบบใช้เพดานของแต่ละรายการให้ และตารางภาษีจะเปลี่ยนทันทีที่พิมพ์">
          <Deductions2 r={r} d={d} ctx={ctx} onChange={setDeduction} />
        </Step>

        <Breakdown r={r} />
      </div>

      <aside className="hidden lg:sticky lg:top-20 lg:block">
        <Panel r={r} opened={opened} status={status} />
      </aside>
      <MobilePanel r={r} opened={opened} status={status} />
    </div>
  );
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

function Line({ label, value, hint, strong, minus }: { label: ReactNode; value: number; hint?: ReactNode; strong?: boolean; minus?: boolean }) {
  return (
    <li className={`flex items-baseline gap-3 py-2 text-sm ${strong ? "font-bold" : ""}`}>
      <span className="min-w-0 flex-1">{label}{hint && <span className="block text-xs font-normal text-ink-3">{hint}</span>}</span>
      <span className="num shrink-0">{minus && value > 0 ? "−" : ""}{THB(value)}</span>
    </li>
  );
}

function IncomeRow({ income: i, onChange }: { income: TaxIncome; onChange: (p: Partial<TaxIncome>) => void }) {
  const field = "field num !py-1.5 text-right";
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 py-3 text-sm sm:grid-cols-[auto_1fr_9rem_8rem_auto]">
      <span className="w-12 rounded-md bg-surface-2 px-1.5 py-0.5 text-center text-xs font-bold text-ink-2">{typeLabel(i.type)}</span>
      <span className="min-w-0">
        <span className="font-semibold">{i.name}</span>
        <span className="block text-xs text-ink-3">{incomeType(i.type).label}{i.separate && " · taxed at source, left out"}</span>
      </span>
      <label className="col-span-3 grid grid-cols-[7rem_1fr] items-center gap-2 sm:col-span-1 sm:block">
        <span className="text-xs text-ink-3 sm:sr-only">Income</span>
        <NumberInput aria-label={`Income of ${i.name}`} defaultValue={plainNumber(i.amount)} onValueChange={(v) => onChange({ amount: Number(v) || 0 })} className={`${field} ${i.separate ? "text-ink-3 line-through" : ""}`} />
      </label>
      <label className="col-span-3 grid grid-cols-[7rem_1fr] items-center gap-2 sm:col-span-1 sm:block">
        <span className="text-xs text-ink-3 sm:sr-only">Withheld</span>
        <NumberInput aria-label={`Tax withheld on ${i.name}`} title="Tax withheld (ภาษีหัก ณ ที่จ่าย)" placeholder="withheld" defaultValue={i.withheld ? plainNumber(i.withheld) : ""} onValueChange={(v) => onChange({ withheld: Number(v) || 0 })} className={field} />
      </label>
      <span className="col-start-3 row-start-1 flex items-center sm:col-start-auto sm:row-start-auto">
        <EditTaxIncomeButton save={updateTaxIncome.bind(null, i.id)} income={i} />
        <ConfirmDelete action={deleteTaxIncome.bind(null, i.id)} title="Delete this income?" message={`“${i.name}” will be taken out of the plan.`}
          triggerLabel={`Delete ${i.name}`} triggerClassName="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </ConfirmDelete>
      </span>
      {i.actualExpense !== null && (
        <label className="col-span-3 grid grid-cols-[7rem_1fr] items-center gap-2 sm:col-span-2 sm:col-start-3 sm:grid-cols-[auto_8rem] sm:justify-end">
          <span className="text-xs text-ink-3">Actual expenses</span>
          <NumberInput aria-label={`Actual expenses of ${i.name}`} defaultValue={plainNumber(i.actualExpense)} onValueChange={(v) => onChange({ actualExpense: Number(v) || 0 })} className={field} />
        </label>
      )}
    </li>
  );
}

/** Step 2: one tab per group of deductions, each showing what it takes off now. */
function Deductions2({ r, d, ctx, onChange }: { r: TaxResult; d: Deductions; ctx: Ctx; onChange: (key: keyof Deductions, v: number | boolean) => void }) {
  const [tab, setTab] = useState(TABS[1].id);
  const allowed = new Map([...r.allowances, ...r.donations].map((l) => [l.key, l]));
  const total = (t: Tab) => (t.id === "expense" ? r.expenseTotal : t.lines.reduce((s, key) => s + (allowed.get(key)?.allowed ?? 0), 0));
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="กลุ่มค่าลดหย่อน" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-2xl px-3.5 py-2 text-left ${on ? "bg-ink text-surface" : "bg-surface-2 text-ink-2 hover:text-ink"}`}>
              <span className="block text-sm font-bold">{t.label}</span>
              <span className={`num block text-[11px] ${on ? "opacity-75" : "text-ink-3"}`}>−{k(Math.round(total(t)))}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={current.label}>
        {current.id === "expense" ? (
          r.expenses.length === 0 ? (
            <p className="text-sm text-ink-3">เพิ่มเงินได้ในขั้นที่ 1 แล้วค่าใช้จ่ายจะคำนวณให้ที่นี่</p>
          ) : (
            <ul className="divide-y divide-line">
              {r.expenses.map((e) => <Line key={e.income.id} label={`${typeLabel(e.income.type)} ${e.income.name}`} hint={e.note} value={e.expense} minus />)}
              <Line label="รวมค่าใช้จ่าย" value={r.expenseTotal} strong minus />
            </ul>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {current.id === "family" && (
              <div className="space-y-1">
                <span className="text-sm font-semibold">ผู้มีเงินได้</span>
                <p className="field num text-ink-3">60,000</p>
                <span className="block text-xs text-ink-3">ทุกคนได้รับค่าลดหย่อนส่วนตัว</span>
              </div>
            )}
            {current.fields.map((f) => <DeductionField key={f.key} f={f} d={d} ctx={ctx} line={allowed.get(f.key === "childrenBefore2018" || f.key === "childrenFrom2018" ? "children" : f.key)} onChange={onChange} />)}
            {current.note && <p className="text-xs text-ink-3 sm:col-span-2">{current.note}</p>}
            {current.id === "saving" && r.retirementCut > 0 && (
              <p className="text-xs font-semibold text-miss-text sm:col-span-2">เกินเพดานรวม 500,000 บาท ไป {THB(r.retirementCut)} ส่วนนี้ไม่นำมาหัก (ตัดจาก RMF ก่อน)</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DeductionField({ f, d, ctx, line, onChange }: { f: Field; d: Deductions; ctx: Ctx; line?: { claimed: number; allowed: number }; onChange: (key: keyof Deductions, v: number | boolean) => void }) {
  const value = d[f.key];
  // Shows what is actually taken off when the cap cuts what was typed. Counts are people, so they show the total.
  const counted = f.count !== undefined;
  const cut = !counted && line && typeof value === "number" && value > 0 && line.allowed + 0.005 < (f.key === "donationDouble" ? value * 2 : value);
  if (f.check) {
    return (
      <label className="flex items-start gap-2 self-center text-sm">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(f.key, e.target.checked)} className="mt-1" />
        <span><span className="font-semibold">{f.label}</span><span className="block text-xs text-ink-3">{f.hint(ctx)}</span></span>
      </label>
    );
  }
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between gap-2 text-sm font-semibold">
        <span>{f.label}</span>
        {cut && <span className="num shrink-0 text-xs font-semibold text-miss-text">หักได้ {k(Math.round(line!.allowed))}</span>}
        {counted && line && line.allowed > 0 && <span className="num shrink-0 text-xs font-semibold text-ink-3">−{k(line.allowed)}</span>}
      </span>
      {counted ? (
        <input type="number" min={0} max={f.count} step={1} value={Number(value) || ""} placeholder="0"
          onChange={(e) => onChange(f.key, Math.min(f.count!, Math.max(0, Math.floor(Number(e.target.value) || 0))))} className="field num" />
      ) : (
        <NumberInput defaultValue={value ? plainNumber(Number(value)) : ""} placeholder="0" onValueChange={(v) => onChange(f.key, Number(v) || 0)} className="field num" />
      )}
      <span className="block text-xs text-ink-3">{f.hint(ctx)}</span>
    </label>
  );
}

/** Step 3: every line with its limit applied, from income to net income, and the minimum tax. */
function Breakdown({ r }: { r: TaxResult }) {
  return (
    <Step n={3} title="How the tax is worked out (การคำนวณภาษี)" sub="Income, less expenses, less deductions, gives net income. The rates panel applies the progressive rates to it.">
      <ul className="divide-y divide-line">
        <Line label="Income" value={r.assessable} />
        <Line label="Less expenses" value={r.expenseTotal} minus />
        <Line label="Income after expenses" value={r.afterExpenses} strong />
      </ul>
      <div>
        <h3 className="mb-1 text-sm font-bold">Deductions allowed</h3>
        <ul className="divide-y divide-line">
          {r.allowances.map((l) => (
            <Line key={l.key} value={l.allowed} minus hint={l.note}
              label={<>{l.label}{l.claimed > l.allowed + 0.005 && <span className="ml-2 text-xs font-semibold text-miss-text">of {THB(l.claimed)}</span>}</>} />
          ))}
          {r.retirementCut > 0 && <li className="py-2 text-xs text-miss-text">Retirement savings were over the 500,000 cap together: {THB(r.retirementCut)} not counted (taken off RMF first).</li>}
          <Line label="Total deductions" value={r.allowanceTotal} strong minus />
        </ul>
      </div>
      {r.donations.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-bold">Donations</h3>
          <ul className="divide-y divide-line">
            {r.donations.map((l) => <Line key={l.key} value={l.allowed} minus hint={l.note} label={l.label} />)}
          </ul>
        </div>
      )}
      <ul className="divide-y divide-line border-t-2 border-ink/20">
        <Line label="Net income (เงินได้สุทธิ)" value={r.net} strong />
      </ul>
      {r.minimumTax !== null && (
        <p className="rounded-xl bg-surface-2 px-4 py-2.5 text-sm text-ink-2">
          <span className="font-semibold">Minimum tax:</span> income other than salary is {THB(r.otherIncome)}, 120,000 or more, so the tax is also worked out as
          0.5% of it: {THB(r.minimumTax)}. {r.minimumApplies
            ? <>That is more than the progressive tax, and over 5,000, so it is the tax due.</>
            : r.minimumTax <= 5_000 ? <>At 5,000 or less it is waived; the progressive tax applies.</>
            : <>The progressive tax is higher, so it applies.</>}
        </p>
      )}
      <p className="text-xs text-ink-3">
        An estimate to plan with, not tax advice. Not covered: the 190,000 exemption at 65 and over, severance and retirement pay
        worked out separately, the dividend tax credit, and filing jointly. Check the Revenue Department (rd.go.th) before you file.
      </p>
    </Step>
  );
}

const range = (b: BracketRow) => (b.upTo === null ? `Over ${k(b.from)}` : `${k(b.from === 0 ? 0 : b.from + 1)} – ${k(b.upTo)}`);

function SaveStatus({ status }: { status: Status }) {
  if (status.error) return <span role="alert" className="text-xs font-semibold text-miss-text">{status.error}</span>;
  return <span role="status" className="text-xs text-ink-3">{status.pending > 0 ? "Saving…" : "All changes saved"}</span>;
}

/** What changed since the page was opened: tax up is red, down is green. */
function Change({ now, then }: { now: number; then: number }) {
  const diff = Math.round((now - then) * 100) / 100;
  if (Math.abs(diff) < 0.005) return null;
  return <span className={`num text-xs font-semibold ${diff > 0 ? "text-miss-text" : "text-go-text"}`}>{diff > 0 ? "+" : "−"}{THB(Math.abs(diff))} since opened</span>;
}

/** The next bracket down, and how much more deduction would reach it. */
function nextDown(r: TaxResult) {
  const at = r.brackets.findLastIndex((b) => b.taxed > 0);
  if (at <= 0 || r.minimumApplies) return null;
  const b = r.brackets[at];
  return { rate: r.brackets[at - 1].rate, need: r.net - b.from };
}

function Rates({ r }: { r: TaxResult }) {
  const top = r.brackets.findLastIndex((b) => b.taxed > 0);
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-[11px] text-ink-3">
        <tr><th className="pb-1 font-semibold">Net income</th><th className="pb-1 text-right font-semibold">Rate</th><th className="pb-1 text-right font-semibold">Tax</th></tr>
      </thead>
      <tbody>
        {r.brackets.map((b, i) => {
          const size = b.upTo === null ? Math.max(b.taxed, 1) : b.upTo - b.from;
          const fill = Math.min(1, b.taxed / size);
          const on = i === top;
          return (
            <tr key={b.from} className={b.taxed > 0 ? "" : "text-ink-3"}>
              <td className="py-1 pr-2">
                <span className={`num block text-xs ${on ? "font-bold text-ink" : ""}`}>{range(b)}</span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className={`block h-full rounded-full transition-[width] duration-200 ${on ? "bg-brand" : "bg-ink-3"}`} style={{ width: `${fill * 100}%` }} />
                </span>
              </td>
              <td className={`num py-1 text-right text-xs ${on ? "font-bold" : ""}`}>{b.rate === 0 ? "0%" : `${Math.round(b.rate * 100)}%`}</td>
              <td className="num py-1 text-right text-xs">{b.taxed > 0 ? k(Math.round(b.tax)) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Panel({ r, opened, status }: { r: TaxResult; opened: TaxResult; status: Status }) {
  const down = nextDown(r);
  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg">
          Your tax
          <Info label="About the rates">The progressive rates on net income, unchanged since tax year 2017. The first 150,000 is free, then each slice pays its own rate: only the part inside a bracket pays that bracket&apos;s rate. The bar shows how full each bracket is.</Info>
        </h2>
        <SaveStatus status={status} />
      </div>
      <ul className="space-y-1 text-sm">
        <li className="flex justify-between"><span className="text-ink-3">Income</span><span className="num">{THB(r.assessable)}</span></li>
        <li className="flex justify-between"><span className="text-ink-3">− Expenses</span><span className="num">{THB(r.expenseTotal)}</span></li>
        <li className="flex justify-between"><span className="text-ink-3">− Deductions and donations</span><span className="num">{THB(r.allowanceTotal + r.donationTotal)}</span></li>
        <li className="flex items-baseline justify-between border-t border-line pt-1 font-bold"><span>Net income</span><span className="num">{THB(r.net)}</span></li>
      </ul>
      <Rates r={r} />
      <ul className="space-y-1 border-t border-line pt-3 text-sm">
        <li className="flex justify-between"><span className="text-ink-3">Tax by the rates</span><span className="num">{THB(r.progressiveTax)}</span></li>
        {r.minimumApplies && <li className="flex justify-between"><span className="text-ink-3">Minimum tax (0.5%) applies</span><span className="num">{THB(r.tax)}</span></li>}
        <li className="flex items-baseline justify-between font-bold"><span>Tax due</span><span className="num">{THB(r.tax)}</span></li>
        <li className="text-right"><Change now={r.tax} then={opened.tax} /></li>
        <li className="flex justify-between"><span className="text-ink-3">− Withheld</span><span className="num">{THB(r.withheld)}</span></li>
        <li className={`flex items-baseline justify-between text-base font-bold ${r.balance < 0 ? "text-go-text" : ""}`}>
          <span>{r.balance < 0 ? "Comes back" : "Still to pay"}</span><span className="num">{THB(Math.abs(r.balance))}</span>
        </li>
      </ul>
      <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
        {(r.effectiveRate * 100).toFixed(2)}% of income. Top rate {Math.round(r.marginal * 100)}%
        {r.marginal > 0 && !r.minimumApplies && <>: each 1,000 more of deductions saves {k(r.marginal * 1000)}</>}.
        {down && <> {THB(down.need)} more of deductions brings net income down to the {Math.round(down.rate * 100)}% bracket.</>}
      </p>
    </section>
  );
}

/** On a phone: the result at the bottom of the screen, opening to the full rates table. */
function MobilePanel({ r, opened, status }: { r: TaxResult; opened: TaxResult; status: Status }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed inset-x-3 z-30 lg:hidden [bottom:calc(0.75rem+env(safe-area-inset-bottom))] pr-[4.25rem]">
      <div className="rounded-2xl border border-line bg-surface shadow-xl">
        {open && <div className="max-h-[60vh] overflow-y-auto border-b border-line"><Panel r={r} opened={opened} status={status} /></div>}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-ink-3">Net {THB(r.net)} · top rate {Math.round(r.marginal * 100)}%</span>
            <span className="num block font-bold">Tax {THB(r.tax)} <span className={`text-xs ${r.balance < 0 ? "text-go-text" : "text-ink-3"}`}>{r.balance < 0 ? `${THB(-r.balance)} back` : `${THB(r.balance)} to pay`}</span></span>
          </span>
          <span className="text-xs font-semibold text-brand">{open ? "Hide" : "Rates"}</span>
        </button>
      </div>
    </div>
  );
}
