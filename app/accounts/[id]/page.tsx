import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmDelete from "@/components/ConfirmDelete";
import DeleteTradeButton from "@/components/DeleteTradeButton";
import EditPriceButton from "@/components/EditPriceButton";
import EditTradeButton from "@/components/EditTradeButton";
import EntryForm from "@/components/EntryForm";
import ProfitChart from "@/components/ProfitChart";
import PriceForm from "@/components/PriceForm";
import TradeForm from "@/components/TradeForm";
import { deleteAccount, deleteEntry, deletePrice, setArchived } from "@/app/actions/money";
import { getAccount, listEntries, listPrices, listTrades } from "@/lib/data";
import { day, money, pct, signedMoney, tone, unitPrice, units } from "@/lib/format";
import { priceHistory, tradeCash } from "@/lib/investment";
import NetWorthChart from "@/components/NetWorthChart";
import { extendTo, netWorthSeries } from "@/lib/performance";
import { accountEntries, holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { isInvestment, labelOf, LIQUIDITY, TYPES } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/accounts/[id]">) {
  const user = await requireUser();
  const account = await getAccount(user.id, Number((await params).id) || 0);
  return { title: account?.name ?? "Asset" };
}

export default async function AccountPage({ params }: PageProps<"/accounts/[id]">) {
  const user = await requireUser();
  const id = Number((await params).id);
  const account = Number.isInteger(id) ? await getAccount(user.id, id) : null;
  if (!account) notFound();

  const cur = user.currency;
  const investment = isInvestment(account);
  const [entries, trades, prices] = await Promise.all([
    investment ? [] : listEntries(user.id, account.id),
    investment ? listTrades(user.id, account.id) : [],
    investment ? listPrices(user.id, account.id) : [],
  ]);
  const h = holdings([account], entries, trades, prices)[0];
  const history = priceHistory(trades, prices);
  const series = extendTo(netWorthSeries([accountEntries(account, entries, trades, prices)], null, "9999-12-31"), new Date().toISOString().slice(0, 10));

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Assets", href: "/accounts" }, { label: account.name }]} />
      <div>
        <p className="eyebrow">{account.categoryName} · {labelOf(TYPES, account.type)} · {labelOf(LIQUIDITY, account.liquidity)}</p>
        <h1 className="text-3xl">{account.name}</h1>
      </div>

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
          <TradeForm accountId={account.id} currency={cur} />
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
          {[...trades].reverse().map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <span className={`w-12 text-xs font-bold uppercase ${t.side === "buy" ? "text-go-text" : "text-miss-text"}`}>{t.side}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{day(t.date)}</p>
                {t.note && <p className="truncate text-xs text-ink-3">{t.note}</p>}
              </div>
              <div className="text-right">
                <p className="num font-semibold">{units(t.quantity)} × {unitPrice(t.price, cur)}</p>
                <p className="num text-xs text-ink-3">{money(tradeCash(t), cur)}{t.fee > 0 && ` incl. ${money(t.fee, cur)} fee`}</p>
              </div>
              <EditTradeButton trade={t} currency={cur} label={`Edit ${t.side} on ${day(t.date)}`} />
              <DeleteTradeButton accountId={account.id} tradeId={t.id} label={`Delete ${t.side} on ${day(t.date)}`} />
            </div>
          ))}
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
