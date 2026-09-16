// Single source of truth for the app's shared team passwords.
//
// Originally these only gated /login (identifying who's signed in as an
// Agent vs a Lead/Manager). Now that browsing the app no longer requires
// signing in at all (see middleware.ts — the blanket "every page needs a
// session" gate was removed), LEAD_PASSWORD does double duty: it's also
// what the action-access checkpoint (actionAccess.ts) checks before
// letting anyone import data, submit QA Audit numbers, or export a report
// — the few actions that actually change or leave with the team's data.
// Reusing the existing Lead/Manager password instead of inventing a
// separate secret means there's still only one password to hand out and
// rotate, and "the lead password" already means "allowed to change the
// team's data" everywhere else in this app.
//
// Real values come from these env vars in Vercel; the fallbacks only exist
// so the app still runs zero-config in local/demo mode (same philosophy as
// the LocalRepository data fallback). See .env.example.
export const AGENT_PASSWORD = process.env.AGENT_SHARED_PASSWORD || "KYCAgent#2026";
export const LEAD_PASSWORD = process.env.LEAD_SHARED_PASSWORD || "KYCLead#2026";
