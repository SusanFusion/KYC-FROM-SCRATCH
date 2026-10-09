import { NextResponse } from "next/server";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { ROSTER } from "@/lib/auth/roster";
import { addAnnouncement, listAnnouncements, MAX_ANNOUNCEMENT_LENGTH } from "@/lib/data/announcements";
import { describeError } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: the 3 newest updates, for the start-up pop-up. Read-only, like the
// rest of the app's browsing -- see the note on /announcements.
export async function GET() {
  try {
    const announcements = await listAnnouncements(3);
    return NextResponse.json({ announcements }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: "Couldn't load the updates.", detail: describeError(err) }, { status: 500 });
  }
}

// POST: a Lead posts an update by hand (Announcements page). Behind the
// shared Lead/Manager password, and "posted by" has to be a Lead on the roster.
export async function POST(request: Request) {
  const denied = await requireActionAccess();
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => null)) as { author?: unknown; text?: unknown } | null;
    const author = typeof body?.author === "string" ? body.author : "";
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!ROSTER.some((r) => r.role === "lead" && r.name === author)) {
      return NextResponse.json({ error: "Pick who is posting this from the list." }, { status: 400 });
    }
    if (!text) return NextResponse.json({ error: "Write the update first." }, { status: 400 });
    if (text.length > MAX_ANNOUNCEMENT_LENGTH) {
      return NextResponse.json({ error: `Keep it under ${MAX_ANNOUNCEMENT_LENGTH} characters.` }, { status: 400 });
    }

    const result = await addAnnouncement({ author, text, source: "manual" });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, announcement: result.announcement });
  } catch (err) {
    return NextResponse.json({ error: "Couldn't post the update.", detail: describeError(err) }, { status: 500 });
  }
}
