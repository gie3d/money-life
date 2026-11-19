"use client";

import { useRouter } from "next/navigation";

/** Picks which release to read on /releases. The newest lives at /releases, the others at /releases?v=x.y.z. */
export default function VersionPicker({ versions, shown }: { versions: { version: string; date: string }[]; shown: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-ink-3">
      Version
      <select
        className="field num w-auto cursor-pointer border-line bg-surface font-semibold shadow-sm transition-colors hover:border-brand"
        value={shown}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v === versions[0]?.version ? "/releases" : `/releases?v=${v}`);
        }}
      >
        {versions.map((r, i) => (
          <option key={r.version} value={r.version}>
            {r.version}{r.date && ` · ${r.date}`}{i === 0 && " · latest"}
          </option>
        ))}
      </select>
    </label>
  );
}
