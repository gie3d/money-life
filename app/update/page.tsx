import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import UpdateValues, { type ValueRow } from "@/components/UpdateValues";
import { listAccounts, listCategories, listEntries, listPrices, listTrades } from "@/lib/data";
import { sortByCategory } from "@/lib/group";
import { holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";
import { isInvestment } from "@/lib/types";

export const metadata: Metadata = { title: "Update values" };

export default async function UpdateValuesPage() {
  const user = await requireUser();
  const [accounts, entries, categories, trades, prices] = await Promise.all([
    listAccounts(user.id), listEntries(user.id), listCategories(user.id), listTrades(user.id), listPrices(user.id),
  ]);
  const held = holdings(accounts, entries, trades, prices);

  // One row per asset that can be given a new value: any cash or saving balance, and any investment with units.
  const rows: ValueRow[] = sortByCategory(accounts, (a) => a.categoryId, categories).flatMap((a) => {
    const h = held.find((x) => x.account.id === a.id);
    if (isInvestment(a) && !h) return [];
    return [{
      id: a.id,
      name: a.name,
      color: a.categoryColor,
      categoryId: a.categoryId,
      category: a.categoryName,
      investment: isInvestment(a),
      units: h?.quantity ?? null,
      current: h ? (h.investment ? h.price : h.value) : null,
      value: h?.value ?? 0,
    }];
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Record", href: "/record" }, { label: "Update balances and prices" }]} />
      <div>
        <h1 className="text-3xl">Update balances and prices</h1>
        <p className="mt-1 text-sm text-ink-3">
          Type today&apos;s price for investments and today&apos;s balance for cash and saving; each row shows what the asset will be worth.
          Leave a box empty to keep it as it is. For a deposit, withdrawal, buy or sale, use <Link href="/record" className="font-semibold text-brand">Record</Link>.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-ink-3">No assets to update yet.</p>
          <Link href="/welcome" className="btn mt-4">Set up my assets</Link>
        </div>
      ) : (
        <UpdateValues rows={rows} currency={user.currency} />
      )}
    </div>
  );
}
