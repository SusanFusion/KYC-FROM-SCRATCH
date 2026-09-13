import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/toast";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { APP_NAME } from "@/lib/appConfig";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "KYC team performance, individual scorecards, and rankings — driven by the KYC KPI Realignment Framework.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <ToastProvider>
          <AppShell user={user}>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
