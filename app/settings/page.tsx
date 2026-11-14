import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import DeleteAllData from "@/components/DeleteAllData";
import NameForm from "@/components/NameForm";
import PasswordForm from "@/components/PasswordForm";
import { logout } from "@/app/actions/auth";
import { setBtcStandard } from "@/app/actions/settings";
import { btcRates } from "@/lib/btc";
import { pool } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const eligible = (await btcRates(user.id)) !== null;
  const { rows } = await pool.query("SELECT currency FROM users WHERE id = $1", [user.id]);
  const baseCurrency = rows[0].currency as string;
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Settings" }]} />
      <h1 className="text-3xl">Settings</h1>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div className="max-w-xl">
          <h2 className="text-lg">Categories</h2>
          <p className="text-xs text-ink-3">The groups your assets sit in, like Funds, Gold or Savings: add, rename, recolour or remove them.</p>
        </div>
        <Link href="/settings/categories" className="btn btn-quiet">Manage categories</Link>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div className="max-w-xl">
          <h2 className="text-lg">BTC Standard</h2>
          <p className="text-xs text-ink-3">
            Shows every amount in BTC instead of {baseCurrency}, converted with the prices recorded on the assets in your BTC category: each day at its
            own price, and anything forward-looking (plans, bills, goals) at the latest one. Nothing stored changes. Prices and balances are still entered in {baseCurrency}; other amounts can&apos;t be recorded or edited while it is on.
          </p>
          {!eligible && <p className="mt-1.5 text-xs font-semibold text-ink-2">Needs an investment category named BTC with at least one price recorded on an asset in it.</p>}
        </div>
        <form action={setBtcStandard}>
          <input type="hidden" name="on" value={String(!user.btcStandard)} />
          <button className={user.btcStandard ? "btn btn-quiet" : "btn"} disabled={!eligible && !user.btcStandard}>{user.btcStandard ? "Turn off" : "Turn on"}</button>
        </form>
      </section>

      <NameForm name={user.name} email={user.email} />
      <PasswordForm />

      <section className="card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div>
          <h2 className="text-lg">Sign out</h2>
          <p className="text-xs text-ink-3">Signs you out on this device.</p>
        </div>
        <form action={logout}>
          <button className="btn btn-quiet">Sign out</button>
        </form>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3 border-miss p-5 sm:p-6">
        <div className="max-w-xl">
          <h2 className="text-lg text-miss-text">Delete all data</h2>
          <p className="text-xs text-ink-3">Removes every asset, trade, price, category and plan you entered. Your account stays. You&apos;ll be asked to confirm.</p>
        </div>
        <DeleteAllData />
      </section>
    </div>
  );
}
