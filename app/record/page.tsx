import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import EntryForm from "@/components/EntryForm";
import TradeForm from "@/components/TradeForm";
import { listAccounts, listCategories, listEntries, listPrices, listTrades } from "@/lib/data";
import { day, money, units } from "@/lib/format";
import { groupBy, sortByCategory } from "@/lib/group";
import { holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { isInvestment, type Account } from "@/lib/types";

export const metadata: Metadata = { title: "Record" };

/** What happened, each with the assets it applies to. */
const KINDS = {
  buy: { title: "I bought", hint: "Shares, funds, gold, crypto…", pick: "What did you buy?", form: "buy" },
  sell: { title: "I sold", hint: "Some or all of an investment", pick: "What did you sell?", form: "sell" },
  money: { title: "I put money in or took it out", hint: "A deposit or withdrawal on cash or savings", pick: "Which account?", form: "deposit" },
  move: { title: "I moved units between investments", hint: "From one wallet or broker to another", pick: "Move from which asset?", form: "transfer" },
} as const;
type Kind = keyof typeof KINDS;

export default async function RecordPage({ searchParams }: PageProps<"/record">) {
  const user = await requireUser();
  const sp = await searchParams;
  const cur = user.currency;
  const [accounts, categories, entries, trades, prices] = await Promise.all([
    listAccounts(user.id, true), listCategories(user.id), listEntries(user.id), listTrades(user.id), listPrices(user.id),
  ]);
  const active = sortByCategory(accounts.filter((a) => !a.archived), (a) => a.categoryId, categories);
  const held = holdings(active, entries, trades, prices);
  const heldOf = (id: number) => held.find((h) => h.account.id === id);
  const kind = (Object.keys(KINDS) as Kind[]).find((k) => k === sp.do);

  // Which assets each kind can be recorded on: a sale or a move needs units to take from.
  const eligible = (k: Kind): Account[] =>
    k === "money" ? active.filter((a) => !isInvestment(a))
      : k === "buy" ? active.filter(isInvestment)
        // A move needs another investment to send to.
        : k === "move" && active.filter(isInvestment).length < 2 ? []
          : active.filter((a) => isInvestment(a) && (heldOf(a.id)?.quantity ?? 0) > 0);

  if (active.length === 0) {
    return (
      <Shell>
        <div className="card p-8 text-center">
          <h1 className="text-2xl">Nothing to record on yet</h1>
          <p className="mx-auto mt-2 max-w-md text-ink-3">Set up your assets first. It takes a couple of minutes.</p>
          <Link href="/welcome" className="btn mt-6">Set up my assets</Link>
        </div>
      </Shell>
    );
  }

  // Step 1: what happened.
  if (!kind) {
    return (
      <Shell>
        <div>
          <h1 className="text-3xl">What happened?</h1>
          <p className="mt-1 text-sm text-ink-3">Pick one, and you&apos;ll be asked only for what it needs.</p>
        </div>
        <Link href="/update" className="block rounded-[24px] bg-gradient-to-br from-[var(--hero-a)] via-[var(--hero-b)] to-[var(--hero-c)] p-5 text-white sm:p-6">
          <span className="block text-xs font-semibold uppercase tracking-wider opacity-80">Most of the time</span>
          <span className="mt-1 block text-xl font-extrabold">I checked my balances and prices</span>
          <span className="mt-1 block text-sm opacity-90">Type today&apos;s numbers for all your assets on one page, and see the new total before saving.</span>
          <span className="mt-3 inline-block rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold">Update everything →</span>
        </Link>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(KINDS) as Kind[]).map((k) => {
            const n = eligible(k).length;
            return (
              <li key={k}>
                {n > 0 ? (
                  <Link href={`/record?do=${k}`} className="card flex h-full items-center gap-3 p-4 hover:bg-surface-2 sm:p-5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{KINDS[k].title}</span>
                      <span className="block text-sm text-ink-3">{KINDS[k].hint}</span>
                    </span>
                    <span className="text-brand" aria-hidden>→</span>
                  </Link>
                ) : (
                  <div className="card h-full p-4 opacity-60 sm:p-5">
                    <span className="block font-bold">{KINDS[k].title}</span>
                    <span className="block text-sm text-ink-3">
                      {k === "money" ? "Add a cash or savings asset first." : k === "buy" ? "Add an investment asset first."
                        : k === "move" && active.filter(isInvestment).length < 2 ? "You need two investments to move between." : "None of your investments hold units yet."}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-ink-3">
          Something new? <Link href="/accounts#new-asset" className="font-semibold text-brand">Add an asset</Link>
          {" "}· To correct what an investment holds, open it from <Link href="/accounts" className="font-semibold text-brand">Assets</Link>.
        </p>
      </Shell>
    );
  }

  const options = eligible(kind);
  const assetId = Number(sp.asset);
  const account = options.find((a) => a.id === assetId);

  // Step 2: on which asset. With only one, there is nothing to pick.
  if (!account) {
    if (sp.asset !== undefined) notFound();
    if (options.length === 1) redirect(`/record?do=${kind}&asset=${options[0].id}`);
    return (
      <Shell step={[{ label: KINDS[kind].title }]}>
        <h1 className="text-3xl">{KINDS[kind].pick}</h1>
        {options.length === 0 ? (
          <div className="card p-6 text-ink-3">Nothing to pick here yet. <Link href="/record" className="font-semibold text-brand">Back</Link></div>
        ) : (
          groupBy(options, (a) => a.categoryId).map(({ key, items }) => (
            <section key={key} className="card divide-y divide-line overflow-hidden">
              <h2 className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-3 sm:px-6">
                <span className="size-2.5 rounded-full" style={{ background: items[0].categoryColor }} />
                {items[0].categoryName}
              </h2>
              {items.map((a) => {
                const h = heldOf(a.id);
                return (
                  <Link key={a.id} href={`/record?do=${kind}&asset=${a.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2 sm:px-6">
                    <span className="min-w-0 flex-1 truncate font-semibold">{a.name}</span>
                    <span className="num text-right text-sm text-ink-3">
                      {h ? <>{money(h.value, cur)}{h.investment && h.quantity ? <span className="block text-xs">{units(h.quantity)} units</span> : null}</> : "Nothing yet"}
                    </span>
                    <span className="text-brand" aria-hidden>→</span>
                  </Link>
                );
              })}
            </section>
          ))
        )}
      </Shell>
    );
  }

  // Step 3: the form, on just that choice.
  const h = heldOf(account.id);
  const after = (
    <span className="font-medium">
      <Link href={`/accounts/${account.id}`} className="underline">See {account.name}</Link>
      {" · "}
      <Link href="/record" className="underline">Record something else</Link>
      {" · "}
      <Link href="/" className="underline">Home</Link>
    </span>
  );
  const crumbs = [{ label: KINDS[kind].title, href: options.length > 1 ? `/record?do=${kind}` : "/record" }, { label: account.name }];

  if (kind === "money") {
    const own = entries.filter((e) => e.accountId === account.id);
    return (
      <Shell step={crumbs}>
        <Heading account={account} summary={h ? `Balance ${money(h.value, cur)} · ${day(h.lastDate)}` : "No balance recorded yet"} />
        <EntryForm accountId={account.id} currency={cur} entries={own.map((e) => ({ date: e.date, value: e.value }))} initialMode="deposit" title="Money in or out" after={after} />
      </Shell>
    );
  }

  const own = trades.filter((t) => t.accountId === account.id);
  const transferTargets = sortByCategory(accounts.filter((a) => a.id !== account.id && isInvestment(a)), (a) => a.categoryId, categories)
    .map((a) => ({ id: a.id, name: a.name, archived: a.archived, categoryId: a.categoryId, category: a.categoryName }));
  const side = KINDS[kind].form as "buy" | "sell" | "transfer";
  return (
    <Shell step={crumbs}>
      <Heading account={account} summary={h ? `${units(h.quantity ?? 0)} units · worth ${money(h.value, cur)}` : "Nothing held yet"} />
      <TradeForm accountId={account.id} currency={cur} trades={own} transferTargets={transferTargets} initialSide={side} only={[side]} after={after} />
    </Shell>
  );
}

function Shell({ step = [], children }: { step?: { label: string; href?: string }[]; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Record", href: step.length ? "/record" : undefined }, ...step]} />
      {children}
    </div>
  );
}

function Heading({ account, summary }: { account: Account; summary: string }) {
  return (
    <div>
      <p className="eyebrow">{account.categoryName}</p>
      <h1 className="text-3xl">{account.name}</h1>
      <p className="num text-sm text-ink-3">{summary}</p>
    </div>
  );
}
