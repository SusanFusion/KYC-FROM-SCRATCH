import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

// Gate every route except: Next's own static/image assets, the favicon, and
// the /api/auth/* endpoints themselves (login has to be reachable while
// signed out; logout has to be reachable while signed in but about to not
// be). Everything else — every page AND every other API route — requires a
// valid session.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/).*)"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
