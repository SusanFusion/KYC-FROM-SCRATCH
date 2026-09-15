// Single source of truth for the product name. Change NEXT_PUBLIC_APP_NAME
// in your environment (see .env.example) to rebrand the app everywhere —
// no other file needs to change.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "KYC Team Performance";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" as const },
  { href: "/team-performance", label: "Team Performance", icon: "Users" as const },
  { href: "/scorecards", label: "Individual Scorecards", icon: "IdCard" as const },
  { href: "/rankings", label: "Rankings", icon: "Trophy" as const },
  { href: "/trends", label: "Trends", icon: "TrendingUp" as const },
  { href: "/mtd", label: "Overall MTD", icon: "CalendarDays" as const },
  { href: "/penalties", label: "Penalties", icon: "ShieldAlert" as const },
  { href: "/qa-quality", label: "QA / Quality", icon: "BadgeCheck" as const },
  { href: "/reports", label: "Reports", icon: "FileBarChart" as const },
  { href: "/import", label: "Data Import", icon: "UploadCloud" as const },
  { href: "/settings", label: "Settings", icon: "Settings" as const },
];
