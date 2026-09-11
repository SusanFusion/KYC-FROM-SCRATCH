import type { Team } from "../../../types/domain";

// The source PDFs only ever name one department/team: "KYC" (see the
// Individual Bonus Bracket table). Additional teams can be added here once
// the organization defines them — filtering UI is already wired for it.
export const SEED_TEAMS: Team[] = [{ id: "kyc", name: "KYC" }];
