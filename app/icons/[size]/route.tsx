import { appIcon } from "@/lib/app-icon";

/** The manifest's icons, at 192 and 512 pixels. */
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (size !== 192 && size !== 512) return new Response("Not found", { status: 404 });
  return appIcon(size);
}
