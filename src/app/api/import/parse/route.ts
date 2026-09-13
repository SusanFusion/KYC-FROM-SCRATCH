// pdf.js has no real Worker thread to hand off to here, so it falls back to
// a "fake worker" that runs its worker-side code inline — but that code
// still lives in a separate file (pdf.worker.mjs) that pdf.js loads via a
// dynamically *computed* import path at runtime. Vercel's build only
// bundles files it can see via a static import/require, so that computed
// path was silently missing from the deployed function ("Cannot find
// module .../pdf.worker.mjs"), even though the PDF and every other part of
// the setup were fine. This plain side-effect import gives the bundler a
// literal path to see and include; pdf.js's own internal dynamic import of
// the exact same file then resolves from Node's module cache instead of
// hitting the filesystem gap.
import "pdfjs-dist/legacy/build/pdf.worker.mjs";

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
  // pdfjs-dist internally needs DOMMatrix/Path2D/ImageData even for plain
  // text extraction (no rendering) — globals Node doesn't have. Rather than
  // rely on pdfjs-dist auto-detecting @napi-rs/canvas on its own (it
  // doesn't, for this Node entry point), assign its real DOMMatrix/Path2D/
  // ImageData classes onto globalThis ourselves, once, before pdfjs-dist
  // ever runs. Cast through Record<string, unknown> rather than the
  // ambient lib.dom.d.ts globals — @napi-rs/canvas's classes are a
  // different concrete type than TypeScript's DOM lib types, and we only
  // need pdf.js's own internal code (which expects the real runtime shape,
  // not our type-checker's opinion of it) to find something at that name.
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined" || typeof g.Path2D === "undefined" || typeof g.ImageData === "undefined") {
    const canvas = await import("@napi-rs/canvas");
    g.DOMMatrix ??= canvas.DOMMatrix;
    g.Path2D ??= canvas.Path2D;
    g.ImageData ??= canvas.ImageData;
  }

  // Dynamic import: pdfjs-dist's legacy Node build isn't Edge-compatible,
  // and importing it lazily keeps it out of any client bundle. It must
  // come after the globals above are set, since pdf.js reads them at
  // module-evaluation time.
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
    // Multiple files can be uploaded in one go and are merged into a single
    // import/period — e.g. one report has response-time metrics and another
    // has CSAT/QA data for the same week. Every existing single-file upload
    // still works unchanged: it's just one file in this list.
    const files = formData.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "No PDF file was provided." }, { status: 400 });
    }
    const nonPdf = files.find((f) => f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf"));
    if (nonPdf) {
      return NextResponse.json({ error: `"${nonPdf.name}" is not a PDF file.` }, { status: 400 });
    }

    let allPages: PageTextItem[][] = [];
    const perFileErrors: string[] = [];
    for (const file of files) {
      const buffer = new Uint8Array(await file.arrayBuffer());
      try {
        allPages = allPages.concat(await extractPages(buffer));
      } catch (err) {
        perFileErrors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (allPages.length === 0) {
      return NextResponse.json(
        {
          error:
            files.length > 1
              ? "Could not read any of the uploaded PDFs. They may be image-only (scanned) or corrupted — this parser requires text-based PDFs."
              : "Could not read this PDF. It may be image-only (scanned) or corrupted — this parser requires a text-based PDF.",
          detail: perFileErrors.join(" | "),
        },
        { status: 422 }
      );
    }

    const repo = await getRepository();
    const agents = await repo.getAgents();
    const parsed = parseKycReportPages(allPages, agents);
    // One or more files parsed fine even if others in the batch didn't —
    // surface those as warnings rather than failing the whole import.
    if (perFileErrors.length > 0) {
      parsed.warnings.push(
        ...perFileErrors.map((e) => `Skipped a file that couldn't be read: ${e}`)
      );
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No recognized KYC performance tables were found in the uploaded PDF(s). Expected the Daily/Monthly KYC Team Performance Report layout.",
          warnings: parsed.warnings,
        },
        { status: 422 }
      );
    }

    const { record, rows } = await repo.createImport(
      {
        fileName: files.map((f) => f.name).join(", "),
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
