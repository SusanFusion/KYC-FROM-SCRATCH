import { NextResponse } from "next/server";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { deleteAnnouncement } from "@/lib/data/announcements";
import { describeError } from "@/lib/utils";

export const runtime = "nodejs";

// A Lead removes an update (e.g. one that's out of date). Lead password required.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const denied = await requireActionAccess();
  if (denied) return denied;

  try {
    const removed = await deleteAnnouncement(params.id);
    if (!removed) return NextResponse.json({ error: "That update no longer exists." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Couldn't delete the update.", detail: describeError(err) }, { status: 500 });
  }
}
