"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileCheck2, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { getLocalTodayIso } from "@/lib/utils";

interface PeriodOption {
  id: string;
  label: string;
  endDate: string;
}

const NEW_PERIOD_VALUE = "__new__";

/** The PDF's own "Generated Date:" text is read verbatim as DD-MM-YYYY —
 *  converts it to the YYYY-MM-DD a plain <input type="date"> needs, so the
 *  date field can start pre-filled with the app's best guess instead of
 *  blank. Returns null (rather than guessing) for anything that doesn't
 *  match that exact shape, so a garbled or missing date never silently
 *  becomes a wrong one — the caller falls back to today instead. */
function guessToIso(guess: string | null): string | null {
  if (!guess) return null;
  const m = guess.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

interface ParsedRow {
  id?: string;
  agentNameRaw: string;
  matchedAgentId: string | null;
  metricKey: string;
  rawValue: string;
  parsedValue: number | null;
  status: "extracted" | "needs_review" | "failed";
  note?: string;
}

interface ParseResponse {
  importId: string;
  rows: ParsedRow[];
  gate: Record<string, number | null>;
  gateFieldsFound: string[];
  tablesDetected: string[];
  periodLabelGuess: string | null;
  generatedDateGuess: string | null;
  warnings: string[];
  error?: string;
