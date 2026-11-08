"use client";

import { useState } from "react";
import DatePicker from "./DatePicker";
import NumberInput from "./NumberInput";
import { BILL_GROUPS, EVERY } from "@/lib/bills";
import { plainNumber } from "@/lib/format";
import { groupBy } from "@/lib/group";
import type { Bill } from "@/lib/types";

export type PayFrom = { id: number; name: string; categoryId: number; category: string };

/** The inputs of a bill, blank for a new one or filled from `bill` when editing. */
export default function BillFields({ currency, bill, groups, accounts }: { currency: string; bill?: Bill; groups: string[]; accounts: PayFrom[] }) {
  const [ends, setEnds] = useState(bill?.endDate != null);
  const suggestions = [...new Set([...groups, ...BILL_GROUPS])];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1.5">
        <span className="eyebrow">Name</span>
        <input name="name" required defaultValue={bill?.name} placeholder="e.g. Home internet" className="field" />
      </label>
      <label className="block space-y-1.5">
        <span className="eyebrow">Group</span>
        <input name="group" list="bill-groups" defaultValue={bill?.group ?? ""} placeholder="e.g. Utilities" className="field" />
        <datalist id="bill-groups">{suggestions.map((g) => <option key={g} value={g} />)}</datalist>
      </label>
      <label className="block space-y-1.5">
        <span className="eyebrow">Amount each time ({currency})</span>
        <NumberInput name="amount" required placeholder="0" defaultValue={bill ? plainNumber(bill.amount) : ""} className="field" />
      </label>
      <label className="block space-y-1.5">
        <span className="eyebrow">How often</span>
        <select name="every" defaultValue={String(bill?.everyMonths ?? 1)} className="field">
          {EVERY.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
      </label>
      <div className="block space-y-1.5">
        <span className="eyebrow">A payment date</span>
        <DatePicker name="first_due" label="A payment date" defaultValue={bill?.firstDue} />
        <p className="text-xs text-ink-3">Any date it was or will be paid; the others follow from it.</p>
      </div>
      <div className="block space-y-1.5">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={ends} onChange={(e) => setEnds(e.target.checked)} className="size-4 accent-[var(--brand)]" />
          <span className="eyebrow">Ends on a date</span>
        </label>
        {ends ? <DatePicker name="end_date" label="End date" defaultValue={bill?.endDate ?? undefined} /> : <p className="text-xs text-ink-3">Keeps going until you change it, like rent or a subscription.</p>}
      </div>
      <label className="block space-y-1.5">
        <span className="eyebrow">Paid from (optional)</span>
        <select name="account" defaultValue={bill?.accountId != null ? String(bill.accountId) : ""} className="field">
          <option value="">Not set</option>
          {groupBy(accounts, (a) => a.categoryId).map(({ key, items }) => (
            <optgroup key={key} label={items[0].category}>
              {items.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="eyebrow">Note (optional)</span>
        <input name="note" defaultValue={bill?.note ?? undefined} placeholder="e.g. contract no., promo until March" className="field" />
      </label>
    </div>
  );
}
