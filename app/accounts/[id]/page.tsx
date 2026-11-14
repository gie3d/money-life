import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmDelete from "@/components/ConfirmDelete";
import DeleteTradeButton from "@/components/DeleteTradeButton";
import EditAccountButton from "@/components/EditAccountButton";
import EditPriceButton from "@/components/EditPriceButton";
import EditTradeButton from "@/components/EditTradeButton";
import EntryForm from "@/components/EntryForm";
import { Pager, PeriodFilter } from "@/components/ListControls";
import Markdown from "@/components/Markdown";
import NotesEditor from "@/components/NotesEditor";
import ProfitChart from "@/components/ProfitChart";
import PriceForm from "@/components/PriceForm";
import TradeForm from "@/components/TradeForm";
import { deleteAccount, deleteEntry, deletePrice, setArchived, updateNotes } from "@/app/actions/money";
import { sortByCategory } from "@/lib/group";
import { paginate } from "@/lib/paging";
import { getAccount, listAccounts, listCategories, listEntries, listPrices, listTrades } from "@/lib/data";
import { day, money, pct, signedMoney, tone, unitPrice, units } from "@/lib/format";
import { priceHistory, tradeCash } from "@/lib/investment";
import NetWorthChart from "@/components/NetWorthChart";
import { chartYears, extendTo, netWorthSeries, periodStart, PERIODS, type Period } from "@/lib/performance";
import { accountEntries, holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { isInvestment, labelOf, LIQUIDITY, TYPES } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/accounts/[id]">) {
  const user = await requireUser();
  const account = await getAccount(user.id, Number((await params).id) || 0);
  return { title: account?.name ?? "Asset" };
}

