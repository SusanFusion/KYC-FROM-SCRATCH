-- KYC From Scratch — Supabase schema
-- Run this once against a new Supabase project, then set
-- NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
-- SUPABASE_SERVICE_ROLE_KEY per .env.example to switch the app from the
-- built-in local/demo store to durable persistence.
--
-- Design principle: raw imported data and calculated results are kept in
-- separate concerns. Only raw numbers are ever written here — scores, gate
-- multipliers, tiers and bonuses are always derived at read time by
-- src/lib/scoring, never stored, so a rule change doesn't require a
-- backfill migration.

create table if not exists teams (
  id text primary key,
  name text not null
);

create table if not exists agents (
  id text primary key,
  name text not null,
  team_id text not null references teams(id),
  department text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  tenure_eligible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists periods (
  id text primary key,
  label text not null,
  type text not null check (type in ('daily', 'weekly', 'monthly', 'month-to-date', 'custom')),
  start_date date not null,
  end_date date not null,
  generated_at date not null
);

-- Raw individual-scorecard inputs (Layer 2). One row per agent per period.
create table if not exists performance_entries (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references agents(id),
  period_id text not null references periods(id),
  total_chat_conversations integer,
  avg_first_response_time_sec numeric,
  avg_response_time_sec numeric,
  email_aht_sec numeric,
  app_aht_sec numeric,
  total_chats integer,
  csat_count integer,
  dsat_count integer,
  qa_audit_pct numeric,
  unique (agent_id, period_id)
);

-- Raw team-level Business Gate inputs (Layer 1). One row per period.
create table if not exists gate_metrics (
  id uuid primary key default gen_random_uuid(),
  period_id text not null unique references periods(id),
  client_avg_wait_time_min numeric,
  team_processing_time_min numeric,
  chat_team_avg_response_sec numeric,
  team_ticket_aht_min numeric
);

-- Disciplinary + Attendance penalty records (deductions, not scores).
create table if not exists penalties (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references agents(id),
  period_id text not null references periods(id),
  code text not null,
  count integer not null default 1,
  note text,
  occurred_on date not null,
  created_at timestamptz not null default now()
);

-- PDF Data Import audit trail.
create table if not exists imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  uploaded_at timestamptz not null default now(),
  period_label text,
  status text not null default 'pending_review' check (status in ('pending_review', 'committed', 'failed')),
  row_count integer not null default 0,
  committed_at timestamptz
);

create table if not exists import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references imports(id) on delete cascade,
  agent_name_raw text not null,
  matched_agent_id text references agents(id),
  metric_key text not null,
  raw_value text not null,
  parsed_value numeric,
  status text not null check (status in ('extracted', 'needs_review', 'failed')),
  note text
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- QA Audit forms (Applications / Emails / Chats) — see
-- src/lib/qa/auditDefinitions.ts. Confidential: answers and overall_remarks
-- must never be readable by the anon key, which is why there is NO "public
-- read" policy for this table below (unlike every other table in this
-- file) — every app route that reads it uses the service-role client,
-- guarded by the same shared Lead/Manager password as Data Import
-- (requireActionAccess). Publishing an audit does not write into this
-- table at all — it blends this audit's percentage with any other
-- published audits for the same agent+period and writes that number into
-- performance_entries.qa_audit_pct via the existing commit path, so this
-- table only ever needs to be read back for the QA Quality page's own
-- history/detail view and PDF export.
create table if not exists qa_audits (
  id uuid primary key default gen_random_uuid(),
  audit_type text not null check (audit_type in ('applications', 'emails', 'chats')),
  agent_id text not null references agents(id),
  agent_name text not null,
  period_id text not null references periods(id),
  period_label text not null,
  auditor_email text not null,
  auditor_name text not null,
  case_reference text,
  audit_date date not null,
  answers jsonb not null default '[]'::jsonb,
  overall_remarks text,
  applicable_points integer not null default 0,
  total_points integer not null default 0,
  percentage numeric,
  auto_fail boolean not null default false,
  band integer,
  status text not null default 'submitted' check (status in ('submitted', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_qa_audits_agent_period on qa_audits(agent_id, period_id);
create index if not exists idx_qa_audits_type on qa_audits(audit_type);

create index if not exists idx_performance_entries_period on performance_entries(period_id);
create index if not exists idx_penalties_agent_period on penalties(agent_id, period_id);
create index if not exists idx_import_rows_import on import_rows(import_id);

-- Row Level Security — enable and allow read-only anon access; writes go
-- through server-side API routes using the service-role key.
alter table teams enable row level security;
alter table agents enable row level security;
alter table periods enable row level security;
alter table performance_entries enable row level security;
alter table gate_metrics enable row level security;
alter table penalties enable row level security;
alter table imports enable row level security;
alter table import_rows enable row level security;
alter table audit_logs enable row level security;
alter table qa_audits enable row level security;

create policy "public read teams" on teams for select using (true);
create policy "public read agents" on agents for select using (true);
create policy "public read periods" on periods for select using (true);
create policy "public read performance_entries" on performance_entries for select using (true);
create policy "public read gate_metrics" on gate_metrics for select using (true);
create policy "public read penalties" on penalties for select using (true);
create policy "public read imports" on imports for select using (true);
create policy "public read import_rows" on import_rows for select using (true);
-- audit_logs and all writes are intentionally left with no anon policy —
-- only the service-role key (server-side only) can write.
-- qa_audits also intentionally has NO anon read policy at all — see the
-- confidentiality note above the table definition.
