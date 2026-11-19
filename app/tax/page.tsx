import type { Metadata } from "next";
import Link from "next/link";
import SectionTabs from "@/components/SectionTabs";
import { NewTaxPlan } from "@/components/TaxForms";
import { money } from "@/lib/format";
import { calculate, taxYears } from "@/lib/tax";
import { listTaxIncomes, listTaxPlans } from "@/lib/tax-data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "ภาษี" };

const THB = (n: number) => money(n, "THB");

export default async function TaxPage() {
  const user = await requireUser();
  const [plans, incomes] = await Promise.all([listTaxPlans(user.id), listTaxIncomes(user.id)]);
  const now = new Date().getFullYear();
  const years = [...new Set(plans.map((p) => p.year))];

  return (
    <div className="mx-auto max-w-[77rem] space-y-5 px-4 py-6">
      <SectionTabs section="future" current="/tax" />
      <div>
        <h1 className="text-3xl">ภาษีเงินได้บุคคลธรรมดา</h1>
        <p className="mt-1 text-sm text-ink-3">
          คำนวณภาษีเงินได้ของแต่ละปี: เงินได้ ค่าใช้จ่าย ค่าลดหย่อน และภาษีที่ต้องชำระเพิ่มหรือได้คืน
          สร้างได้หลายแผนในปีเดียวกันเพื่อเปรียบเทียบ
        </p>
      </div>

      {years.map((year) => {
        const mine = plans.filter((p) => p.year === year).map((p) => ({ p, r: calculate(year, incomes.filter((i) => i.planId === p.id), p.deductions) }));
        const lowest = Math.min(...mine.map((x) => x.r.tax));
        return (
          <section key={year} className="space-y-3">
            <h2 className="text-xl">
              ปีภาษี {year + 543} <span className="text-sm font-semibold text-ink-3">ค.ศ. {year} · ยื่นแบบภายใน 31 มี.ค. {year + 544}</span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {mine.map(({ p, r }) => (
                <Link key={p.id} href={`/tax/${p.id}`} className="card block space-y-3 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg">{p.name}</h3>
                    {mine.length > 1 && r.tax === lowest && r.assessable > 0 && <span className="rounded-full bg-go-soft px-2.5 py-0.5 text-xs font-bold text-go-text">ภาษีต่ำสุด</span>}
                  </div>
                  {r.assessable === 0 ? (
                    <p className="text-sm text-ink-3">ยังไม่มีเงินได้ เปิดแผนเพื่อเพิ่ม</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div><p className="eyebrow">เงินได้</p><p className="num font-bold">{THB(r.assessable)}</p></div>
                        <div><p className="eyebrow">เงินได้สุทธิ</p><p className="num font-bold">{THB(r.net)}</p></div>
                        <div><p className="eyebrow">ภาษี</p><p className="num font-bold">{THB(r.tax)}</p></div>
                      </div>
                      <p className="text-sm text-ink-3">
                        {(r.effectiveRate * 100).toFixed(1)}% ของเงินได้ · อัตราสูงสุด {Math.round(r.marginal * 100)}% ·{" "}
                        {r.balance > 0 ? <span className="font-semibold text-ink">ชำระเพิ่ม {THB(r.balance)}</span>
                          : r.balance < 0 ? <span className="font-semibold text-go-text">ได้คืน {THB(-r.balance)}</span>
                          : "ไม่ต้องชำระเพิ่ม"}
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
