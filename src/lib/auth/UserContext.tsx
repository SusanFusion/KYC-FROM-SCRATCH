"use client";

import * as React from "react";
import type { SessionPayload } from "./session";

const UserContext = React.createContext<SessionPayload | null>(null);

/** Makes the already-verified session (read once, server-side, in the root
 *  layout) available to client components like Sidebar — no extra fetch,
 *  no re-verifying the cookie on the client. */
export function UserProvider({ user, children }: { user: SessionPayload | null; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCurrentUser(): SessionPayload | null {
  return React.useContext(UserContext);
}
