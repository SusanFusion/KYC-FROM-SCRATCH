# KYC Team Performance

A KYC team performance & scorecard dashboard: team-level Business Gate multiplier, individual agent scorecards with full calculation transparency, rankings, trends, penalties, and PDF-based data import. Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and a Supabase-ready data layer.

The **rebrandable app name** lives in one place: `NEXT_PUBLIC_APP_NAME` (see `.env.example`). Everything else in the UI reads from that.

## Source of truth

Every scoring rule, threshold, weight, roster name, and bonus figure in this app comes directly from two documents supplied for this project:

- **`KYC KPI Realignment Framework` (07/29/2026)** — the Business Gate (Layer 1), the Proposed Individual Grading Scales (Layer 2), the Individual Bonus Bracket, the Disciplinary + Attendance Penalty tables, and the QA/Automation Roadmap (Layer 3).
- **`Daily KYC Team Performance Report` (generated 11-09-2026)** — the roster (17 agents) and this period's raw metrics.

Nothing was invented. Where the source documents were ambiguous, silent, or **internally inconsistent**, the decision made is recorded in `src/lib/scoring/notes.ts` and rendered in-app under **Settings → Data Notes**. The most important one:

> The framework's own "Elena" worked example grades two metrics (Chat Avg Response Time, CSAT/DSAT) one tier higher than its own threshold tables justify. Per explicit instruction, **this app implements the stated threshold tables, not the example's arithmetic** — see the `worked-example-mismatch` note for the full breakdown and the score/bonus difference it causes (2.65→2.40, ₱16,201→₱10,800).

## Scoring rules implemented (summary)

**Layer 1 — Business Gate** (team-level multiplier, applied to every agent's bonus): weighted average of 4 metrics, each graded into a tier (Exceptional=1.15, Green=1.0, Amber=0.7, Red=0.5): Client Avg Wait Time (35%), Team Processing Time (30%), Chat Team Avg Response (20%), Team Ticket AHT (15%). Multiplier is clamped to [0.50, 1.15].

**Layer 2 — Individual Scorecard** (0–3 scale): App AHT–FD (35%), Email AHT incl. KYB (25%), Chat Avg Response (15%), Chat FRT (10%), CSAT/DSAT (10%), QA Audits (5%). Each metric grades 0–3 against its own threshold table; missing metrics are excluded and the remaining weights renormalized (not scored as 0).

**Penalties** (Disciplinary + Attendance) subtract directly from the individual score, before the gate multiplier; the result is floored at 0.

**Bonus**: final score → bonus bracket (₱ amount, KYC department) → × Business Gate multiplier → + ₱1,350 flat if Top-1 agent for the period. Bonus payout requires tenure eligibility (6 months + completed quarter) — not verifiable from the source PDFs, so it's tracked as an explicit flag rather than assumed silently.

**Layer 3 — QA/Automation Roadmap** is not a live scoring mechanism yet (reproduced as a roadmap page, per the source document).

## Getting started

```bash
npm install
npm run dev       # http://localhost:3000
npm run test       # vitest — scoring engine unit tests
npm run verify:scoring   # standalone sanity script, zero test-framework deps
npm run build      # production build
```

The app runs with **zero environment variables** out of the box, using an in-memory data store seeded from the source report (17 agents, September 2026). See "Data persistence" below before relying on this for anything beyond evaluation/demo.

## Data architecture

Raw imported data and calculated results are kept strictly separate:

```
Raw performance data (agents, periods, per-agent metrics, penalties)
        ↓
Scoring engine  (src/lib/scoring — pure functions, framework-agnostic)
        ↓
Calculated score / gate multiplier / bonus  (always derived, never stored)
        ↓
Dashboard
```

Scores are **never** persisted — every page computes them fresh from raw data via `src/lib/data/query.ts`. This means a future scoring-rule change takes effect everywhere immediately, with no backfill migration.

- `src/lib/scoring/` — the scoring engine (`thresholds.ts` for every rule, `individualScore.ts`, `businessGate.ts`, `bonus.ts`, `penalties.ts`, `notes.ts` for documented assumptions).
- `src/lib/data/repository.ts` — a `DataRepository` interface with two implementations:
  - `localRepository.ts` — in-memory, seeded from `src/lib/data/seed/*`. Zero-config default. **Not durable** — resets on cold start/redeploy.
  - `supabaseRepository.ts` — Postgres via Supabase, used automatically once `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.
- `supabase/schema.sql` — run once against a new Supabase project for durable storage (agents, teams, periods, performance_entries, gate_metrics, penalties, imports, import_rows, audit_logs — RLS enabled, anon read-only, writes via service-role key in API routes only).

### Switching to durable storage

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example`).
4. Redeploy. The app detects the env vars and switches repositories automatically — no code changes.

## Login & access control

General browsing needs no account at all — anyone with the link can open the Dashboard, Team Performance, Rankings, Scorecards, Trends, QA/Quality, Penalties (viewing), Reports (viewing), and Settings. Two narrower things still require a password, for two different reasons:

