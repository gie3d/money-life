import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import CategoryManager from "@/components/CategoryManager";
import { listAccounts, listCategories, listEntries, listPrices, listTrades } from "@/lib/data";
import { holdings } from "@/lib/portfolio";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const user = await requireUser();
  const [accounts, categories, entries, trades, prices] = await Promise.all([
    listAccounts(user.id, true), listCategories(user.id), listEntries(user.id), listTrades(user.id), listPrices(user.id),
  ]);

  // Every asset counts towards whether a category can be deleted; only active ones count towards its total.
  const usage: Record<number, number> = {};
  for (const a of accounts) usage[a.categoryId] = (usage[a.categoryId] ?? 0) + 1;
  const totals: Record<number, number> = {};
  for (const h of holdings(accounts.filter((a) => !a.archived), entries, trades, prices)) {
    totals[h.account.categoryId] = (totals[h.account.categoryId] ?? 0) + h.value;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Categories" }]} />
      <h1 className="text-3xl">Categories</h1>
      <CategoryManager categories={categories} usage={usage} totals={totals} currency={user.currency} />
    </div>
  );
}
