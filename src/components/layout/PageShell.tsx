import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>;
}
