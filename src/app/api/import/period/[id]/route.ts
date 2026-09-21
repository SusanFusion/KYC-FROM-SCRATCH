import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { describeError } from "@/lib/utils";

export const runtime = "nodejs";

// GET /api/import/period/[id] — everything already committed for one
// period (its per-agent raw metrics + Business Gate numbers), so Manual
// Entry can pre-fill its grid with what's already on record instead of
// showing a blank form for a period that already has data. Read-only;
// gated the same way every other Data Import route is (see
// requireActionAccess.ts) since it's only ever called from inside the
// password-gated Manual Entry tab, and it surfaces the same raw per-agent
// numbers Manual Entry itself already writes.

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await requireActionAccess();
  if (denied) return denied;

  try {
    const repo = await getRepository();
    const [periods, metrics, gate] = await Promise.all([
      repo.getPeriods(),
      repo.getRawMetrics(params.id),
      repo.getGateMetrics(params.id),
    ]);

    const period = periods.find((p) => p.id === params.id) ?? null;
    if (!period) {
      return NextResponse.json({ error: "Period not found — it may have been deleted." }, { status: 404 });
    }

    return NextResponse.json({ period, metrics, gate });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error while loading this period's existing data.", detail: describeError(err) },
      { status: 500 }
    );
  }
}
