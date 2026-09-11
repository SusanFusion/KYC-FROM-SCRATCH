import type { Period } from "../../../types/domain";

// The Daily KYC Team Performance Report (generated 11-09-2026) reports
// "This Month" figures. Only one snapshot was supplied, so it is the only
// seeded period — see notes.ts "single-period-snapshot".
export const CURRENT_PERIOD_ID = "2026-09";

export const SEED_PERIODS: Period[] = [
  {
    id: CURRENT_PERIOD_ID,
    label: "September 2026 (Month-to-Date)",
    type: "month-to-date",
    startDate: "2026-09-01",
    endDate: "2026-09-11",
    generatedAt: "2026-09-11",
  },
];
