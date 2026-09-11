import type { Agent } from "../../../types/domain";

// Roster transcribed from the Daily KYC Team Performance Report (the union
// of every agent name appearing across its four tables — 17 unique agents).
// Tenure (6-months-eligibility) was not supplied by either PDF, so every
// agent defaults to tenure-eligible=true with that gap flagged in
// scoring/notes.ts rather than guessed per-agent.
export const SEED_AGENTS: Agent[] = [
  { id: "abigael-callos", name: "Abigael Callos", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "aimee-hicana", name: "Aimee Hicana", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "alain-sebastian", name: "Alain Sebastian", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "angeline-amamio", name: "Angeline Amamio", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "earl-insierto", name: "Earl Insierto", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "evangeline-de-ocampo", name: "Evangeline De Ocampo", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "hans-nicole-diaz", name: "Hans Nicole Diaz", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "jay-ann-oteros", name: "Jay-Ann Oteros", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "jenieme-antong", name: "Jenieme Antong", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "jessamae-candongo", name: "Jessamae Candongo", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "katrina-carungui", name: "Katrina Carungui", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "lailani-palle", name: "Lailani Palle", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "maria-patrisha-lopez", name: "Maria Patrisha Lopez", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "michelle-barcelona", name: "Michelle Barcelona", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "patricia-marie-cruz", name: "Patricia Marie Cruz", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "yuri-bulahan", name: "Yuri Bulahan", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
  { id: "yvonne-tang", name: "Yvonne Tang", teamId: "kyc", department: "KYC", status: "active", tenureEligible: true, createdAt: "2026-01-01" },
];
