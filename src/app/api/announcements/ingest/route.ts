import { NextResponse } from "next/server";
import { addAnnouncement, parseIngestBody, secretMatches } from "@/lib/data/announcements";
import { describeError } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The automatic Teams feed: a Power Automate flow ("When a new message is
// added to a chat" -> HTTP POST) sends each new KYC UPDATES message here.
//
// Not behind the Lead password (a flow can't type one) -- instead it needs the
// secret in the `x-ingest-secret` header to match the ANNOUNCEMENTS_INGEST_SECRET
// environment variable. With no secret configured the endpoint stays closed.
//
// Body (JSON): { "text": "...", "author": "Sender name", "messageId": "...", "sentAt": "2026-10-09T08:00:00Z" }
// Only "text" is required. Teams sends HTML; it's turned into plain text here.
// Sending the same messageId twice stores it once.
export async function POST(request: Request) {
  const expected = process.env.ANNOUNCEMENTS_INGEST_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Not configured: set ANNOUNCEMENTS_INGEST_SECRET on the server." }, { status: 503 });
  }
  if (!secretMatches(request.headers.get("x-ingest-secret"), expected)) {
    return NextResponse.json({ error: "Wrong or missing secret." }, { status: 401 });
  }

  try {
    const parsed = parseIngestBody(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const result = await addAnnouncement({
      author: parsed.author,
      text: parsed.text,
      source: "teams",
      sourceId: parsed.sourceId,
      postedAt: parsed.postedAt,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, duplicate: result.duplicate, id: result.announcement.id });
  } catch (err) {
    return NextResponse.json({ error: "Couldn't store the message.", detail: describeError(err) }, { status: 500 });
  }
}
