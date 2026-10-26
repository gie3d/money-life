"use client";

import { useState } from "react";
import DatePicker from "./DatePicker";
import NumberInput from "./NumberInput";
import { plainNumber } from "@/lib/format";
import type { Trade } from "@/lib/types";

/** A number as text without float noise or trailing zeros. */
const fmt = (n: number, digits: number) => (Number.isFinite(n) ? n.toFixed(digits).replace(/\.?0+$/, "") : "");
const parse = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/,/g, "")));

/**
 * The inputs of a trade, blank for a new one or filled from `trade` when editing.
 * Price per unit and Total (units x price, before the fee) are two ways to say the same thing:
 * type either and the other follows. Only the price is sent; the total is for convenience.
 */
export default function TradeFields({ currency, trade }: { currency: string; trade?: Trade }) {
  const [units, setUnits] = useState(trade ? plainNumber(trade.quantity) : "");
  const [price, setPrice] = useState(trade ? plainNumber(trade.price) : "");
  const [total, setTotal] = useState(trade ? fmt(trade.quantity * trade.price, 2) : "");
  // Whichever of price and total was typed last stays as typed when the units change.
  const [anchor, setAnchor] = useState<"price" | "total">(trade ? "price" : "total");

  const onUnits = (v: string) => {
    setUnits(v);
    const q = parse(v);
    if (!(q > 0)) return;
    if (anchor === "price" && parse(price) >= 0) setTotal(fmt(q * parse(price), 2));
    if (anchor === "total" && parse(total) >= 0) setPrice(fmt(parse(total) / q, 8));
  };
  const onPrice = (v: string) => {
    setPrice(v);
    setAnchor("price");
    const q = parse(units);
    setTotal(q > 0 && parse(v) >= 0 ? fmt(q * parse(v), 2) : "");
  };
  const onTotal = (v: string) => {
    setTotal(v);
    setAnchor("total");
    const q = parse(units);
    setPrice(q > 0 && parse(v) >= 0 ? fmt(parse(v) / q, 8) : "");
  };

  return (
    <>
      <fieldset className="flex gap-2">
        <legend className="sr-only">Buy or sell</legend>
        {(["buy", "sell"] as const).map((side) => (
          <label key={side} className="cursor-pointer">
            <input type="radio" name="side" value={side} defaultChecked={side === (trade?.side ?? "buy")} className="peer sr-only" />
            <span className="inline-block rounded-full bg-surface-2 px-5 py-2 text-sm font-semibold capitalize text-ink-3 peer-checked:bg-ink peer-checked:text-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky">
              {side}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="block space-y-1.5">
          <span className="eyebrow">Date</span>
          <DatePicker name="date" label="Date" defaultValue={trade?.date} />
        </div>
        <label className="block space-y-1.5">
          <span className="eyebrow">Units</span>
          <NumberInput name="quantity" required placeholder="0" value={units} onValueChange={onUnits} className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">Total ({currency})</span>
          <NumberInput placeholder="0" value={total} onValueChange={onTotal} className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">Price per unit ({currency})</span>
          <NumberInput name="price" required placeholder="0" value={price} onValueChange={onPrice} className="field" />
        </label>
        <p className="-mt-1 text-xs text-ink-3 sm:col-span-2">Fill in the total or the price per unit, and the other is worked out from the units. The total is before the fee.</p>
        <label className="block space-y-1.5">
          <span className="eyebrow">Trading fee ({currency})</span>
          <NumberInput name="fee" placeholder="0" defaultValue={trade && trade.fee > 0 ? plainNumber(trade.fee) : ""} className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">Note (optional)</span>
          <input name="note" defaultValue={trade?.note ?? undefined} className="field" />
        </label>
      </div>
    </>
  );
}
