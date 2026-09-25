// The localStorage key light/dark mode is remembered under. Shared between
// the anti-flash script in layout.tsx (which must read this key BEFORE
// React hydrates, to avoid a flash of the wrong theme) and ThemeToggle
// (which reads/writes it after mount) — kept in one place so the two can
// never drift out of sync with each other.
export const THEME_STORAGE_KEY = "kyc-theme";
