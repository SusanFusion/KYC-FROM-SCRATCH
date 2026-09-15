"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

export interface RangeOption {
  value: string;
  label: string;
}

/**
 * A single reusable dropdown for "which week/month am I looking at",
 * driven entirely by a URL search param so the choice survives a refresh
 * and is shareable/bookmarkable — used by Team Performance and Trends
 * (paramName="week") and the Overall MTD tab (paramName="month").
 */
export function RangePicker({
  paramName,
  options,
  current,
}: {
  paramName: string;
  options: RangeOption[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={current} onChange={handleChange} aria-label="Select date range">
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
  );
}
