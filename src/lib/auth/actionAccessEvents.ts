// A tiny browser-side signal so every part of the page that cares about the
// shared Lead/Manager password (the sidebar's "Log out as Lead/Auditor"
// button, every PasswordGate, the Announcements page) finds out straight
// away when it is entered or cleared -- without a page reload.
//
// The password itself lives in an httpOnly cookie that JavaScript can't
// read, so listeners react to this event by asking the server
// (GET /api/auth/action-access) what the real state is.
export const ACTION_ACCESS_EVENT = "kyc-action-access-changed";

export function notifyActionAccessChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ACTION_ACCESS_EVENT));
}
