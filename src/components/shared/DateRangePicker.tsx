"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Two native date inputs that push an arbitrary [start, end] window onto the
 * URL (?mode=range&start=&end=) — the free-form sibling of RangePicker's
 * fixed dropdown, for "just let me pick two dates" instead of a preset
 * week/month list.
 *
 * Always pass the page's already-resolved current start/end (post-fallback,
 * never the raw searchParams), so both inputs are valid the moment this
 * mounts and a change to just one field always has a valid partner value to
 * pair with -- this component never has to guess or reject a partial/empty
 * pair.
 */
export function DateRangePicker({
  currentStart,
  currentEnd,
  min,
  max,
}: {
  currentStart: string;
  currentEnd: string;
  min?: string;
  max?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(start: string, end: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "range");
    params.set("start", start);
    params.set("end", end);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleStartChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nextStart = e.target.value;
    if (!nextStart) return;
    // Keep the pair valid: if the new start would land after the current
    // end, drag the end along with it rather than firing an invalid range.
    navigate(nextStart, nextStart > currentEnd ? nextStart : currentEnd);
  }

  function handleEndChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nextEnd = e.target.value;
    if (!nextEnd) return;
    navigate(nextEnd < currentStart ? nextEnd : currentStart, nextEnd);
  }

  const dateInputClass =
    "h-9 rounded-md border border-input bg-card px-2.5 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={currentStart}
        min={min}
        max={max}
        onChange={handleStartChange}
        aria-label="Start date"
        className={dateInputClass}
      />
      <span className="text-xs text-muted-foreground">to</span>
      <input
        type="date"
        value={currentEnd}
        min={min}
        max={max}
        onChange={handleEndChange}
        aria-label="End date"
        className={dateInputClass}
      />
    </div>
  );
}
