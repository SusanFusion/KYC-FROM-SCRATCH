import { NextResponse } from "next/server";
import { findRosterEntry } from "@/lib/auth/roster";
import { signSession, AUTH_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

// This sign-in is for Leads/Managers only — general browsing needs no
// account at all, and a KYC Officer's own QA Audit/penalty detail has its
// own separate, per-record password prompt (see recordUnlock.ts), not a
// real login. Set a real value via this env var in Vercel for production;
// the fallback below only exists so the app still logs in out of the box
// in local/demo mode (same zero-config philosophy as the LocalRepository
// data fallback). See .env.example.
const LEAD_PASSWORD = process.env.LEAD_SHARED_PASSWORD || "KYCLead#2026";

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = (body.email ?? "").trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    }

    const entry = findRosterEntry(email);
    if (!entry) {
      return NextResponse.json(
        { error: "That email isn't on the KYC roster. Check for typos, or ask your lead to add you." },
        { status: 401 }
      );
    }
    if (entry.role !== "lead") {
      return NextResponse.json(
        { error: "This sign-in is for Leads/Managers only — everyone else can browse without an account." },
        { status: 403 }
      );
    }

    if (password !== LEAD_PASSWORD) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    const token = await signSession({
      email: entry.email,
      name: entry.name,
      role: entry.role,
      agentId: entry.agentId,
      iat: Date.now(),
    });

    const res = NextResponse.json({ ok: true, name: entry.name, role: entry.role });
    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // Deliberately no maxAge/expires — a session cookie that clears when
      // the browser closes, per how this team wants sign-in to behave.
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error while signing in.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
