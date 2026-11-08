import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmDelete from "@/components/ConfirmDelete";
import DeleteTradeButton from "@/components/DeleteTradeButton";
import EditAccountButton from "@/components/EditAccountButton";
import EditPriceButton from "@/components/EditPriceButton";
import EditTradeButton from "@/components/EditTradeButton";
import EntryForm from "@/components/EntryForm";
import Markdown from "@/components/Markdown";
import NotesEditor from "@/components/NotesEditor";
import ProfitChart from "@/components/ProfitChart";
import PriceForm from "@/components/PriceForm";
import TradeForm from "@/components/TradeForm";
import { deleteAccount, deleteEntry, deletePrice, setArchived } from "@/app/actions/money";
import { getAccount, listCategories, listEntries, listPrices, listTrades } from "@/lib/data";
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
  const [entries, trades, prices, categories] = await Promise.all([
    investment ? [] : listEntries(user.id, account.id),
    investment ? listTrades(user.id, account.id) : [],
    investment ? listPrices(user.id, account.id) : [],
    listCategories(user.id),
  ]);
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
  const series = extendTo(netWorthSeries(dated, from && from > firstDate ? from : null, to), to);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Assets", href: "/accounts" }, { label: account.name }]} />
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
            <NotesEditor accountId={account.id} notes={account.notes} />
          </div>
          <Markdown>{account.notes}</Markdown>
        </section>
      ) : (
        <div className="flex items-center gap-3 text-sm text-ink-3">
          <NotesEditor accountId={account.id} notes={null} />
          <span>Keep details about this asset here: where it&apos;s held, account numbers, why you bought it.</span>
        </div>
      )}

      {h && !investment && (
        <section className="card p-5 sm:p-6">
          <Figure label={`Balance · ${day(h.lastDate)}`} value={money(h.value, cur)} />
        </section>
      )}

      {h && investment && (
        <section className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 sm:p-6">
          <Figure label="Current value" value={money(h.value, cur)} />
          <Figure label="Units held" value={units(h.quantity ?? 0)} />
          <Figure label="Price now" value={h.price === null ? "—" : unitPrice(h.price, cur)} hint={day(h.lastDate)} />
          <Figure label="Average cost (with fees)" value={h.quantity ? unitPrice(h.cost / h.quantity, cur) : "—"} />
          <Figure label="Cost of units held" value={money(h.cost, cur)} />
          <Figure label="Profit / loss" value={signedMoney(h.pl ?? 0, cur)} hint={pct(h.plPct)} cls={tone(h.pl ?? 0)} />
          <Figure label="Realized from sales" value={signedMoney(h.realized, cur)} cls={tone(h.realized)} />
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
          <h2 className="mb-3 text-lg">{investment ? "Value and cost" : "Balance over time"}</h2>
          <NetWorthChart data={series} currency={cur} title={account.name} showCost={investment} />
          {investment && <p className="mt-2 text-xs text-ink-3">The dashed line is what the units you hold cost, fees included.</p>}
        </section>
      )}

      {investment && series.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="mb-3 text-lg">Profit over time</h2>
          <ProfitChart data={series} currency={cur} title={`${account.name} profit`} />
          <p className="mt-2 text-xs text-ink-3">Profit is the current value minus what the units you hold cost, fees included. It is the gap between the two lines above.</p>
        </section>
      )}

      {investment ? (
        <div className="grid gap-5 md:grid-cols-2">
          <TradeForm accountId={account.id} currency={cur} trades={trades} />
          <PriceForm accountId={account.id} currency={cur} />
        </div>
      ) : (
        <EntryForm accountId={account.id} currency={cur} />
      )}

      {!investment && entries.length > 0 && (
        <section className="card divide-y divide-line">
          <h2 className="p-4 text-lg sm:px-6">History</h2>
          {[...entries].reverse().map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{day(e.date)}</p>
                {e.note && <p className="truncate text-xs text-ink-3">{e.note}</p>}
              </div>
              <p className="num font-semibold">{money(e.value, cur)}</p>
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
        </section>
      )}

      {investment && trades.length > 0 && (
        <section className="card divide-y divide-line">
          <h2 className="p-4 text-lg sm:px-6">Trades</h2>
          {[...trades].reverse().map((t) => {
            const kind = t.total ? "total" : t.side;
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <span className={`w-12 text-xs font-bold uppercase ${t.total ? "text-ink-2" : t.side === "buy" ? "text-go-text" : "text-miss-text"}`}>{kind}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{day(t.date)}</p>
                  {t.note && <p className="truncate text-xs text-ink-3">{t.note}</p>}
                </div>
                {t.total ? (
                  <div className="text-right">
                    <p className="num font-semibold">{units(t.total.units)} units · cost {money(t.total.cost, cur)}</p>
                    <p className="num text-xs text-ink-3">
                      <span className={t.quantity === 0 ? "" : t.side === "buy" ? "text-go-text" : "text-miss-text"}>
                        {t.quantity === 0 ? "No change in units" : `${t.side === "buy" ? "Bought" : "Sold"} ${units(t.quantity)}`}
                      </span>
                      {" · price "}{unitPrice(t.price, cur)}
                    </p>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="num font-semibold">{units(t.quantity)} × {unitPrice(t.price, cur)}</p>
                    <p className="num text-xs text-ink-3">{money(tradeCash(t), cur)}{t.fee > 0 && ` incl. ${money(t.fee, cur)} fee`}</p>
                  </div>
                )}
                <EditTradeButton trade={t} currency={cur} label={`Edit ${kind} on ${day(t.date)}`} />
                <DeleteTradeButton accountId={account.id} tradeId={t.id} totalId={t.total?.id} label={`Delete ${kind} on ${day(t.date)}`} />
              </div>
            );
          })}
        </section>
      )}

      {investment && history.length > 0 && (
        <section className="card divide-y divide-line">
          <h2 className="p-4 text-lg sm:px-6">Price history</h2>
          {history.map((p) => (
            <div key={p.date} className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <div className="flex-1">
                <p className="font-semibold">{day(p.date)}</p>
                <p className="text-xs text-ink-3">{p.source === "trade" ? "From a trade" : "Entered by hand"}</p>
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
        </section>
      )}

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

function Figure({ label, value, hint, cls = "" }: { label: string; value: string; hint?: string; cls?: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={`num text-xl font-bold ${cls}`}>{value}</p>
      {hint && <p className={`num text-xs ${cls || "text-ink-3"}`}>{hint}</p>}
    </div>
  );
}
