"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Megaphone, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { PasswordGate } from "@/components/shared/PasswordGate";
import { ROSTER } from "@/lib/auth/roster";
import type { Announcement } from "@/lib/data/announcements";

const LEADS = ROSTER.filter((r) => r.role === "lead");
const MAX_LENGTH = 2000;
const AUTHOR_STORAGE_KEY = "kyc-announcement-author";

function readRememberedAuthor(): string {
  try {
    const saved = window.localStorage.getItem(AUTHOR_STORAGE_KEY);
    if (saved && LEADS.some((l) => l.name === saved)) return saved;
  } catch {
    // storage blocked -- use the default
  }
  return LEADS[0]?.name ?? "";
}

/** Asks the server whether this browser has already entered the shared
 *  Lead/Manager password (the cookie is httpOnly, so it can't be read from
 *  JS). Re-checks whenever the page data refreshes, so "Log out as
 *  Lead/Auditor" in the sidebar hides the controls again. */
function useUnlocked(refreshKey: unknown) {
  const [unlocked, setUnlocked] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/action-access")
      .then((res) => res.json())
      .then((data: { unlocked?: boolean }) => {
        if (!cancelled) setUnlocked(Boolean(data.unlocked));
      })
      .catch(() => {
        if (!cancelled) setUnlocked(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  return [unlocked, setUnlocked] as const;
}

/** The "Post an update" form. Only ever mounted inside a PasswordGate, so
 *  reaching this component at all means the password was accepted. */
function PostUpdateCard({ onUnlocked }: { onUnlocked: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [author, setAuthor] = React.useState(LEADS[0]?.name ?? "");
  const [text, setText] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    onUnlocked();
  }, [onUnlocked]);

  React.useEffect(() => {
    setAuthor(readRememberedAuthor());
  }, []);

  async function handlePost() {
    if (posting) return;
    setError(null);
    if (!text.trim()) {
      setError("Write the update first.");
      return;
    }
    setPosting(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, text }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Couldn't post the update.");
        return;
      }
      try {
        window.localStorage.setItem(AUTHOR_STORAGE_KEY, author);
      } catch {
        // a convenience only
      }
      setText("");
      showToast("Update posted — it will show in the pop-up when people open the app.", "success");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-4 w-4" /> Post an update
        </CardTitle>
        <CardDescription>
          Everyone sees the 3 newest updates in a pop-up they have to read and close when they open the app. Updates sent from the
          Teams chat appear here too.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Posted by</label>
          <Select value={author} onChange={(e) => setAuthor(e.target.value)} disabled={posting}>
            {LEADS.map((l) => (
              <option key={l.email} value={l.name}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Update</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={MAX_LENGTH}
            disabled={posting}
            placeholder="Write the announcement…"
            className="w-full rounded-md border border-input bg-card p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {text.length}/{MAX_LENGTH}
          </p>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Button onClick={handlePost} disabled={posting}>
          {posting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Posting…
            </>
          ) : (
            "Post update"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function AnnouncementsManager({ items, loadError }: { items: Announcement[]; loadError: string | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [unlocked, setUnlocked] = useUnlocked(items);
  const [showUnlock, setShowUnlock] = React.useState(false);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const markUnlocked = React.useCallback(() => {
    setUnlocked(true);
    setShowUnlock(false);
  }, [setUnlocked]);

  // If the password is no longer valid (e.g. "Log out as Lead/Auditor"),
  // put the page back to the read-only view.
  React.useEffect(() => {
    if (!unlocked) setConfirmId(null);
  }, [unlocked]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/announcements/${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showToast(body.error ?? "Couldn't delete the update.", "error");
        return;
      }
      showToast("Update removed.", "success");
      setConfirmId(null);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unexpected error.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {unlocked || showUnlock ? (
        <div className="space-y-2">
          <PasswordGate description="Enter the shared Lead/Manager password to post or remove updates.">
            <PostUpdateCard onUnlocked={markUnlocked} />
          </PasswordGate>
          {!unlocked && (
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={() => setShowUnlock(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">Leads and Managers can post or remove updates here.</p>
          <Button variant="outline" size="sm" onClick={() => setShowUnlock(true)}>
            <Lock className="h-3.5 w-3.5" /> Lead / Manager: post an update
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent updates</CardTitle>
          <CardDescription>Newest first. The top 3 are what the pop-up shows.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="text-sm text-danger">{loadError}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No updates yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((a, i) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{a.author}</span>
                      <span>{new Date(a.postedAt).toLocaleString()}</span>
                      <Badge variant={a.source === "teams" ? "primary" : "default"}>{a.source === "teams" ? "From Teams" : "Posted here"}</Badge>
                      {i < 3 && <Badge variant="success">In the pop-up</Badge>}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground">{a.text}</p>
                  </div>
                  {unlocked && (
                    <div className="flex-shrink-0">
                      {confirmId === a.id ? (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="danger" disabled={deletingId === a.id} onClick={() => handleDelete(a.id)}>
                            {deletingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
                          </Button>
                          <Button size="sm" variant="outline" disabled={deletingId === a.id} onClick={() => setConfirmId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="text-danger hover:text-danger" onClick={() => setConfirmId(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
