import { NextResponse } from "next/server";
import { commitImportRows } from "@/lib/data/commitImportRows";
import type { ImportRow } from "@/types/domain";
import type { RawGateMetrics } from "@/lib/scoring/types";
import { describeError } from "@/lib/utils";
import { requireActionAccess } from "@/lib/auth/actionAccess";

export const runtime = "nodejs";

interface CommitBody {
  importId: string;
  rows: ImportRow[]; // the user-reviewed/edited rows
  periodLabel?: string | null;
  generatedDateGuess?: string | null;
  /** YYYY-MM-DD — the date the person reviewing the import confirmed (or
   *  corrected) on the Data Import page, from a plain <input type="date">.
   *  This is now the primary source of truth for which day this data is
   *  for; generatedDateGuess (parsed out of the PDF's own text) is kept
   *  only as a fallback for older clients that don't send this. */
  endDateIso?: string | null;
  gate?: Partial<RawGateMetrics>;
  /** Merge into this existing period instead of creating a new one — see commitImportRows.ts. */
  targetPeriodId?: string | null;
}

function parseDdMmYyyy(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function isValidIsoDate(input: string | null | undefined): input is string {
  return !!input && /^\d{4}-\d{2}-\d{2}$/.test(input);
}

export async function POST(request: Request) {
  try {
    const denied = await requireActionAccess();
    if (denied) return denied;

    const body = (await request.json()) as CommitBody;
    if (!body.importId || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: "Missing importId or rows." }, { status: 400 });
    }

    const endDateIso = isValidIsoDate(body.endDateIso)
      ? body.endDateIso
      : (parseDdMmYyyy(body.generatedDateGuess) ?? new Date().toISOString().slice(0, 10));

    const result = await commitImportRows({
      importId: body.importId,
      rows: body.rows,
      periodLabel: body.periodLabel,
      endDateIso,
      gate: body.gate,
      targetPeriodId: body.targetPeriodId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ period: result.period, agentsUpdated: result.agentsUpdated });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error while committing the import.", detail: describeError(err) },
      { status: 500 }
    );
  }
}
