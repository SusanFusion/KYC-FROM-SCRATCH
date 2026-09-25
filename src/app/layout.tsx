import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/toast";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { APP_NAME } from "@/lib/appConfig";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "KYC team performance, individual scorecards, and rankings — driven by the KYC KPI Realignment Framework.",
};

// Runs before React hydrates, so a returning visitor who chose dark mode
// never sees a flash of the light theme first. It only ever ADDS the
// "dark" class (light is the default — see theme-toggle.tsx) and never
// throws even if localStorage is unavailable (private browsing, blocked
// site data, etc.).
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    // suppressHydrationWarning: the script below can add "dark" to this
    // element before React hydrates, which would otherwise make React warn
    // about a class mismatch between the server-rendered and live DOM.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <ToastProvider>
          <AppShell user={user}>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
