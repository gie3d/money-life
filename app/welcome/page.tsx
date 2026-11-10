import type { Metadata } from "next";
import SetupWizard from "@/components/SetupWizard";
import { listAccounts, listCategories } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Set up" };

/** The first-run setup. It can be opened again later to add several assets at once; the currency is then fixed. */
export default async function WelcomePage() {
  const user = await requireUser();
  const [categories, accounts] = await Promise.all([listCategories(user.id), listAccounts(user.id, true)]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <SetupWizard categories={categories} currency={user.currency} canChangeCurrency={accounts.length === 0} name={user.name} />
    </div>
  );
}
