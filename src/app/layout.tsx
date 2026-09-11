import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { APP_NAME } from "@/lib/appConfig";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "KYC team performance, individual scorecards, and rankings — driven by the KYC KPI Realignment Framework.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <div className="flex min-h-screen">
          <div className="hidden lg:block">
            <div className="fixed inset-y-0 left-0 z-40">
              <Sidebar />
            </div>
          </div>
          <div className="flex min-h-screen w-full flex-1 flex-col lg:pl-64">{children}</div>
        </div>
      </body>
    </html>
  );
}
