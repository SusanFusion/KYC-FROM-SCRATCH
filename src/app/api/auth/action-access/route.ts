import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ACTION_ACCESS_COOKIE_NAME,
  ACTION_ACCESS_LIFETIME_SECONDS,
  checkActionPassword,
  signActionAccessToken,
  verifyActionAccessToken,
} from "@/lib/auth/actionAccess";

export const runtime = "nodejs";

interface UnlockBody {
  password?: string;
}

/** PasswordGate calls this on mount to find out whether this browser is
 *  already unlocked (e.g. from earlier in the same 12-hour window), so it
 *  doesn't show a password prompt for something the person already
 *  unlocked five minutes ago. */
export async function GET() {
  const token = cookies().get(ACTION_ACCESS_COOKIE_NAME)?.value;
  const unlocked = await verifyActionAccessToken(token);
  return NextResponse.json({ unlocked });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as UnlockBody;
  const password = typeof body.password === "string" ? body.password : "";

  if (!checkActionPassword(password)) {
    return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });
  }

  const token = await signActionAccessToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTION_ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTION_ACCESS_LIFETIME_SECONDS,
  });
  return res;
}

/** Manually re-locks this browser ahead of the normal 12h expiry -- e.g. a
 *  "Log out as Lead/Auditor" control in the sidebar. Clearing the cookie is
 *  enough: every PasswordGate re-checks GET /api/auth/action-access on its
 *  own next mount and will show the password prompt again. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTION_ACCESS_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
