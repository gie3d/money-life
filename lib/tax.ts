/**
 * Thai personal income tax (ภาษีเงินได้บุคคลธรรมดา), worked out the way the Revenue Code does it:
 *   assessable income − expenses (by type of income) − allowances − donations = net income,
 *   then the progressive rates on net income, compared with the 0.5% minimum for income other than salary.
 * The tax year is the calendar year; the return (ภ.ง.ด.90/91) is filed by the end of March of the next year.
 *
 * What changes from year to year (the social security cap, Easy e-Receipt, SSF, Thai ESG) is in RULES by year.
 * Pure functions only: no database, so it can be tested on its own (scripts/test-tax.mjs).
 */

/** Section 40 of the Revenue Code: the eight types of assessable income. */
export type IncomeType = "40_1" | "40_2" | "40_3" | "40_4" | "40_5" | "40_6" | "40_7" | "40_8";

/** The standard expense rate of each kind of income, where a type has more than one. */
export const INCOME_TYPES: { id: IncomeType; label: string; th: string; hint: string; kinds?: { id: string; label: string; rate: number }[]; actual?: boolean }[] = [
  { id: "40_1", label: "Salary and wages", th: "เงินเดือน ค่าจ้าง โบนัส", hint: "From an employer: salary, bonus, allowances. 40(1)." },
  { id: "40_2", label: "Fees and commissions", th: "ค่าธรรมเนียม ค่านายหน้า", hint: "Freelance work, a director's fee, commission. 40(2)." },
  { id: "40_3", label: "Royalties", th: "ค่าลิขสิทธิ์", hint: "Copyright, goodwill, royalties. 40(3)." },
  { id: "40_4", label: "Interest and dividends", th: "ดอกเบี้ย เงินปันผล", hint: "No expense deduction. Usually taxed at source instead (15% / 10%); tick that to leave it out. 40(4)." },
  {
    id: "40_5", label: "Rent", th: "ค่าเช่าทรัพย์สิน", hint: "Renting out property. 40(5).", actual: true,
    kinds: [
      { id: "building", label: "House, building or condo (30%)", rate: 0.3 },
      { id: "farmland", label: "Farmland (20%)", rate: 0.2 },
      { id: "land", label: "Other land (15%)", rate: 0.15 },
      { id: "vehicle", label: "Vehicle (30%)", rate: 0.3 },
      { id: "other", label: "Anything else (10%)", rate: 0.1 },
    ],
  },
  {
    id: "40_6", label: "Liberal professions", th: "วิชาชีพอิสระ", hint: "Medicine, law, engineering, architecture, accounting, fine arts. 40(6).", actual: true,
    kinds: [
      { id: "medical", label: "Medicine (60%)", rate: 0.6 },
      { id: "other", label: "Law, engineering, architecture, accounting, fine arts (30%)", rate: 0.3 },
    ],
  },
  { id: "40_7", label: "Contract work", th: "รับเหมา", hint: "Contracting where you supply the materials. 60%. 40(7).", actual: true },
  { id: "40_8", label: "Business and other", th: "ธุรกิจ การค้า อื่นๆ", hint: "Trading, online selling, other business. 60% for most kinds. 40(8).", actual: true },
];

export const incomeType = (id: IncomeType) => INCOME_TYPES.find((t) => t.id === id)!;

export type TaxIncome = {
  id: number;
  type: IncomeType;
  name: string;
  amount: number;
  /** For rent and liberal professions: which standard rate. */
  kind: string | null;
  /** Actual expenses claimed instead of the standard rate (40(5) to 40(8)); null for the standard rate. */
  actualExpense: number | null;
  /** Tax already withheld (ภาษีหัก ณ ที่จ่าย), credited against what is due. */
  withheld: number;
  /** 40(4) taxed at source as final: left out of the return. */
  separate: boolean;
};

