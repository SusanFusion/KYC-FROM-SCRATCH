"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { NAV_ITEMS, APP_NAME } from "@/lib/appConfig";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
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
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-50 text-primary-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-primary-600" : "text-muted-foreground group-hover:text-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Scores derived from the KYC KPI Realignment Framework. See Settings → Data Notes for assumptions.
        </p>
      </div>
    </div>
  );
}
