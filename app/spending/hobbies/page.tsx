import type { Metadata } from "next";
import SectionTabs from "@/components/SectionTabs";
import { CategoryBars, Change, PeriodBars, PeriodSwitcher, Tile } from "@/components/SpendingCharts";
import HobbyForm, { HobbyActions } from "@/components/HobbyForm";
import { listHobbySpending } from "@/lib/data";
import { day, money } from "@/lib/format";
import { colorFor } from "@/lib/palette";
import { requireUser } from "@/lib/session";
import { byCategory, categoryOrder, change, compareYear, isYear, sum, yearOf, HOBBY_CATEGORIES } from "@/lib/spending";

export const metadata: Metadata = { title: "Hobby spending" };

/** A note under a hobby spending: shown whole when short; a long one shows three lines and opens on a tap. */
function Note({ text }: { text: string }) {
  const quote = "ml-[1.125rem] mt-1.5 whitespace-pre-line border-l-2 border-line pl-3 text-ink-2";
  if (text.length <= 220 && text.split("\n").length <= 3) return <p className={quote}>{text}</p>;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <p className={`${quote} line-clamp-3 group-open:line-clamp-none`}>{text}</p>
        <span className="ml-[1.125rem] pl-3 text-xs font-semibold text-brand"><span className="group-open:hidden">Read more</span><span className="hidden group-open:inline">Show less</span></span>
      </summary>
    </details>
  );
}

const yearHref = (y: string, thisYear: string) => (y === thisYear ? "/spending/hobbies" : `/spending/hobbies?year=${y}`);