export default async function AccountPage({ params, searchParams }: PageProps<"/accounts/[id]">) {
  const user = await requireUser();
  const id = Number((await params).id);
  const account = Number.isInteger(id) ? await getAccount(user.id, id) : null;
  if (!account) notFound();

  const cur = user.currency;
  const investment = isInvestment(account);
  // A BTC wallet in BTC Standard: what matters is how much BTC it holds, not a value, cost or profit.
  const wallet = user.btcStandard && investment && account.categoryName.trim().toLowerCase() === "btc";
  const [entries, trades, prices, categories, allAccounts] = await Promise.all([
    investment ? [] : listEntries(user.id, account.id),
    investment ? listTrades(user.id, account.id) : [],
    investment ? listPrices(user.id, account.id) : [],
    listCategories(user.id),
    listAccounts(user.id, true),
  ]);
  // Other investments, to send units to (archived ones only to name past transfers).
  const transferTargets = sortByCategory(allAccounts.filter((a) => a.id !== account.id && isInvestment(a)), (a) => a.categoryId, categories)
    .map((a) => ({ id: a.id, name: a.name, archived: a.archived, categoryId: a.categoryId, category: a.categoryName }));
  const nameOf = (id: number) => allAccounts.find((a) => a.id === id)?.name ?? "a deleted asset";
  const h = holdings([account], entries, trades, prices)[0];
  const history = priceHistory(trades, prices);
  const dated = [accountEntries(account, entries, trades, prices)];
  const today = new Date().toISOString().slice(0, 10);

  // What the charts show: a range ending today (all of it by default), or one calendar year.
  const sp = await searchParams;
  const firstDate = dated[0][0]?.date ?? today;
  const years = chartYears(firstDate, today);
  const year = years.find((y) => String(y) === sp.year);
  const period = year ? null : ((PERIODS.find((p) => p.id === sp.period)?.id ?? "ALL") as Period);
  const from = year ? `${year}-01-01` : periodStart(period!, today);
  const to = year && `${year}-12-31` < today ? `${year}-12-31` : today;
  // Never reach back past the first record: a "1Y" view of a 2-month-old asset is 2 months.
  // The long lists: newest first, a page at a time, each limited to a period of its own.
  const tradePage = paginate([...trades].reverse(), sp, "trades", (t) => t.date);
  const pricePage = paginate(history, sp, "prices", (p) => p.date);
  const entryPage = paginate([...entries].reverse(), sp, "history", (e) => e.date);
  const series = extendTo(netWorthSeries(dated, from && from > firstDate ? from : null, to), to);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Assets", href: "/accounts" }, { label: account.name }]} />
      <div>
        <p className="eyebrow">{account.categoryName} · {labelOf(TYPES, account.type)} · {labelOf(LIQUIDITY, account.liquidity)}</p>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl">{account.name}</h1>
          <EditAccountButton account={account} categories={categories} locked={entries.length + trades.length + prices.length > 0} />
        </div>
      </div>

      {account.notes ? (
        <section className="card p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-lg">Notes</h2>
            <NotesEditor notes={account.notes} save={updateNotes.bind(null, account.id)} placeholder="Where it's held, account numbers, why you bought it…" />
          </div>
          <Markdown>{account.notes}</Markdown>
        </section>
      ) : (
        <div className="flex items-center gap-3 text-sm text-ink-3">
          <NotesEditor notes={null} save={updateNotes.bind(null, account.id)} placeholder="Where it's held, account numbers, why you bought it…" />
          <span>Keep details about this asset here: where it&apos;s held, account numbers, why you bought it.</span>
        </div>
      )}

      {h && !investment && (
        <section className="card p-5 sm:p-6">
          <Figure label={`Balance · ${day(h.lastDate)}`} value={money(h.value, cur)} big />
        </section>
      )}

      {h && wallet && (
        <section className="card p-5 sm:p-6">
          <Figure label={`BTC held · ${day(h.lastDate)}`} value={`${units(h.quantity ?? 0)} BTC`} big />
        </section>
      )}

      {h && investment && !wallet && (
        <section className="card p-5 sm:p-6">
          {/* The two figures that matter first; the rest are a tap away. */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Figure label={`Worth · ${day(h.lastDate)}`} value={money(h.value, cur)} big />
            <Figure label="Profit / loss" value={signedMoney(h.pl ?? 0, cur)} hint={`${pct(h.plPct)} on what you paid`} cls={tone(h.pl ?? 0)} big />
            <Figure label="Units held" value={units(h.quantity ?? 0)} />
          </div>
          <details className="mt-4 border-t border-line pt-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink-2">More details</summary>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Figure label="Price now" value={h.price === null ? "—" : unitPrice(h.price, cur)} hint={day(h.lastDate)} />
              <Figure label="Average price paid" value={h.quantity ? unitPrice(h.cost / h.quantity, cur) : "—"} hint="fees included" />
              <Figure label="What you paid in total" value={money(h.cost, cur)} hint="for the units you still hold" />
              <Figure label="Profit from sales" value={signedMoney(h.realized, cur)} hint="already locked in" cls={tone(h.realized)} />
            </div>
          </details>
        </section>
      )}

      {dated[0].length > 0 && (
        <nav className="flex items-center gap-1.5 overflow-x-auto" aria-label="Chart range">
          {PERIODS.map((p) => (
            <Link key={p.id} href={`?period=${p.id}`} scroll={false} aria-current={p.id === period ? "page" : undefined}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${p.id === period ? "bg-ink text-surface" : "bg-surface text-ink-3"}`}>
              {p.label}
            </Link>
          ))}
          <span className="mx-1.5 h-5 w-px shrink-0 bg-line" aria-hidden />
          {years.map((y) => (
            <Link key={y} href={`?year=${y}`} scroll={false} aria-current={y === year ? "page" : undefined}
              className={`num shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${y === year ? "bg-ink text-surface" : "bg-surface text-ink-3"}`}>
              {y}
            </Link>
          ))}
        </nav>
      )}

      {series.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="mb-3 text-lg">{wallet ? "BTC held over time" : investment ? "Value and cost" : "Balance over time"}</h2>
          <NetWorthChart data={series} currency={cur} title={account.name} showCost={investment && !wallet} />
          {investment && !wallet && <p className="mt-2 text-xs text-ink-3">The dashed line is what the units you hold cost, fees included.</p>}
        </section>
      )}

      {investment && !wallet && series.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="mb-3 text-lg">Profit over time</h2>
          <ProfitChart data={series} currency={cur} title={`${account.name} profit`} />
          <p className="mt-2 text-xs text-ink-3">Profit is the current value minus what the units you hold cost, fees included. It is the gap between the two lines above.</p>
        </section>
      )}

      {investment ? (
        <div className="grid gap-5 md:grid-cols-2">
          <TradeForm accountId={account.id} currency={cur} trades={trades} transferTargets={transferTargets} />
          <PriceForm accountId={account.id} currency={user.baseCurrency} />
        </div>
      ) : (
        <EntryForm accountId={account.id} currency={cur} entries={entries.map((e) => ({ date: e.date, value: e.value }))} />
      )}

      {!investment && entries.length > 0 && (
        <>
        <PeriodFilter from={entryPage.from} to={entryPage.to} sp={sp} id="history" />
        <section id="history" className="card divide-y divide-line scroll-mt-4">
          <div>
            <h2 className="p-4 text-lg sm:px-6">History</h2>
          </div>
          {entryPage.rows.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{day(e.date)}</p>
                {e.note && <p className="truncate text-xs text-ink-3">{e.note}</p>}
              </div>
              <div className="text-right">
                <p className="num font-semibold">{money(e.value, cur)}</p>
                {e.contribution !== 0 && (
                  <p className={`num text-xs ${e.contribution > 0 ? "text-go-text" : "text-miss-text"}`}>
                    {e.contribution > 0 ? "Deposited" : "Withdrew"} {money(Math.abs(e.contribution), cur)}
                  </p>
                )}
              </div>
              <ConfirmDelete
                action={deleteEntry.bind(null, e.id)}
                title="Delete this balance?"
                message={`The balance of ${money(e.value, cur)} on ${day(e.date)} will be removed.`}
                triggerLabel={`Delete balance from ${day(e.date)}`}
                triggerClassName="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
              >
                ×
              </ConfirmDelete>
            </div>
          ))}
          <Pager paged={entryPage} sp={sp} name="history" id="history" />
        </section>
        </>
      )}

      {investment && (trades.length > 0 || history.length > 0) && (
        <PeriodFilter from={tradePage.from} to={tradePage.to} sp={sp} id="trades" />
      )}

      <div className="grid items-start gap-5 empty:hidden lg:grid-cols-2">
      {investment && trades.length > 0 && (
        <section id="trades" className="card divide-y divide-line scroll-mt-4">
          <h2 className="p-4 text-lg sm:px-6">Trades</h2>
          {tradePage.rows.map((t) => {
            const kind = t.transfer ? (t.transfer.direction === "in" ? "in" : "out") : t.total ? "total" : t.side;
            return (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3 sm:px-6">
                <span className={`w-12 shrink-0 pt-1 text-xs font-bold uppercase ${t.total || t.transfer ? "text-ink-2" : t.side === "buy" ? "text-go-text" : "text-miss-text"}`}>
                  {kind}
                  {t.transfer && <span className="block text-[10px] font-semibold normal-case text-ink-3">transfer</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-nowrap font-semibold">{day(t.date)}</p>
                  {t.note && <p className="truncate text-xs text-ink-3">{t.note}</p>}
                  {t.transfer ? (
                    <div className="mt-1 min-w-0">
                      <p className="num font-semibold">
                        {units(t.transfer.units)} units {t.transfer.direction === "in" ? "← " : "→ "}
                        <Link href={`/accounts/${t.transfer.otherAccountId}`} className="underline decoration-line underline-offset-2">{nameOf(t.transfer.otherAccountId)}</Link>
                      </p>
                      <p className="num text-xs text-ink-3">
                        {!wallet && `${money(t.transfer.cost, cur)} of cost moved`}
                        {t.transfer.fee > 0 && t.transfer.direction === "out" && ` · fee ${units(t.transfer.fee)} units`}
                      </p>
                    </div>
                  ) : t.total ? (
                    <div className="mt-1">
                      <p className="num font-semibold">{units(t.total.units)} units{!wallet && ` · cost ${money(t.total.cost, cur)}`}</p>
                      <p className="num text-xs text-ink-3">
                        <span className={t.quantity === 0 ? "" : t.side === "buy" ? "text-go-text" : "text-miss-text"}>
                          {t.quantity === 0 ? "No change in units" : `${t.side === "buy" ? "Bought" : "Sold"} ${units(t.quantity)}`}
                        </span>
                        {!wallet && <>{" · price "}{unitPrice(t.price, cur)}</>}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <p className="num font-semibold">{wallet ? `${units(t.quantity)} units` : <>{units(t.quantity)} × {unitPrice(t.price, cur)}</>}</p>
                      {(!wallet || t.fee > 0) && <p className="num text-xs text-ink-3">{!wallet && money(tradeCash(t), cur)}{t.fee > 0 && `${wallet ? "" : " incl. "}${money(t.fee, cur)} fee`}</p>}
                    </div>
                  )}
                </div>
                <EditTradeButton trade={t} currency={cur} label={`Edit ${t.transfer ? "transfer" : kind} on ${day(t.date)}`} transferTargets={transferTargets} />
                <DeleteTradeButton accountId={account.id} tradeId={t.id} totalId={t.total?.id} transferId={t.transfer?.id} label={`Delete ${t.transfer ? "transfer" : kind} on ${day(t.date)}`} />
              </div>
            );
          })}
          <Pager paged={tradePage} sp={sp} name="trades" id="trades" />
        </section>
      )}

      {investment && !wallet && history.length > 0 && (
        <section id="prices" className="card divide-y divide-line scroll-mt-4">
          <h2 className="p-4 text-lg sm:px-6">Price history</h2>
          {pricePage.rows.map((p) => (
            <div key={p.date} className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <div className="flex-1">
                <p className="font-semibold">{day(p.date)}</p>
                <p className="text-xs text-ink-3">{p.source === "trade" ? "From a trade" : p.source === "transfer" ? "From a transfer" : "Entered by hand"}</p>
              </div>
              <p className="num font-semibold">{unitPrice(p.price, cur)}</p>
              <EditPriceButton accountId={account.id} row={p} currency={cur} />
              {p.id !== undefined ? (
                <ConfirmDelete
                  action={deletePrice.bind(null, p.id)}
                  title="Delete this price?"
                  message={`The price of ${unitPrice(p.price, cur)} on ${day(p.date)} will be removed.`}
                  triggerLabel={`Delete price from ${day(p.date)}`}
                  triggerClassName="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
                >
                  ×
                </ConfirmDelete>
              ) : (
                <span className="size-8" title="Comes from a trade: edit or delete the trade instead" />
              )}
            </div>
          ))}
          <Pager paged={pricePage} sp={sp} name="prices" id="prices" />
        </section>
      )}
      </div>

      <div className="flex gap-2">
        <form action={setArchived.bind(null, account.id, !account.archived)}>
          <button className="btn btn-quiet">{account.archived ? "Restore" : "Archive"}</button>
        </form>
        <ConfirmDelete
          action={deleteAccount.bind(null, account.id)}
          title={`Delete ${account.name}?`}
          message="The asset and everything recorded for it will be deleted for good. Archive it instead to keep the history but hide it from the dashboard."
          confirmLabel="Delete asset"
          triggerClassName="btn btn-quiet text-miss-text"
        >
          Delete asset
        </ConfirmDelete>
      </div>
    </div>
  );
}

function Figure({ label, value, hint, cls = "", big = false }: { label: string; value: string; hint?: string; cls?: string; big?: boolean }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={`num break-words ${big ? "text-2xl font-extrabold" : "text-xl font-bold"} ${cls}`}>{value}</p>
      {hint && <p className={`num text-xs ${cls || "text-ink-3"}`}>{hint}</p>}
    </div>
  );
}
