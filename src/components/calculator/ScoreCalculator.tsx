"use client";

import * as React from "react";
import { Calculator, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradeBadge } from "@/components/dashboard/PerformanceBadge";
import { INDIVIDUAL_METRICS } from "@/lib/scoring/thresholds";
import { determineBonusBracket } from "@/lib/scoring/bonus";
import {
  CALCULATOR_PENALTIES,
  calculateFromValues,
  parseKpiInput,
  penaltyDeduction,
  type CalculatorValues,
} from "@/lib/scoring/calculator";
import type { IndividualMetricKey } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

/** One agent's current month-to-date figures, so a typed-in score can be compared with the real one. */
export interface CalculatorAgent {
  id: string;
  name: string;
  finalScore: number;
  baseScore: number;
  penaltyTotal: number;
  values: Record<IndividualMetricKey, number | null>;
}

const UNIT_LABEL = { minutes: "min", seconds: "sec", percent: "%" } as const;

function fmt(n: number): string {
  return n.toFixed(2);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function penaltyHint(def: (typeof CALCULATOR_PENALTIES)[number]): string {
  if (def.monthlyGrace) {
    return `Free the first ${def.monthlyGrace.every - 1} times in a month, then -${fmt(def.monthlyGrace.deduction)} on every ${def.monthlyGrace.every}th`;
  }
  if (def.consecutiveRun) return `-${fmt(def.deduction)} each (days in a row on one note count as one)`;
  return `-${fmt(def.deduction)} each`;
}

export function ScoreCalculator({ agents, monthLabel }: { agents: CalculatorAgent[]; monthLabel: string | null }) {
  const [inputs, setInputs] = React.useState<Record<string, string>>({});
  const [counts, setCounts] = React.useState<Record<string, string>>({});
  const [agentId, setAgentId] = React.useState("");

  const agent = agents.find((a) => a.id === agentId) ?? null;

  // Turn what was typed into numbers. A box with a typo is left out of the
  // score and shows its own message instead of guessing.
  const parsed = INDIVIDUAL_METRICS.map((def) => ({ def, result: parseKpiInput(inputs[def.key] ?? "", def.unit) }));
  const values: CalculatorValues = {};
  for (const { def, result } of parsed) values[def.key] = result.ok ? result.value : null;

  const penaltyCounts: Record<string, number> = {};
  for (const def of CALCULATOR_PENALTIES) {
    const n = Number(counts[def.code] ?? "");
    penaltyCounts[def.code] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  const result = calculateFromValues(values, penaltyCounts);
  const bracket = determineBonusBracket(result.finalScore);
  const rowByKey = new Map(result.rows.map((r) => [r.key, r]));
  const anyInput = Object.values(inputs).some((v) => v.trim() !== "") || Object.values(counts).some((v) => v.trim() !== "");

  function fillFromMtd() {
    if (!agent) return;
    const next: Record<string, string> = {};
    for (const def of INDIVIDUAL_METRICS) {
      const v = agent.values[def.key];
      if (v !== null && v !== undefined) next[def.key] = String(round2(v));
    }
    setInputs(next);
  }

  function reset() {
    setInputs({});
    setCounts({});
  }

  const diff = agent && result.hasAny ? round2(result.finalScore - agent.finalScore) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" /> Your KPI figures
            </CardTitle>
            <CardDescription>
              Type what you have for each KPI. Leave a box empty if you have no figure for it; it is left out and the rest are scaled up, exactly like your scorecard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {agents.length > 0 && (
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="min-w-[12rem] flex-1">
                  <label htmlFor="calc-agent" className="mb-1 block text-xs font-medium text-muted-foreground">
                    Compare with my current month to date{monthLabel ? ` (${monthLabel})` : ""}
                  </label>
                  <select
                    id="calc-agent"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Pick your name (optional)</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={fillFromMtd} disabled={!agent}>
                  Use my month-to-date figures
                </Button>
              </div>
            )}

            <div className="divide-y divide-border">
              {parsed.map(({ def, result: p }) => {
                const row = rowByKey.get(def.key);
                return (
                  <div key={def.key} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_11rem_11rem] sm:items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{def.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Target {def.target} · {Math.round(def.weight * 100)}% of the score
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Input
                          inputMode={def.unit === "minutes" ? "text" : "decimal"}
                          aria-label={`${def.name} in ${def.unit}`}
                          placeholder={def.unit === "minutes" ? "e.g. 22.5 or 22:30" : "e.g. 22"}
                          value={inputs[def.key] ?? ""}
                          onChange={(e) => setInputs((prev) => ({ ...prev, [def.key]: e.target.value }))}
                          className={cn(!p.ok && "border-danger focus-visible:ring-danger")}
                        />
                        <span className="w-8 flex-shrink-0 text-xs text-muted-foreground">{UNIT_LABEL[def.unit]}</span>
                      </div>
                      {!p.ok && <p className="mt-1 text-xs text-danger">{p.error}</p>}
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <GradeBadge grade={row?.grade ?? null} label={row?.gradeLabel ?? "No data"} />
                      <span className="w-14 text-right text-sm tabular-nums text-muted-foreground">
                        {row?.weightedPoints !== null && row?.weightedPoints !== undefined ? `+${fmt(row.weightedPoints)}` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <details>
            <summary className="cursor-pointer list-none p-6 text-sm font-semibold text-foreground">
              Penalties <span className="font-normal text-muted-foreground">(optional) — how many of each did you get this month?</span>
              <span aria-hidden="true" className="ml-2 text-muted-foreground">
                ▾
              </span>
            </summary>
            <CardContent className="space-y-1 pt-0">
              {CALCULATOR_PENALTIES.map((def) => {
                const deduction = penaltyDeduction(def, penaltyCounts[def.code] ?? 0);
                return (
                  <div key={def.code} className="grid gap-2 border-t border-border py-2.5 sm:grid-cols-[minmax(0,1fr)_6rem_5rem] sm:items-center">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{def.label}</p>
                      <p className="text-xs text-muted-foreground">{penaltyHint(def)}</p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      aria-label={`How many: ${def.label}`}
                      placeholder="0"
                      value={counts[def.code] ?? ""}
                      onChange={(e) => setCounts((prev) => ({ ...prev, [def.code]: e.target.value }))}
                    />
                    <span className={cn("text-right text-sm tabular-nums", deduction > 0 ? "text-danger" : "text-muted-foreground")}>
                      {deduction > 0 ? `-${fmt(deduction)}` : "—"}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </details>
        </Card>
      </div>

      <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <Card className={cn(result.hasAny && (result.passes ? "border-success/40" : "border-warning/40"))}>
          <CardHeader>
            <CardTitle>Your monthly scorecard score</CardTitle>
            <CardDescription>Out of {result.maxScore.toFixed(2)}, the same way the Overall MTD page works it out.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!result.hasAny ? (
              <p className="text-sm text-muted-foreground">Type at least one KPI figure to see your score.</p>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-semibold tracking-tight tabular-nums text-foreground">{fmt(result.finalScore)}</span>
                  <span className="text-sm text-muted-foreground">/ {result.maxScore.toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {result.passes ? (
                    <Badge variant="success">At or above the {fmt(result.passLine)} pass line</Badge>
                  ) : (
                    <Badge variant="warning">Below the {fmt(result.passLine)} pass line</Badge>
                  )}
                  <Badge variant="primary">
                    Bonus bracket {bracket.label} · {Math.round(bracket.percentage * 100)}%
                  </Badge>
                </div>

                <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Score from your KPIs</dt>
                    <dd className="tabular-nums text-foreground">{fmt(result.baseScore)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Penalties</dt>
                    <dd className={cn("tabular-nums", result.penaltyTotal > 0 ? "text-danger" : "text-foreground")}>
                      {result.penaltyTotal > 0 ? `-${fmt(result.penaltyTotal)}` : "0.00"}
                    </dd>
                  </div>
                  <div className="flex justify-between font-medium">
                    <dt className="text-foreground">Final score</dt>
                    <dd className="tabular-nums text-foreground">{fmt(result.finalScore)}</dd>
                  </div>
                </dl>

                {result.hasMissing && (
                  <p className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
                    {Math.round(result.effectiveWeight * 100)}% of the score has a figure. The KPIs you left empty are left out and the rest are scaled up to the full {result.maxScore.toFixed(2)}.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {agent && (
          <Card>
            <CardHeader>
              <CardTitle>Against your actual month to date</CardTitle>
              <CardDescription>{agent.name}{monthLabel ? ` · ${monthLabel}` : ""}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Current month-to-date score</span>
                <span className="text-2xl font-semibold tabular-nums text-foreground">{fmt(agent.finalScore)}</span>
              </div>
              {diff !== null ? (
                <p className="text-sm text-muted-foreground">
                  Your figures here come to{" "}
                  <span className={cn("font-medium", diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-foreground")}>
                    {diff > 0 ? `${fmt(diff)} higher` : diff < 0 ? `${fmt(Math.abs(diff))} lower` : "the same score"}
                  </span>
                  {diff === 0 ? "." : " than your current month to date."}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Type your figures to see the difference.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Tip: press &ldquo;Use my month-to-date figures&rdquo;, then change one KPI to see what it would do to your score.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            For planning only. The Business Gate multiplier isn&apos;t included, and your official score is the one on your scorecard.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={reset} disabled={!anyInput}>
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