/** What the user claims; every amount is as paid, and the calculation caps it. Counts are whole people. */
export type Deductions = {
  spouse: boolean;              // spouse with no income
  childrenBefore2018: number;
  childrenFrom2018: number;
  parents: number;              // 0 to 4, aged 60+ with income under 30,000
  disabled: number;             // disabled dependants
  prenatal: number;
  socialSecurity: number;
  lifeInsurance: number;
  healthInsurance: number;
  spouseLifeInsurance: number;
  parentsHealthInsurance: number;
  pensionInsurance: number;
  providentFund: number;        // PVD, GPF (กบข.), private school teachers' fund
  rmf: number;
  ssf: number;
  thaiEsg: number;
  homeLoanInterest: number;
  easyEReceipt: number;
  politicalDonation: number;
  donationDouble: number;       // education, state hospitals, Thai Red Cross: counted twice
  donationGeneral: number;
};

export const NO_DEDUCTIONS: Deductions = {
  spouse: false, childrenBefore2018: 0, childrenFrom2018: 0, parents: 0, disabled: 0, prenatal: 0,
  socialSecurity: 0, lifeInsurance: 0, healthInsurance: 0, spouseLifeInsurance: 0, parentsHealthInsurance: 0,
  pensionInsurance: 0, providentFund: 0, rmf: 0, ssf: 0, thaiEsg: 0, homeLoanInterest: 0, easyEReceipt: 0,
  politicalDonation: 0, donationDouble: 0, donationGeneral: 0,
};

/** Reads stored deductions, filling anything missing (an older plan, a new field) with nothing. */
export function readDeductions(raw: unknown): Deductions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...NO_DEDUCTIONS } as Record<string, number | boolean>;
  for (const k of Object.keys(NO_DEDUCTIONS)) {
    if (k === "spouse") out[k] = o[k] === true;
    else { const n = Number(o[k]); out[k] = Number.isFinite(n) && n > 0 ? n : 0; }
  }
  return out as Deductions;
}

/** What differs by tax year. Years before the first are worked out with the first; after the last, with the last. */
export type YearRules = {
  socialSecurityCap: number;
  /** 0 when there was no scheme that year. */
  easyEReceiptCap: number;
  easyEReceiptNote: string;
  /** The same note in Thai, for the deductions form. */
  easyEReceiptNoteTh: string;
  /** 0 once purchases no longer count. */
  ssfCap: number;
  thaiEsgCap: number;
};

export const RULES: Record<number, YearRules> = {
  2024: { socialSecurityCap: 9_000, easyEReceiptCap: 50_000, easyEReceiptNote: "Bought Jan 1 – Feb 15, 2024, with e-Tax invoices", easyEReceiptNoteTh: "ซื้อสินค้าและบริการ 1 ม.ค. – 15 ก.พ. 2567 มีใบกำกับภาษีอิเล็กทรอนิกส์", ssfCap: 200_000, thaiEsgCap: 300_000 },
  2025: { socialSecurityCap: 9_000, easyEReceiptCap: 50_000, easyEReceiptNote: "Easy e-Receipt 2.0, Jan 16 – Feb 28, 2025: up to 30,000 of anything, plus 20,000 of community and OTOP goods", easyEReceiptNoteTh: "Easy e-Receipt 2.0 ซื้อ 16 ม.ค. – 28 ก.พ. 2568 สินค้าทั่วไป 30,000 บาท และสินค้าวิสาหกิจชุมชน/OTOP อีก 20,000 บาท", ssfCap: 0, thaiEsgCap: 300_000 },
  // The wage ceiling rose to 17,500 a month from Jan 2026: 875 a month, 10,500 a year.
  2026: { socialSecurityCap: 10_500, easyEReceiptCap: 0, easyEReceiptNote: "No Easy e-Receipt scheme announced for 2026", easyEReceiptNoteTh: "ยังไม่มีประกาศโครงการ Easy e-Receipt สำหรับปีภาษี 2569", ssfCap: 0, thaiEsgCap: 300_000 },
  // Thai ESG goes back to 100,000 (8-year hold) from 2027.
  2027: { socialSecurityCap: 10_500, easyEReceiptCap: 0, easyEReceiptNote: "No Easy e-Receipt scheme announced", easyEReceiptNoteTh: "ยังไม่มีประกาศโครงการ Easy e-Receipt", ssfCap: 0, thaiEsgCap: 100_000 },
};
const RULE_YEARS = Object.keys(RULES).map(Number).sort((a, b) => a - b);
export function rulesFor(year: number): YearRules {
  const y = Math.min(Math.max(year, RULE_YEARS[0]), RULE_YEARS[RULE_YEARS.length - 1]);
  return RULES[y];
}
/** True when the year is past the newest rules we know, so the page can say they are assumed. */
export const rulesAssumed = (year: number) => year > RULE_YEARS[RULE_YEARS.length - 1];

