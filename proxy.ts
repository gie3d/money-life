import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* Optimistic check only: it looks for the cookie, not whether the session is valid.
   Real authorisation happens in lib/session.ts, next to the data. */
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has("ml_session");
  const { pathname } = request.nextUrl;
  // Signed-in visitors on /login are bounced by the page itself, which can tell a stale cookie from a live one.
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (!signedIn && !isAuthPage) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|ico)$).*)"],
};
