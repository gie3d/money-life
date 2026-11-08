import { readFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json";

/**
 * Identifies the running build: the app version and, in a production build, the id Next gives every build. A new
 * deploy changes it even when the version number wasn't bumped. In development there is no build id.
 */
export function appVersion(): string {
  let build = "dev";
  try {
    build = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || "dev";
  } catch {}
  return `${pkg.version}+${build}`;
}