/** The tax years to pick from: a few back (returns are filed the year after) and the next one. */
export const taxYears = (now: number) => [now + 1, now, now - 1, now - 2, now - 3];

/** The progressive rates on net income (unchanged since tax year 2017). `upTo` null is the top bracket. */
export const BRACKETS: { upTo: number | null; rate: number }[] = [
  { upTo: 150_000, rate: 0 },
  { upTo: 300_000, rate: 0.05 },
  { upTo: 500_000, rate: 0.1 },
  { upTo: 750_000, rate: 0.15 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: 2_000_000, rate: 0.25 },
  { upTo: 5_000_000, rate: 0.3 },
  { upTo: null, rate: 0.35 },
];

export type BracketRow = { from: number; upTo: number | null; rate: number; taxed: number; tax: number };

/** Tax on a net income by the progressive rates, with what fell in each bracket. */
export function progressive(net: number): { tax: number; rows: BracketRow[]; marginal: number } {
  let from = 0;
  let tax = 0;
  let marginal = 0;
  const rows: BracketRow[] = [];
  for (const b of BRACKETS) {
    const top = b.upTo ?? Infinity;
    const taxed = Math.max(0, Math.min(net, top) - from);
    const t = taxed * b.rate;
    rows.push({ from, upTo: b.upTo, rate: b.rate, taxed, tax: t });
    if (taxed > 0) marginal = b.rate;
    tax += t;
    from = top;
  }
  return { tax, rows, marginal };
}

export type Line = { key: string; label: string; claimed: number; allowed: number; note?: string };

