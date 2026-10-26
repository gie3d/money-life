import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import DeleteAllData from "@/components/DeleteAllData";
import NameForm from "@/components/NameForm";
import PasswordForm from "@/components/PasswordForm";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Settings" }]} />
      <h1 className="text-3xl">Settings</h1>

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
