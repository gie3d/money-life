"use client";

import { useActionState, useCallback, useState, type ReactNode } from "react";
import { replay } from "@/lib/investment";
import type { Trade } from "@/lib/types";
import { addTrade } from "@/app/actions/money";
import TradeFields, { type Side } from "./TradeFields";
import Saved from "./Saved";
import type { FormState } from "@/app/actions/auth";

type Target = { id: number; name: string; archived: boolean; categoryId: number; category: string };

const TITLES: Record<Side, string> = { buy: "Record a buy", sell: "Record a sale", total: "Record what you hold", transfer: "Move units to another asset" };

export default function TradeForm({ accountId, currency, trades, transferTargets, initialSide, only, title, after }: {
  accountId: number;
  currency: string;
  trades: Trade[];
  transferTargets: Target[];
  /** The choice the form starts on, and the only ones it offers (all of them when not given). */
  initialSide?: Side;
  only?: readonly Side[];
  title?: string;
  /** Shown with the "Saved" note, such as links on to what comes next. */
  after?: ReactNode;
}) {
  // A new total replaces one already on its day, so that one is left out of what was held.
  const heldOn = useCallback(
    (date: string) => replay(trades.filter((t) => t.date < date || (t.date === date && !t.total))),
    [trades],
  );
  // The fields hold their own state, so a saved trade is cleared by starting them afresh.
  const [fresh, setFresh] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await addTrade(accountId, prev, form);
    if (!result?.error) setFresh((n) => n + 1);
    return result;
  }, undefined);
  const heading = title ?? (only?.length === 1 ? TITLES[only[0]] : "Record a trade");

  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <h2 className="text-lg">{heading}</h2>
      {fresh > 0 && !pending && !state?.error && <Saved key={fresh}>{after}</Saved>}
      <TradeFields key={fresh} currency={currency} heldOn={heldOn} transferTargets={transferTargets} initialSide={initialSide} only={only} />
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
