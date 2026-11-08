"use client";

import { useState } from "react";
import DatePicker from "./DatePicker";
import NumberInput from "./NumberInput";
import { money, plainNumber, unitPrice, units as fmtUnits } from "@/lib/format";
import type { Trade } from "@/lib/types";

/** A number as text without float noise or trailing zeros. */
const fmt = (n: number, digits: number) => (Number.isFinite(n) ? n.toFixed(digits).replace(/\.?0+$/, "") : "");
const parse = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/,/g, "")));

type Field = "units" | "price" | "total";

/**
 * The inputs of a trade, blank for a new one or filled from `trade` when editing.
 * Units, price per unit and total (units x price, before the fee) are tied together: fill in any two
 * and the third is worked out. Only units and price are sent; the total is for convenience.
 */
export default function TradeFields({ currency, trade, heldOn }: {
  currency: string;
  /** The trade being edited. One worked out from a total is edited as that total. */
  trade?: Trade;
  /** Units held and their cost at the end of a day, before any total on it. Given when recording a new trade, it adds the "Total" choice. */
  heldOn?: (date: string) => { quantity: number; cost: number };
}) {
  const [side, setSide] = useState<"buy" | "sell" | "total">(trade?.total ? "total" : (trade?.side ?? "buy"));
  const [date, setDate] = useState(trade?.date ?? "");
  const [held, setHeld] = useState({
    units: trade?.total ? plainNumber(trade.total.units) : "",
    cost: trade?.total ? fmt(trade.total.cost, 2) : "",
  });
  const choices = trade?.total ? (["total"] as const) : trade ? (["buy", "sell"] as const) : (["buy", "sell", "total"] as const);
  const [values, setValues] = useState<Record<Field, string>>({
    units: trade ? plainNumber(trade.quantity) : "",
    price: trade ? plainNumber(trade.price) : "",
    total: trade ? fmt(trade.quantity * trade.price, 2) : "",
  });
  // The two fields typed most recently stay as typed; the other one is calculated from them.
  const [recent, setRecent] = useState<[Field, Field]>(trade ? ["units", "price"] : ["units", "total"]);
  const derived = (["units", "price", "total"] as const).find((f) => !recent.includes(f))!;

  const onChange = (field: Field) => (v: string) => {
    const kept: [Field, Field] = field === recent[0] ? recent : [field, recent[0]];
    const next = { ...values, [field]: v };
    const out = (["units", "price", "total"] as const).find((f) => !kept.includes(f))!;
    const q = parse(next.units), p = parse(next.price), t = parse(next.total);
    if (out === "total") next.total = q > 0 && p >= 0 ? fmt(q * p, 2) : "";
    if (out === "price") next.price = q > 0 && t >= 0 ? fmt(t / q, 8) : "";
    if (out === "units") next.units = p > 0 && t >= 0 ? fmt(t / p, 8) : "";
    setRecent(kept);
    setValues(next);
  };
  const label = (field: Field, text: string) => (
    <span className="eyebrow">
      {text}
      {derived === field && values[field] !== "" && <span className="ml-1 normal-case text-ink-3">· calculated</span>}
    </span>
  );

  return (
    <>
      <fieldset className="flex gap-2">
        <legend className="sr-only">Buy, sell, or set the total</legend>
        {choices.map((s) => (
          <label key={s} className="cursor-pointer">
            <input type="radio" name="side" value={s} checked={side === s} onChange={() => setSide(s)} className="peer sr-only" />
            <span className="inline-block rounded-full bg-surface-2 px-5 py-2 text-sm font-semibold capitalize text-ink-3 peer-checked:bg-ink peer-checked:text-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky">
              {s}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="block space-y-1.5">
          <span className="eyebrow">Date</span>
          <DatePicker name="date" label="Date" defaultValue={trade?.date} onChange={setDate} />
        </div>
        {side === "total" ? (
          <>
            <label className="block space-y-1.5">
              <span className="eyebrow">Units held</span>
              <NumberInput name="units" required placeholder="0" value={held.units} onValueChange={(v) => setHeld({ ...held, units: v })} className="field" />
            </label>
            <label className="block space-y-1.5">
              <span className="eyebrow">Cost of units held ({currency})</span>
              <NumberInput name="cost" required placeholder="0" value={held.cost} onValueChange={(v) => setHeld({ ...held, cost: v })} className="field" />
            </label>
            <label className="block space-y-1.5">
              <span className="eyebrow">Current price per unit ({currency})</span>
              <NumberInput name="price" required placeholder="0" value={values.price} onValueChange={(v) => setValues({ ...values, price: v })} className="field" />
            </label>
            {heldOn && (
              <TotalPreview before={date ? heldOn(date) : { quantity: 0, cost: 0 }} units={parse(held.units)} cost={parse(held.cost)} price={parse(values.price)} currency={currency} />
            )}
            <p className="-mt-1 text-xs text-ink-3 sm:col-span-2">
              Enter what you hold at the end of this day, as your broker shows it. The change from before is recorded as a buy or a sale, and is worked out again whenever an earlier trade or total changes.
            </p>
          </>
        ) : (
          <>
            <label className="block space-y-1.5">
              {label("units", "Units")}
              <NumberInput name="quantity" required placeholder="0" value={values.units} onValueChange={onChange("units")} className="field" />
            </label>
            <label className="block space-y-1.5">
              {label("total", `Total (${currency})`)}
              <NumberInput placeholder="0" value={values.total} onValueChange={onChange("total")} className="field" />
            </label>
            <label className="block space-y-1.5">
              {label("price", `Price per unit (${currency})`)}
              <NumberInput name="price" required placeholder="0" value={values.price} onValueChange={onChange("price")} className="field" />
            </label>
            <p className="-mt-1 text-xs text-ink-3 sm:col-span-2">Fill in any two of units, total and price per unit, and the third is worked out. The total is before the fee.</p>
          </>
        )}
        {side !== "total" && (
          <label className="block space-y-1.5">
            <span className="eyebrow">Trading fee ({currency})</span>
            <NumberInput name="fee" placeholder="0" defaultValue={trade && trade.fee > 0 ? plainNumber(trade.fee) : ""} className="field" />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className="eyebrow">Note (optional)</span>
          <input name="note" defaultValue={trade?.note ?? undefined} className="field" />
        </label>
      </div>
    </>
  );
}

/** What a "Total" entry will record: the change in units and cost from what was held just before. */
function TotalPreview({ before, units, cost, price, currency }: {
  before: { quantity: number; cost: number };
  units: number;
  cost: number;
  price: number;
  currency: string;
}) {
  const ready = units >= 0 && cost >= 0;
  const diff = ready ? Math.round((units - before.quantity) * 1e8) / 1e8 : 0;
  const costChange = cost - before.cost;
  return (
    <div className="space-y-1 rounded-xl bg-surface-2 px-4 py-3 text-sm sm:col-span-2">
      <p className="text-ink-3">
        Before this you hold <span className="num font-semibold text-ink">{fmtUnits(before.quantity)}</span> units that cost{" "}
        <span className="num font-semibold text-ink">{money(before.cost, currency)}</span>.
      </p>
      {ready && price >= 0 && (
        <p className="text-ink-3">
          After this: worth <span className="num font-semibold text-ink">{money(units * price, currency)}</span> at the current price, against a cost of{" "}
          <span className="num font-semibold text-ink">{money(cost, currency)}</span>.
        </p>
      )}
      {!ready ? (
        <p className="text-ink-3">Enter the units you hold and what they cost to see the change.</p>
      ) : diff > 0 ? (
        <p className="font-semibold">
          Buy <span className="num">{fmtUnits(diff)}</span> units for <span className="num">{money(costChange, currency)}</span>
          {costChange > 0 && <span className="font-normal text-ink-3"> ({unitPrice(costChange / diff, currency)} a unit)</span>}.
        </p>
      ) : diff < 0 ? (
        <p className="font-semibold">
          Sell <span className="num">{fmtUnits(-diff)}</span> units
          {price >= 0 && Number.isFinite(price) && <> for <span className="num">{money(-diff * price, currency)}</span> at the current price</>}
          ; the cost goes from {money(before.cost, currency)} to {money(cost, currency)}.
        </p>
      ) : costChange !== 0 ? (
        <p className="font-semibold">No change in units; the cost goes from {money(before.cost, currency)} to {money(cost, currency)}.</p>
      ) : (
        <p className="font-semibold">No change. Only the price is recorded.</p>
      )}
    </div>
  );
}