export default async function HobbySpendingPage({ searchParams }: PageProps<"/spending/hobbies">) {
  const user = await requireUser();
  const cur = user.currency;
  const today = new Date().toISOString().slice(0, 10);
  const thisYear = today.slice(0, 4);
  const sp = await searchParams;
  const year = isYear(sp.year) && sp.year <= thisYear && sp.year >= "1900" ? sp.year : thisYear;

  const all = await listHobbySpending(user.id);
  const order = categoryOrder(all);
  const color = (c: string) => colorFor(c, order);
  const categories = [...new Set([...order.map((o) => o.id), ...HOBBY_CATEGORIES])];

  const cmp = compareYear(all, year, today);
  const inYear = all.filter((s) => yearOf(s) === year);
  const inPrev = all.filter((s) => yearOf(s) === cmp.prev);
  const prevByCat = new Map(byCategory(inPrev).map((c) => [c.category, c.total]));
  const rows = byCategory(inYear).map((c) => ({ ...c, color: color(c.category), before: inPrev.length > 0 ? (prevByCat.get(c.category) ?? 0) : null }));

  // Every year from the first one recorded (at most the last 10), so a year with nothing still shows as a gap.
  const first = all.length > 0 ? all.reduce((m, s) => (yearOf(s) < m ? yearOf(s) : m), thisYear) : thisYear;
  const from = Math.max(Math.min(+first, +year), +thisYear - 9);
  const years = Array.from({ length: +thisYear - from + 1 }, (_, i) => String(from + i));
  const bars = years.map((y) => ({
    key: y, label: y, href: yearHref(y, thisYear),
    segments: byCategory(all.filter((s) => yearOf(s) === y)).map((c) => ({ label: c.category, color: color(c.category), value: c.total })),
  }));

  // Hobby by year, for the last 5 years up to the one shown.
  const tableYears = years.filter((y) => y <= year).slice(-5);
  const cell = (cat: string | null, y: string) => sum(all.filter((s) => yearOf(s) === y && (cat === null || s.category === cat)));
  const tableCats = order.map((o) => o.id).filter((c) => tableYears.some((y) => cell(c, y) > 0));

  const fair = cmp.running ? cmp.prevSoFar : cmp.prevTotal;
  const dayMonth = day(today).replace(/,? \d{4}$/, "");

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <SectionTabs section="spending" current="/spending/hobbies" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Hobby spending</h1>
          <p className="mt-1 text-sm text-ink-3">Trips, gadgets and the things you love, year by year, so you can see how this year compares.</p>
        </div>
        <PeriodSwitcher
          label={year}
          prevHref={yearHref(cmp.prev, thisYear)} prevLabel={`Show ${cmp.prev}`}
          nextHref={year < thisYear ? yearHref(String(+year + 1), thisYear) : null} nextLabel={`Show ${+year + 1}`}
        />
      </div>

      {all.length === 0 ? (
        <>
          <div className="card p-6 text-sm text-ink-3">
            <p className="font-bold text-ink">Add what you remember</p>
            <p className="mt-1">Start with the big ones: trips, a new phone or camera, gear for a sport. Add past years too, and you&apos;ll see how this year compares.</p>
          </div>
          <HobbyForm currency={cur} categories={categories} />
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label={cmp.running ? `Spent so far in ${year}` : `Spent in ${year}`} value={money(cmp.total, cur)}>
              <Change value={change(cmp.total, cmp.prevTotal)} against={`vs all of ${cmp.prev}`} />
            </Tile>
            {cmp.running ? (
              <Tile label={`${cmp.prev} by ${dayMonth}`} value={money(cmp.prevSoFar ?? 0, cur)}>
                <Change value={change(cmp.total, fair)} against="this year vs the same part of last year" />
              </Tile>
            ) : (
              <Tile label={`Spent in ${cmp.prev}`} value={money(cmp.prevTotal, cur)}>
                <span className="text-ink-3">{inPrev.length} {inPrev.length === 1 ? "thing" : "things"}</span>
              </Tile>
            )}
            <Tile label={cmp.averageYears === 1 ? "The year before" : `Average of ${cmp.averageYears || "the"} years before`} value={cmp.average === null ? "—" : money(cmp.average, cur)}>
              {cmp.average === null
                ? <span className="text-ink-3">Nothing recorded before {year}</span>
                : <Change value={change(cmp.total, cmp.average)} against="vs the average" />}
            </Tile>
          </div>

          <PeriodBars title="Year by year" hint="Each year by hobby. Tap a year to open it."
            bars={bars} selected={year} currency={cur} average={cmp.average} averageLabel="Average before" />

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <HobbyForm currency={cur} categories={categories} />
              <CategoryBars title={`Where it went in ${year}`} rows={rows} currency={cur} against={`vs ${cmp.prev}`} />
            </div>

            <section className="card p-5 sm:p-6">
              <h2 className="text-lg">Everything in {year}</h2>
              {inYear.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-3">Nothing recorded for {year} yet.</p>
              ) : (
                <ul className="mt-2 max-h-[36rem] divide-y divide-line overflow-y-auto">
                  {inYear.map((s) => (
                    <li key={s.id} className="py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: color(s.category) }} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{s.name ?? s.category}</span>
                          <span className="num block text-xs text-ink-3">{day(s.date)} · {s.category}</span>
                        </span>
                        <span className="num font-semibold">{money(s.amount, cur)}</span>
                        <HobbyActions item={s} currency={cur} categories={categories} />
                      </div>
                      {s.note && <Note text={s.note} />}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {tableYears.length > 1 && tableCats.length > 0 && (
            <section className="card p-5 sm:p-6">
              <h2 className="text-lg">Each hobby, year by year</h2>
              <p className="text-xs text-ink-3">The last {tableYears.length} years up to {year}{cmp.running ? ` (${year} so far)` : ""}.</p>
              <div className="mt-3 overflow-x-auto">
                <table className="num w-full min-w-[28rem] text-sm">
                  <thead>
                    <tr className="text-right text-xs text-ink-3">
                      <th className="py-2 text-left font-semibold">Hobby</th>
                      {tableYears.map((y) => <th key={y} className={`py-2 pl-3 font-semibold ${y === year ? "text-ink" : ""}`}>{y}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {tableCats.map((c) => (
                      <tr key={c}>
                        <td className="py-2 pr-3 text-left">
                          <span className="flex items-center gap-2 font-semibold"><span className="size-2.5 shrink-0 rounded-full" style={{ background: color(c) }} />{c}</span>
                        </td>
                        {tableYears.map((y) => {
                          const v = cell(c, y);
                          return <td key={y} className={`py-2 pl-3 text-right ${y === year ? "font-bold" : ""} ${v === 0 ? "text-ink-3" : ""}`}>{v === 0 ? "–" : money(v, cur)}</td>;
                        })}
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="py-2 pr-3 text-left">Total</td>
                      {tableYears.map((y) => <td key={y} className="py-2 pl-3 text-right">{money(cell(null, y), cur)}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
