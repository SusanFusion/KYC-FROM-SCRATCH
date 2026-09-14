import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

// General browsing (Dashboard, Team Performance, Rankings, Scorecards,
// Trends, QA/Quality, Penalties (viewing), Reports (viewing), Settings) is
// open to anyone with the link — no sign-in at all. Only the actions below
// (importing/editing/exporting data) require a Lead/Manager session; an
// agent's own QA Audit + penalty detail has its own separate, lighter
// unlock (see recordUnlock.ts) that isn't handled here.
const LEAD_ONLY_PATHS = ["/import", "/api/import", "/api/reports/export"];

function requiresLead(pathname: string): boolean {
  return LEAD_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/).*)"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || !requiresLead(pathname)) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session || session.role !== "lead") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in as a Lead/Manager to do this." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