**Leads/Managers sign in** (`/login`, username = email, one shared `LEAD_SHARED_PASSWORD`) to unlock actions that change or export data: Data Import (PDF upload + manual entry), recording a penalty, and downloading a Reports export. `src/middleware.ts` only gates these specific paths — everything else passes through with no session at all. The roster mapping each email to a role lives in `src/lib/auth/roster.ts`. The Lead session is a signed cookie (`src/lib/auth/session.ts`) that clears when the browser closes.

**Viewing one agent's QA Audit result and their penalty entries** requires the shared `AGENT_SHARED_PASSWORD` — entered inline, right on that agent's Scorecard page (`src/lib/auth/recordUnlock.ts`), not a real sign-in. Entering it unlocks *that one agent's* record only, for the rest of the browser session — unlocking Abigael's QA Audit doesn't also reveal Yuri's, since the shared password only proves "someone on the team is asking," not who they are. Leads/Managers see every agent's QA Audit and penalties automatically, with no prompt. This same restriction is enforced on the Rankings recognition board (a locked agent's QA Audit cell shows "Locked" instead of a value) and on the Reports export (which requires a Lead session anyway).

Set real values for `AGENT_SHARED_PASSWORD`, `LEAD_SHARED_PASSWORD`, and `AUTH_SECRET` in Vercel (see `.env.example`) — the built-in fallbacks only exist so the app still works with zero configuration in local/demo mode.

## PDF Data Import

**Settings → Data Import** accepts the same "Daily/Monthly KYC Team Performance Report" PDF layout. It does **not** parse raw text linearly — `src/lib/data/pdfImportParser.ts` reconstructs table rows/columns from each text item's (x, y) position (via `pdfjs-dist`), which is far more robust against PDF text-extraction reordering than line-splitting. This was verified end-to-end against the actual PDF supplied for this project (`scripts/verify-pdf-import.ts`) — it reconstructs every value exactly, with zero failed/unmatched rows.

Workflow: upload → parse → **preview with per-row status** (extracted / needs review / failed) → confirm → commit. Nothing is written to storage until the explicit confirm step; failed rows are excluded automatically and reported, never silently dropped.

## Testing

- `src/lib/scoring/__tests__/*.test.ts`, `src/lib/data/__tests__/time.test.ts` — Vitest unit tests: boundary values (exactly-at-threshold and just-above/below for every metric), missing-data renormalization, penalty flooring, gate-multiplier boundaries (all-Exceptional, all-Red, the framework's own gate-multiplier worked example), bonus-bracket boundaries, Top-1 bonus timing.
- `scripts/verify-scoring.ts` — a standalone, dependency-free sanity script (`npm run verify:scoring`) that exercises the whole engine against the real seeded roster and asserts the same invariants — useful in any environment where installing the full test toolchain isn't possible.
- `scripts/verify-pdf-import.ts` — end-to-end validation of the PDF parser against the actual source PDF.

> **Note on this build environment:** this project was built in a sandboxed environment with outbound access restricted to a small allowlist (no npm registry access), so `npm install` / `npm run build` could not be executed here. Every file was written to compile cleanly (verified with a full-repo esbuild syntax pass and an import-resolution pass across all 70+ source files), and the scoring engine + PDF parser were validated for real using `tsx` (no bundler required) against a globally-available TypeScript/Node toolchain and the actual source PDF. Run `npm install && npm run build` in a normal environment (or let Vercel do it) to get the final confirmation.

## Deploying to Vercel

This is a standard Next.js 14 App Router project — no special configuration needed:

1. Push to GitHub (or your Git provider).
2. Import the repo in Vercel.
3. Leave environment variables unset for the zero-config demo mode, or set the Supabase variables above for durable storage.
4. Deploy.

## Project structure

```
src/
  app/                    routes (Dashboard, Team Performance, Scorecards, Rankings,
                           Trends, Penalties, QA/Quality, Reports, Data Import, Settings)
  components/
    ui/                   hand-rolled shadcn-style primitives (button, card, table, …)
    layout/                Sidebar, TopHeader, MobileNav
    dashboard/              KpiCard, PerformanceBadge (grade/tier badges)
    scorecard/               ScoreBreakdown, CalculationDetails, PenaltyForm, AgentSearch
    rankings/                 RankingTable
    charts/                    TrendChart, MetricBarChart (recharts)
    shared/                    EmptyState, LoadingState, ErrorState, ImportWorkflow, …
  lib/
    scoring/                the scoring engine (see above)
    data/                    repository, query layer, seed data, time parsing, PDF parser
  types/domain.ts           Agent / Team / Period / Import types
supabase/schema.sql       Postgres schema for durable persistence
scripts/                  standalone verification scripts (no test framework needed)
```

## What's intentionally not here

- The reference app's roster, scores, branding, and music player — not carried over, per the brief.
- Multiple departments/teams — the source data only defines one ("KYC"); the filter UI supports more, there's just one value today.
- Fabricated historical trend data — only one reporting period was supplied; Trends will populate as more periods are imported.
