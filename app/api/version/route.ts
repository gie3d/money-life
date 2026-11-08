import { appVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

/** What the server is running now, so an open page can tell when it has been left behind by a newer deploy. */
export function GET() {
  return Response.json({ version: appVersion() }, { headers: { "Cache-Control": "no-store" } });
}
