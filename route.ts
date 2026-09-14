import { NextResponse } from "next/server";
import {
  RECORD_UNLOCK_COOKIE_NAME,
  getRecordUnlockPassword,
  signUnlockedAgentIds,
} from "@/lib/auth/recordUnlock";

export const runtime = "nodejs";

interface UnlockBody {
  agentId?: string;
  password?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UnlockBody;
    const agentId = typeof body.agentId === "string" ? body.agentId : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!agentId) {
      return NextResponse.json({ error: "Missing agent." }, { status: 400 });
    }
    if (!password || password !== getRecordUnlockPassword()) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    const existingToken = request.headers
      .get("cookie")
      ?.split("; ")
      .find((c) => c.startsWith(`${RECORD_UNLOCK_COOKIE_NAME}=`))
      ?.slice(RECORD_UNLOCK_COOKIE_NAME.length + 1);

    const newToken = await signUnlockedAgentIds(existingToken ?? null, agentId);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(RECORD_UNLOCK_COOKIE_NAME, newToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // No maxAge/expires on purpose — a browser-session cookie, same as
      // the Lead login cookie: unlocking an agent's record lasts until the
      // browser is closed, not indefinitely.
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
