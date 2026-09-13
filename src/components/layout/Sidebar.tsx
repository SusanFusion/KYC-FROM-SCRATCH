"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  IdCard,
  Trophy,
  TrendingUp,
  ShieldAlert,
  BadgeCheck,
  FileBarChart,
  UploadCloud,
  Settings,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { NAV_ITEMS, APP_NAME } from "@/lib/appConfig";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/auth/UserContext";

const ICON_MAP = {
  LayoutDashboard,
  Users,
  IdCard,
  Trophy,
  TrendingUp,
  ShieldAlert,
  BadgeCheck,
  FileBarChart,
  UploadCloud,
  Settings,
};

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      onNavigate?.();
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary-500 to-primary-700 text-primary-foreground shadow-sm shadow-primary-500/30">
          <ShieldCheck className="h-4.5 w-4.5" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">{APP_NAME}</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon];
          const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-primary-50 text-primary-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-gradient-to-b from-primary-400 to-primary-600" />
              )}
              <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-primary-600" : "text-muted-foreground group-hover:text-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-border p-4">
        {user && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{user.name}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {user.role === "lead" ? "Lead / Manager" : "KYC Officer"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              {loggingOut ? "…" : "Log out"}
            </button>
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Scores derived from the KYC KPI Realignment Framework. See Settings → Data Notes for assumptions.
        </p>
      </div>
    </div>
  );
}
