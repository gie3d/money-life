import type { Metadata } from "next";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import { day } from "@/lib/format";
import { releases } from "@/lib/releases";
import pkg from "../../package.json";

export const metadata: Metadata = { title: "Release notes" };
export const dynamic = "force-dynamic";

export default async function ReleasesPage({ searchParams }: PageProps<"/releases">) {
  const all = releases();
  const v = (await searchParams).v;
  const shown = all.find((r) => r.version === v) ?? all[0];
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div>
        <p className="eyebrow">Money Life · version {pkg.version}</p>
        <h1 className="text-3xl">Release notes</h1>
      </div>
      {all.length === 0 || !shown ? (
        <p className="text-sm text-ink-3">No release notes yet.</p>
      ) : (
        <>
          <nav className="flex flex-wrap gap-1.5" aria-label="Versions">
            {all.map((r, i) => (
              <Link key={r.version} href={i === 0 ? "/releases" : `/releases?v=${r.version}`} aria-current={r.version === shown.version ? "page" : undefined}
                className={`num rounded-full px-4 py-1.5 text-sm font-semibold ${r.version === shown.version ? "bg-ink text-surface" : "bg-surface text-ink-3"}`}>
                {r.version}{i === 0 && " · latest"}
              </Link>
            ))}
          </nav>
          <section className="card p-5 sm:p-6">
            <h2 className="num text-xl">
              Version {shown.version}
              {shown.version === pkg.version && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">current</span>}
            </h2>
            {shown.date && <p className="mb-3 text-sm text-ink-3">{day(shown.date)}</p>}
            <Markdown>{shown.notes}</Markdown>
          </section>
        </>
      )}
    </div>
  );
}
