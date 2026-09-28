import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/server/session";

/**
 * Sends signed-out visitors from /admin/* to the login page. This is a
 * convenience gate for navigation; every admin page and server action also
 * checks the session itself.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  let ok = false;
  try {
    ok = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  } catch {
    ok = false; // secret not configured yet — the login page explains setup
  }
  if (!ok) return NextResponse.redirect(new URL("/admin/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