export type TaxResult = {
  assessable: number;
  /** Income other than salary (40(2) to 40(8)), for the minimum tax. */
  otherIncome: number;
  expenses: { income: TaxIncome; expense: number; note: string }[];
  expenseTotal: number;
  afterExpenses: number;
  allowances: Line[];
  allowanceTotal: number;
  /** The 500,000 cap on retirement savings together, when it cut anything. */
  retirementCut: number;
  donations: Line[];
  donationTotal: number;
  net: number;
  brackets: BracketRow[];
  progressiveTax: number;
  marginal: number;
  /** 0.5% of income other than salary, when that income is 120,000 or more; null when it doesn't apply. */
  minimumTax: number | null;
  /** True when the minimum tax is the one due. */
  minimumApplies: boolean;
  tax: number;
  withheld: number;
  /** Positive: still to pay. Negative: a refund. */
  balance: number;
  /** Tax as a share of assessable income. */
  effectiveRate: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculate(year: number, incomes: TaxIncome[], d: Deductions): TaxResult {
  const rules = rulesFor(year);
  const counted = incomes.filter((i) => !(i.type === "40_4" && i.separate));

  // 1. Income.
  const assessable = counted.reduce((s, i) => s + i.amount, 0);
  const wages = counted.filter((i) => i.type === "40_1").reduce((s, i) => s + i.amount, 0);
  const otherIncome = assessable - wages;

  // 2. Expenses. 40(1) and 40(2) share one 50% deduction capped at 100,000; 40(3) has its own.
  // Each income gets its share of a shared cap in proportion to its amount, so the lines add up.
  const shareCap = (types: IncomeType[]) => {
    const total = counted.filter((i) => types.includes(i.type)).reduce((s, i) => s + i.amount, 0);
    const allowed = Math.min(total * 0.5, 100_000);
    return (i: TaxIncome) => (total > 0 ? (allowed * i.amount) / total : 0);
  };
  const employ = shareCap(["40_1", "40_2"]);
  const royalty = shareCap(["40_3"]);
  const expenses = counted.map((i) => {
    if (i.type === "40_1" || i.type === "40_2") return { income: i, expense: employ(i), note: "50% รวม 40(1) และ 40(2) ไม่เกิน 100,000 บาท" };
    if (i.type === "40_3") return { income: i, expense: royalty(i), note: "50% ไม่เกิน 100,000 บาท" };
    if (i.type === "40_4") return { income: i, expense: 0, note: "ดอกเบี้ยและเงินปันผลหักค่าใช้จ่ายไม่ได้" };
    if (i.actualExpense !== null) return { income: i, expense: Math.min(i.actualExpense, i.amount), note: "หักตามจริง" };
    const t = incomeType(i.type);
    const rate = t.kinds ? (t.kinds.find((k) => k.id === i.kind) ?? t.kinds[0]).rate : 0.6;
    return { income: i, expense: i.amount * rate, note: `หักเหมา ${Math.round(rate * 100)}%` };
  });
  const expenseTotal = expenses.reduce((s, e) => s + e.expense, 0);
  const afterExpenses = Math.max(0, assessable - expenseTotal);

  // 3. Allowances.
  const lines: Line[] = [];
  const add = (key: string, label: string, claimed: number, allowed: number, note?: string) => {
    if (claimed > 0 || allowed > 0) lines.push({ key, label, claimed, allowed: Math.max(0, allowed), note });
  };
  add("personal", "Personal allowance", 60_000, 60_000);
  if (d.spouse) add("spouse", "Spouse with no income", 60_000, 60_000);
  const kids = d.childrenBefore2018 + d.childrenFrom2018;
  // A child born in 2018 or later who is a second or later child counts 60,000 instead of 30,000.
  const extra = d.childrenBefore2018 > 0 ? d.childrenFrom2018 : Math.max(0, d.childrenFrom2018 - 1);
  if (kids > 0) add("children", `Children (${kids})`, kids * 30_000 + extra * 30_000, kids * 30_000 + extra * 30_000, extra > 0 ? `30,000 each, 60,000 for ${extra} born 2018 or later as a second child or later` : "30,000 each");
  const parents = Math.min(d.parents, 4);
  if (parents > 0) add("parents", `Parents (${parents})`, parents * 30_000, parents * 30_000, "30,000 each, up to 4");
  if (d.disabled > 0) add("disabled", `Disabled dependants (${d.disabled})`, d.disabled * 60_000, d.disabled * 60_000, "60,000 each");
  add("prenatal", "Pregnancy and childbirth", d.prenatal, Math.min(d.prenatal, 60_000), "Up to 60,000 a pregnancy");
  add("socialSecurity", "Social security", d.socialSecurity, Math.min(d.socialSecurity, rules.socialSecurityCap), `Up to ${rules.socialSecurityCap.toLocaleString("en-US")} in ${year}`);

  const life = Math.min(d.lifeInsurance, 100_000);
  const health = Math.min(d.healthInsurance, 25_000, 100_000 - life);
  add("lifeInsurance", "Life insurance", d.lifeInsurance, life, "Up to 100,000, together with health insurance");
  add("healthInsurance", "Health insurance", d.healthInsurance, health, "Up to 25,000; life and health together up to 100,000");
  add("spouseLifeInsurance", "Spouse's life insurance", d.spouseLifeInsurance, d.spouse ? Math.min(d.spouseLifeInsurance, 10_000) : 0, d.spouse ? "Up to 10,000" : "Only with a spouse with no income");
  add("parentsHealthInsurance", "Parents' health insurance", d.parentsHealthInsurance, Math.min(d.parentsHealthInsurance, 15_000), "Up to 15,000");

  // Retirement savings: each has its own cap, and together they stop at 500,000.
  const pension = Math.min(d.pensionInsurance, assessable * 0.15, 200_000);
  const pvd = Math.min(d.providentFund, wages * 0.15, 500_000);
  const rmf = Math.min(d.rmf, assessable * 0.3, 500_000);
  const ssf = Math.min(d.ssf, assessable * 0.3, rules.ssfCap);
  const retirement = pension + pvd + rmf + ssf;
  const retirementCut = Math.max(0, retirement - 500_000);
  // The cut comes off the last of them (RMF, then SSF, ...): what you put in a fund is what you would trim.
  let cut = retirementCut;
  const trim = (n: number) => { const t = Math.min(n, cut); cut -= t; return n - t; };
  const [rmfOk, ssfOk, pvdOk, pensionOk] = [trim(rmf), trim(ssf), trim(pvd), trim(pension)];
  add("pensionInsurance", "Pension insurance", d.pensionInsurance, pensionOk, "15% of income, up to 200,000");
  add("providentFund", "Provident fund (PVD / GPF)", d.providentFund, pvdOk, "15% of salary, up to 500,000");
  add("rmf", "RMF", d.rmf, rmfOk, "30% of income, up to 500,000");
  add("ssf", "SSF", d.ssf, ssfOk, rules.ssfCap > 0 ? `30% of income, up to ${rules.ssfCap.toLocaleString("en-US")}` : `Not deductible for ${year}: SSF purchases counted up to 2024`);
  add("thaiEsg", "Thai ESG", d.thaiEsg, Math.min(d.thaiEsg, assessable * 0.3, rules.thaiEsgCap), `30% of income, up to ${rules.thaiEsgCap.toLocaleString("en-US")}; outside the 500,000 cap`);

  add("homeLoanInterest", "Home loan interest", d.homeLoanInterest, Math.min(d.homeLoanInterest, 100_000), "Up to 100,000");
  add("easyEReceipt", "Easy e-Receipt", d.easyEReceipt, Math.min(d.easyEReceipt, rules.easyEReceiptCap), rules.easyEReceiptNote);
  add("politicalDonation", "Donation to a political party", d.politicalDonation, Math.min(d.politicalDonation, 10_000), "Up to 10,000");

  const allowanceTotal = Math.min(afterExpenses, lines.reduce((s, l) => s + l.allowed, 0));
  const beforeDonations = afterExpenses - allowanceTotal;

  // 4. Donations: up to 10% of income after expenses and allowances. Double-counted ones first, then the rest
  // up to 10% of what is left after them.
  const double = Math.min(d.donationDouble * 2, beforeDonations * 0.1);
  const general = Math.min(d.donationGeneral, (beforeDonations - double) * 0.1);
  const donations: Line[] = [];
  if (d.donationDouble > 0) donations.push({ key: "donationDouble", label: "Education, state hospitals, Thai Red Cross (×2)", claimed: d.donationDouble, allowed: double, note: "Twice the amount, up to 10% of income after allowances" });
  if (d.donationGeneral > 0) donations.push({ key: "donationGeneral", label: "Other donations", claimed: d.donationGeneral, allowed: Math.max(0, general), note: "Up to 10% of income after allowances and the donations above" });
  const donationTotal = donations.reduce((s, l) => s + l.allowed, 0);

  const net = Math.max(0, beforeDonations - donationTotal);

  // 5. Tax.
  const p = progressive(net);
  // Minimum tax: with 120,000 or more of income other than salary, 0.5% of it, if that is more (and over 5,000).
  const minimumTax = otherIncome >= 120_000 ? otherIncome * 0.005 : null;
  const minimumApplies = minimumTax !== null && minimumTax > 5_000 && minimumTax > p.tax;
  const tax = r2(minimumApplies ? minimumTax! : p.tax);
  // Tax withheld on interest and dividends taxed at source is final: it isn't credited on the return.
  const withheld = counted.reduce((s, i) => s + i.withheld, 0);

  return {
    assessable, otherIncome, expenses, expenseTotal, afterExpenses,
    allowances: lines, allowanceTotal, retirementCut, donations, donationTotal, net,
    brackets: p.rows, progressiveTax: r2(p.tax), marginal: p.marginal, minimumTax, minimumApplies,
    tax, withheld, balance: r2(tax - withheld), effectiveRate: assessable > 0 ? tax / assessable : 0,
  };
}
