"use client";

import * as React from "react";
import { Sun, Moon } from "lucide-react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

// Manual light/dark switch — starts on light for a first-time visitor (the
// anti-flash script in layout.tsx applies the "dark" class to <html> before
// paint if a PREVIOUS choice was saved; there's no automatic system-theme
// detection here by design). The icon shown is the mode that's currently
// ACTIVE (Sun while light, Moon while dark) — clicking flips it.
export function ThemeToggle() {
  // Starts false (light) on both server and first client render — the
  // <html> element's actual class may already be "dark" by then (set
  // synchronously by the anti-flash script before hydration), but reading
  // `document` during render would break server rendering, so this only
  // syncs up in the effect below, right after mount. That one extra
  // render is a normal post-hydration update, not a mismatch: the JSX
  // returned is identical between server and the first client render.
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Storage can throw (private browsing, blocked site data, etc.) —
      // the toggle still works for this page load, it just won't be
      // remembered on the next visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
