"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Minimal CSS-only tooltip — no extra runtime dependency. */
export function Tooltip({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 scale-95 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background opacity-0 shadow-popover transition-all duration-150 group-hover:scale-100 group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
