"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Announcement } from "@/lib/data/announcements";

// "Opening the app" = the first page load in a browser tab. A refresh or
// moving around the app doesn't count; a new tab or window does. (Kept per
// tab on purpose: closing the tab and coming back later is a fresh start.)
const SESSION_KEY = "kyc-startup-done";

/**
 * What happens when the app is opened:
 *  1. Wherever the link pointed, the app starts on the Dashboard.
 *  2. If there are KYC Updates, a pop-up with the 3 newest is shown. It can't
 *     be dismissed with Esc or by clicking outside, and everything behind it
 *     is locked, so it has to be read and closed with the button before
 *     anyone can navigate the app.
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

  React.useEffect(() => {
    let alreadyStarted = false;
    try {
      alreadyStarted = window.sessionStorage.getItem(SESSION_KEY) === "1";
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // storage blocked -- treat every load as a start
    }
    if (alreadyStarted) return;

    if (pathname !== "/") router.replace("/");

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
    // Runs once, on the first load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
