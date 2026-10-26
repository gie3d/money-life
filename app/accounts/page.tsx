import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import AccountForm from "@/components/AccountForm";
import { listAccounts, listCategories, listEntries, listPrices, listTrades } from "@/lib/data";
import { day, money } from "@/lib/format";
import { holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { labelOf, LIQUIDITY, TYPES } from "@/lib/types";

export const metadata: Metadata = { title: "Assets" };

export default async function AccountsPage() {
  const user = await requireUser();
  const [accounts, entries, categories, trades, prices] = await Promise.all([
    listAccounts(user.id, true), listEntries(user.id), listCategories(user.id), listTrades(user.id), listPrices(user.id),
  ]);
  const held = holdings(accounts, entries, trades, prices);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Assets" }]} />
      <h1 className="text-3xl">Assets</h1>
      {accounts.length > 0 && (
        <section className="card divide-y divide-line">
          {accounts.map((a) => {
            const latest = held.find((x) => x.account.id === a.id);
            return (
              <Link key={a.id} href={`/accounts/${a.id}`} className={`flex items-center gap-3 px-4 py-3.5 sm:px-6 ${a.archived ? "opacity-60" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.name}{a.archived && <span className="ml-2 text-xs font-medium text-ink-3">archived</span>}</p>
                  <p className="flex items-center gap-1.5 text-xs text-ink-3"><span className="size-2 rounded-full" style={{ background: a.categoryColor }} />{a.categoryName} · {labelOf(TYPES, a.type)} · {labelOf(LIQUIDITY, a.liquidity)}</p>
                </div>
                <div className="text-right">
                  <p className="num font-semibold">{latest ? money(latest.value, user.currency) : "Nothing recorded yet"}</p>
                  {latest && <p className="text-xs text-ink-3">{day(latest.lastDate)}</p>}
                </div>
              </Link>
            );
          })}
        </section>
      )}
      <AccountForm categories={categories} />
    </div>
  );
}
