import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Release = { version: string; date: string; notes: string };

/** The releases in CHANGELOG.md, newest first: each `## [version] - date` heading and the notes under it. */
export function releases(): Release[] {
  let text = "";
  try {
    text = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8");
  } catch {
    return [];
  }
  const out: Release[] = [];
  const head = /^## \[(\d+\.\d+\.\d+)\](?: - (\S+))?[ \t]*$/gm;
  const marks = [...text.matchAll(head)];
  marks.forEach((m, i) => {
    const end = marks[i + 1]?.index ?? text.length;
    out.push({ version: m[1], date: m[2] ?? "", notes: text.slice(m.index + m[0].length, end).trim() });
  });
  return out;
}
