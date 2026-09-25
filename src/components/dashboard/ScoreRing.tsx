"use client";

import * as React from "react";

interface ScoreRingProps {
  /** Current value, 0..max. */
  value: number;
  max?: number;
  /** Outer diameter in px. */
  size?: number;
  strokeWidth?: number;
  tone?: "primary" | "success" | "warning" | "danger";
  /** Small caption under the number, e.g. "out of 3.00". */
  label?: string;
}

/**
 * The dashboard's centerpiece: a big circular gauge that fills in and
 * counts up on load instead of just appearing at its final value — the one
 * deliberately "alive" element on the page. Pure SVG + CSS transitions, no
 * charting library, so it costs nothing extra to ship. Skips the animation
 * (jumps straight to the final state) for prefers-reduced-motion.
 */
export function ScoreRing({ value, max = 3, size = 200, strokeWidth = 14, tone = "primary", label }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(max, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - clamped / max);
  const toneSolid = `hsl(var(--${tone}))`;
  const toneGlow = `hsl(var(--${tone}) / 0.5)`;

  // Starts at "empty" (full offset, 0 displayed) on both server and first
  // client render, then animates to the real value once mounted — see
  // theme-toggle.tsx for why that first identical render matters (it's the
  // same reasoning: no hydration mismatch, just a normal post-mount
  // update).
  const [offset, setOffset] = React.useState(circumference);
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setOffset(targetOffset);
      setDisplayValue(clamped);
      return;
    }

    // One extra frame so the browser paints the "empty" ring first — without
    // it, the very first paint would already be mid-transition and the fill
    // animation would never visibly start from zero.
    const startFrame = requestAnimationFrame(() => setOffset(targetOffset));

    const durationMs = 1100;
    const start = performance.now();
    let countFrame: number;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplayValue(eased * clamped);
      if (t < 1) countFrame = requestAnimationFrame(tick);
    }
    countFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(startFrame);
      cancelAnimationFrame(countFrame);
    };
  }, [targetOffset, clamped]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-90 transition-[filter] duration-500"
        style={{ filter: `drop-shadow(0 0 18px ${toneGlow})` }}
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ stroke: toneSolid }}
          className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground">{displayValue.toFixed(2)}</span>
        {label && <span className="mt-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
