"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { UserProvider } from "@/lib/auth/UserContext";
import type { SessionPayload } from "@/lib/auth/session";

/** Splits the app's chrome (sidebar + nav) from the bare /login page, and
 *  makes the server-verified session available to client components
 *  (Sidebar's "logged in as / log out" widget) via context. */
export function AppShell({ user, children }: { user: SessionPayload | null; children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <UserProvider user={user}>
      {isLoginPage ? (
        children
      ) : (
        <div className="flex min-h-screen">
          <div className="hidden lg:block">
            <div className="fixed inset-y-0 left-0 z-40">
              <Sidebar />
            </div>
          </div>
          <div className="flex min-h-screen w-full flex-1 flex-col lg:pl-64">{children}</div>
        </div>
      )}
    </UserProvider>
  );
}
