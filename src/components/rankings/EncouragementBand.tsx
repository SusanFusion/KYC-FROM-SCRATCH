import Link from "next/link";
import { Sprout } from "lucide-react";

export interface EncouragementAgent {
  agentId: string;
  name: string;
  department: string;
  score: number;
}

// Deliberately not phrased around "last place" or "worst" — these three
// agents are simply this period's biggest opportunity to climb, and the
// copy throughout this component treats it that way.
const PHRASES = [
  "Every top performer started exactly here — keep building.",
  "Small, steady improvements this period add up to a big leap next.",
  "Progress over perfection — you're closer than the score shows.",
  "One focused metric at a time. You've got this next period.",
  "Consistency beats a perfect week. Stay the course.",
  "This is a snapshot, not the whole story — onward and upward.",
];

/** Deterministic per agent (not random on every page load) so the same
 *  person sees the same encouraging line each time they check. */
function pickPhrase(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) hash = (hash * 31 + agentId.charCodeAt(i)) >>> 0;
  return PHRASES[hash % PHRASES.length]!;
}

/**
 * A gentle, encouraging callout for this period's 3 lowest scores — placed
 * at the very bottom of the Rankings page, after the full table. Uses cool,
 * light blues rather than a "danger" red so it reads as supportive, not
 * punitive; no bottom-3 label or rank number is shown, just the person,
 * their score, and a rotating motivational line.
 */
export function EncouragementBand({ agents }: { agents: EncouragementAgent[] }) {
  if (agents.length === 0) return null;

  return (
    <section className="rounded-xl border border-sky-100 bg-gradient-to-b from-sky-50/70 to-transparent p-5 shadow-card sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Sprout className="h-4 w-4 text-sky-600" />
        <h2 className="text-sm font-semibold text-foreground">Room to Grow</h2>
      </div>
      <p className="mb-5 text-xs text-muted-foreground">
        Every period is a fresh start — here&apos;s where the biggest opportunity is to climb next time.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {agents.map((a) => (
          <Link
            key={a.agentId}
            href={`/scorecards/${a.agentId}`}
            className="flex flex-col rounded-lg border border-sky-100 bg-white/70 p-4 shadow-card transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{a.name}</span>
              <span className="text-sm font-semibold text-sky-700">{a.score.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{a.department}</p>
            <p className="mt-2 text-xs italic leading-relaxed text-sky-800/80">&ldquo;{pickPhrase(a.agentId)}&rdquo;</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
