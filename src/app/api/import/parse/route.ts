import { NextResponse } from "next/server";
import { parseKycReportPages, type PageTextItem } from "@/lib/data/pdfImportParser";
import { getRepository } from "@/lib/data/repository";

export const runtime = "nodejs";

// pdfjs-dist (5.x) relies on `Promise.withResolvers`, a very recent JS
// feature (reliably available only in Node 20.11+/22+). Vercel serverless
// functions can run on an older Node version than that depending on the
// project's configured Node.js version, which makes every single PDF —
// regardless of its content — fail inside pdf.js with a low-level
// "Promise.withResolvers is not a function" error. That gets caught below
// and surfaces as the generic "Could not read this PDF" message, which is
// misleading: the PDF itself is fine. This polyfill removes the dependency
// on the runtime's Node version entirely, so it's safe to keep even after
// the Vercel project's Node version is confirmed to be 20.11+/22+.
if (typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== "function") {
  (Promise as unknown as { withResolvers: <T>() => { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } }).withResolvers = function withResolvers<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

interface PdfJsTextItem {
  str: string;
  // pdf.js always returns a 6-element transform matrix [a, b, c, d, e, f];
  // typed as a fixed-length tuple (not number[]) so indexing transform[4]/[5]
  // is known to be `number`, not `number | undefined`, under
  // noUncheckedIndexedAccess.
  transform: [number, number, number, number, number, number];
}

async function extractPages(buffer: Uint8Array): Promise<PageTextItem[][]> {
  // Dynamic import: pdfjs-dist's legacy Node build isn't Edge-compatible,
  // and importing it lazily keeps it out of any client bundle.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: PageTextItem[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      (content.items as unknown as PdfJsTextItem[]).map((item) => ({
        str: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
      }))
    );
  }
  return pages;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No PDF file was provided." }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    let pages: PageTextItem[][];
    try {
      pages = await extractPages(buffer);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            "Could not read this PDF. It may be image-only (scanned) or corrupted — this parser requires a text-based PDF.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 422 }
      );
    }

    const repo = await getRepository();
    const agents = await repo.getAgents();
    const parsed = parseKycReportPages(pages, agents);

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No recognized KYC performance tables were found in this PDF. Expected the Daily/Monthly KYC Team Performance Report layout.",
          warnings: parsed.warnings,
        },
        { status: 422 }
      );
    }

    const { record, rows } = await repo.createImport(
      {
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        periodLabel: parsed.periodLabelGuess,
        status: "pending_review",
        rowCount: parsed.rows.length,
      },
      parsed.rows
    );

    return NextResponse.json({
      importId: record.id,
      rows,
      gate: parsed.gate,
      gateFieldsFound: parsed.gateFieldsFound,
      tablesDetected: parsed.tablesDetected,
      periodLabelGuess: parsed.periodLabelGuess,
      generatedDateGuess: parsed.generatedDateGuess,
      warnings: parsed.warnings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error while parsing the PDF.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
