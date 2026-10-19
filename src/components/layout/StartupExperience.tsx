"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Announcement } from "@/lib/data/announcements";

// The pop-up is tied to three pages: the Dashboard, Individual Scorecards
// (the list and any agent's scorecard) and Overall MTD. It shows each time
// someone MOVES to one of them from another part of the app, and when the
// app is opened. Staying inside the same page group (e.g. switching from one
// agent's scorecard to another's) or refreshing the page doesn't count as
// moving, so it isn't shown again. Both keys are kept per tab on purpose.
const STARTED_KEY = "kyc-startup-done";
const AREA_KEY = "kyc-updates-last-area";
const POPUP_AREAS = new Set(["dashboard", "scorecards", "mtd"]);

/** Which part of the app a path belongs to: "/" is the dashboard, everything
 *  else is named after its first segment ("/scorecards/abc" -> "scorecards"). */
function areaOf(pathname: string | null): string {
  const first = (pathname ?? "/").split("/").filter(Boolean)[0];
  return first ? first : "dashboard";
}

/**
 * What happens around the KYC Updates:
 *  1. Opening the app in a new tab always starts on the Dashboard.
 *  2. If there are KYC Updates, a pop-up with the 3 newest is shown whenever
 *     someone arrives on the Dashboard, Individual Scorecards or Overall MTD.
 *     It can't be dismissed with Esc or by clicking outside, and everything
 *     behind it is locked, so it has to be read and closed with the button.
 * Mounted once in AppShell (never on the login page).
 */
export function StartupExperience() {
  const pathname = usePathname();
  const router = useRouter();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [items, setItems] = React.useState<Announcement[]>([]);
  const [open, setOpen] = React.useState(false);
  const openRef = React.useRef(false);
  openRef.current = open;

  const startedRef = React.useRef(false);
  const lastAreaRef = React.useRef<string | null>(null);

  function showUpdates() {
    if (openRef.current) return;
    fetch("/api/announcements", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { announcements?: Announcement[] } | null) => {
        if (data && Array.isArray(data.announcements) && data.announcements.length > 0) {
          setItems(data.announcements);
          setOpen(true);
        }
      })
      .catch(() => {
        // no pop-up if the updates can't be loaded -- never block the app on it
      });
  }

  React.useEffect(() => {
    const area = areaOf(pathname);

    if (!startedRef.current) {
      startedRef.current = true;
      let firstLoadInTab = true;
      try {
        firstLoadInTab = window.sessionStorage.getItem(STARTED_KEY) !== "1";
        window.sessionStorage.setItem(STARTED_KEY, "1");
        // A refresh keeps the tab's last page group, so it isn't "moving".
        lastAreaRef.current = firstLoadInTab ? null : window.sessionStorage.getItem(AREA_KEY);
      } catch {
        // storage blocked -- treat every load as a start
      }
      // Wherever the link pointed, a new tab starts on the Dashboard. The
      // redirect changes the path, which runs this effect again for "/".
      if (firstLoadInTab && pathname !== "/") {
        router.replace("/");
        return;
      }
    }

    const arrived = area !== lastAreaRef.current;
    lastAreaRef.current = area;
    try {
      window.sessionStorage.setItem(AREA_KEY, area);
    } catch {
      // ignore
    }
    if (arrived && POPUP_AREAS.has(area)) showUpdates();
    // showUpdates only uses refs and state setters, so it's safe to leave out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (items.length === 0) return null;

  return (
    <dialog
      ref={dialogRef}
      // Esc would normally close a modal <dialog>; here it must not. Browsers
      // only let the first Esc be cancelled (a second press in a row closes it
      // regardless), so if it does get closed without the button, reopen it.
      onCancel={(e) => e.preventDefault()}
      onClose={() => {
        if (openRef.current) dialogRef.current?.showModal();
      }}
      aria-labelledby="kyc-updates-title"
      className="m-auto max-h-[90vh] w-[min(640px,92vw)] overflow-hidden rounded-xl border border-border bg-card p-0 text-card-foreground shadow-popover backdrop:bg-foreground/50 open:animate-slide-up"
    >
      <div className="flex max-h-[90vh] flex-col">
        <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-5">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-600 text-white shadow-md shadow-primary/30">
            <Megaphone className="h-5 w-5" />
          </span>
          <div>
            <h2 id="kyc-updates-title" className="text-base font-semibold">
              KYC Updates
            </h2>
            <p className="text-sm text-muted-foreground">
              The latest {items.length === 1 ? "update" : `${items.length} updates`} from the team — please read before you continue.
            </p>
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          {items.map((a, i) => (
            <article key={a.id} className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="text-sm font-semibold text-foreground">{a.author}</span>
                <span>{new Date(a.postedAt).toLocaleString()}</span>
                {i === 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Newest
                  </span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{a.text}</p>
            </article>
          ))}
        </div>

        <div className="flex justify-end border-t border-border p-4">
          <Button autoFocus onClick={() => setOpen(false)}>
            I&apos;ve read this — continue
          </Button>
        </div>
      </div>
    </dialog>
  );
}
