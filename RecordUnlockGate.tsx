"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Shown in place of an agent's QA Audit metric / penalty details when the
 * viewer hasn't unlocked this specific agent's record yet. Entering the
 * shared team password unlocks THIS agent only, for the rest of the
 * browser session — see recordUnlock.ts.
 */
export function RecordUnlockGate({ agentId, agentName }: { agentId: string; agentName: string }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/auth/unlock-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Incorrect password.");
        setStatus("error");
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <div className="flex items-start gap-2">
        <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            QA Audit and penalty details for {agentName} are hidden
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Enter the team password to view — this unlocks {agentName}&apos;s record only, for the rest of this
            browsing session.
          </p>
          <form onSubmit={handleSubmit} className="mt-2.5 flex flex-wrap items-center gap-2">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Team password"
              className="h-8 w-40"
              required
            />
            <Button type="submit" size="sm" disabled={status === "loading"}>
              {status === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Unlock"}
            </Button>
          </form>
          {status === "error" && error && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-danger">
              <XCircle className="h-3 w-3" /> {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
