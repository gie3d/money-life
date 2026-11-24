"use client";

import { useActionState, useState, useTransition } from "react";
import EditDialog from "./EditDialog";
import { fetchLatestPrice, testPriceSource, updatePriceSource } from "@/app/actions/money";
import type { FormState } from "@/app/actions/auth";
import type { Fetched } from "@/lib/price-fetch";

/**
 * Where the Update page looks up this investment's latest price: a link, and optionally where the number is in it.
 * "Test" fetches it now, so the user sees what price it gives, and what the page answered, before saving.
 */
export default function PriceSourceEditor({ accountId, url, extract }: { accountId: number; url: string | null; extract: string | null }) {
  return (
    <EditDialog label="Edit price source" title="Price source" wide trigger={url ? undefined : "Add price source"}>
      {(close) => <SourceForm accountId={accountId} url={url ?? ""} extract={extract ?? ""} onDone={close} />}
    </EditDialog>
  );
}

/** A "Test" button for the saved source, on the asset page itself; the result opens below. */
export function PriceSourceTest({ accountId }: { accountId: number }) {
  const [result, setResult] = useState<Fetched | null>(null);
  const [testing, start] = useTransition();
  return (
    <>
      <button type="button" className="btn btn-quiet" disabled={testing}
        onClick={() => start(async () => setResult(await fetchLatestPrice(accountId, true)))}>
        {testing ? "Testing…" : "Test"}
      </button>
      {result && (
        <div className="w-full">
          <TestResult result={result} onClose={() => setResult(null)} />
        </div>
      )}
    </>
  );
}

/** The price a test found, or why it found none, with what the page answered to check the path or regex against. */
export function TestResult({ result, onClose }: { result: Fetched; onClose?: () => void }) {
  return (
    <div className="space-y-2">
      <div role="status" className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium ${"error" in result ? "bg-miss-soft text-miss-text" : "bg-go-soft text-go-text"}`}>
        <span>{"error" in result ? result.error : <>Found <span className="num font-bold">{result.price.toLocaleString(undefined, { maximumFractionDigits: 8 })}</span></>}</span>
        {onClose && <button type="button" onClick={onClose} aria-label="Close test result" className="text-xs underline">Close</button>}
      </div>
      {result.preview !== undefined && (
        <details className="rounded-xl border border-line">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-ink-3">Response from the link</summary>
          <pre className="max-h-72 overflow-auto border-t border-line px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-all">{result.preview || "(empty)"}</pre>
        </details>
      )}
    </div>
  );
}

function SourceForm({ accountId, url: url0, extract: extract0, onDone }: { accountId: number; url: string; extract: string; onDone: () => void }) {
  const [url, setUrl] = useState(url0);
  const [extract, setExtract] = useState(extract0);
  const [test, setTest] = useState<Fetched | null>(null);
  const [testing, startTest] = useTransition();
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await updatePriceSource(accountId, prev, form);
    if (!result?.error) onDone();
    return result;
  }, undefined);

  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg">Price source</h2>
      <p className="text-sm text-ink-3">
        A page or JSON API that shows the price of one unit, in your currency. On Update balances and prices, Fetch fills in what it finds for you to check before saving.
      </p>
      <label className="block space-y-1.5">
        <span className="eyebrow">Link</span>
        <input name="priceUrl" type="url" value={url} onChange={(e) => { setUrl(e.target.value); setTest(null); }}
          placeholder="https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=thb" className="field w-full" />
      </label>
      <label className="block space-y-1.5">
        <span className="eyebrow">Where the price is (optional)</span>
        <input name="priceExtract" value={extract} onChange={(e) => { setExtract(e.target.value); setTest(null); }}
          placeholder="bitcoin.thb   or   0.lowest_ask   or   /NAV[^0-9]*([\d,.]+)/" className="field w-full font-mono text-sm" />
        <span className="block text-xs text-ink-3">
          For JSON, a dot path like <code>data.0.price</code> (<code>0</code> is the first item of a list). For any page, a <code>/regex/</code> whose first group is the price.
          Leave empty to try the usual places.
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-quiet" disabled={testing || !url.trim()}
          onClick={() => startTest(async () => setTest(await testPriceSource(url, extract)))}>
          {testing ? "Testing…" : "Test link and path"}
        </button>
        <span className="text-xs text-ink-3">Fetches now and shows the price it finds. Nothing is saved.</span>
      </div>
      {test && <TestResult result={test} />}
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-quiet">Cancel</button>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
