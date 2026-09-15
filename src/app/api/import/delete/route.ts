import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";
import { describeError } from "@/lib/utils";

export const runtime = "nodejs";

interface DeleteImportBody {
  importId: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeleteImportBody;
    if (!body.importId) {
      return NextResponse.json({ error: "Missing importId." }, { status: 400 });
    }

    const repo = await getRepository();
    const [imports, periods] = await Promise.all([repo.getImports(), repo.getPeriods()]);
    const record = imports.find((i) => i.id === body.importId);
    if (!record) {
      return NextResponse.json({ error: "Import not found — it may have already been deleted." }, { status: 404 });
    }

    // No period ever got linked to this import — either it was never
    // committed (still "pending_review" or "failed"), or it predates the
    // period_id column being added. Either way there's no period data to
    // touch; just remove the audit-trail record itself.
    if (!record.periodId) {
      await repo.deleteImport(record.id);
      return NextResponse.json({ ok: true, deletedPeriod: false, message: "Import record removed." });
    }

    const period = periods.find((p) => p.id === record.periodId);
    // Every OTHER import that also points at this same period — normally
    // zero, since every import mints its own daily period by default now,
    // but a PDF import and a later manual entry can still be deliberately
    // merged onto one shared day (see commitImportRows.ts's targetPeriodId).
    const siblingImports = imports.filter((i) => i.periodId === record.periodId && i.id !== record.id);

    if (siblingImports.length === 0) {
      // This import is the sole reason this period exists — deleting it
      // means deleting the whole day: its individual metrics, its Business
      // Gate numbers, any penalties logged against it, and the import
      // record itself. This is what makes it "no longer read anywhere" —
      // every page (Team Performance, Trends, Overall MTD, Dashboard,
      // Rankings, Scorecards, Reports, Penalties) reads periods fresh on
      // every request, with nothing cached in between.
      await repo.deletePeriod(record.periodId);
      return NextResponse.json({
        ok: true,
        deletedPeriod: true,
        periodLabel: period?.label ?? record.periodLabel ?? record.periodId,
      });
    }

    // Another import also contributed to this same period — deleting the
    // whole period here would erase that other import's data too, which
    // this specific delete was never asked to do. Only remove this one
    // import's own audit-trail record; the period and everything stored
    // against it (including whatever this import itself wrote) stays.
    await repo.deleteImport(record.id);
    return NextResponse.json({
      ok: true,
      deletedPeriod: false,
      message: `Import record removed. Its data is still part of "${period?.label ?? record.periodId}" because another import also contributed to that same period.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error while deleting the import.", detail: describeError(err) },
      { status: 500 }
    );
  }
}
