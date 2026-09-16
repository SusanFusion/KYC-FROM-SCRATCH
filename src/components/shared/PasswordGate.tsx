"use client";

import * as React from "react";
import { Lock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ActionAccessStatus = "checking" | "locked" | "unlocked";

/** The action-access cookie is httpOnly (can't be read from JS by design,
 *  same as the login session cookie), so this has to ask the server
 *  whether this browser is already unlocked rather than checking a cookie
 *  value itself — see /api/auth/action-access/route.ts. Only PasswordGate
 *  below uses this, so it lives here rather than its own file. */
function useActionAccess() {
  const [status, setStatus] = React.useState<ActionAccessStatus>("checking");

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/action-access")
      .then((res) => res.json())
      .then((data: { unlocked?: boolean }) => {
        if (!cancelled) setStatus(data.unlocked ? "unlocked" : "locked");
      })
      .catch(() => {
        if (!cancelled) setStatus("locked");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function unlock(password: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch("/api/auth/action-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setStatus("unlocked");
        return { ok: true };
      }
      return { ok: false, error: data.error ?? "Incorrect password." };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Unexpected error." };
    }
  }

  return { status, unlock };
}

/**
 * Hides its children behind a password prompt until the shared
 * Lead/Manager password (the same one /login already uses) has been
 * entered in this browser — the UI half of the action-access checkpoint.
 * The real enforcement is server-side (see requireActionAccess() in
 * @/lib/auth/actionAccess.ts, called by every route this gate's children
 * end up calling); this component only avoids showing someone a form they
 * can't actually submit.
 *
 * Once unlocked, stays unlocked for this browser for
 * ACTION_ACCESS_LIFETIME_SECONDS (12h) — no need to re-check on every
 * render, /api/auth/action-access is only asked once on mount.
 */
export function PasswordGate({
  children,
  title = "Password required",
  description,
}: {
  children: React.ReactNode;
  title?: string;
  description: string;
}) {
  const { status, unlock } = useActionAccess();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  if (status === "unlocked") return <>{children}</>;

  // "checking" briefly reserves the same shape as the locked card so the
  // page doesn't visibly pop between the two on the very first render.
  const checking = status === "checking";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    const result = await unlock(password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Incorrect password.");
      setPassword("");
    }
  }

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader className="items-center text-center">
        <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br from-primary-500 to-primary-700 text-primary-foreground shadow-sm shadow-primary-500/30">
          <Lock className="h-5 w-5" />
        </span>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input
            type="password"
            autoComplete="off"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={checking || submitting}
            autoFocus
            required
          />
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-2.5 text-xs text-danger">
              <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={checking || submitting || !password}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Checking…
              </>
            ) : (
              "Unlock"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
