"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_KEY, type ThemePref } from "@/lib/theme";

const DARK = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply() {
  const p = readPref();
  const dark = p === "dark" || (p === "system" && window.matchMedia(DARK).matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function setPref(p: ThemePref) {
  try {
    if (p === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, p);
  } catch {
    // Private mode: the look still changes for this visit.
  }
  apply();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Follows the computer switching between light and dark, and a change made in another tab. */
export function ThemeWatcher() {
  useEffect(() => {
    const mq = window.matchMedia(DARK);
    mq.addEventListener("change", apply);
    window.addEventListener("storage", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("storage", apply);
    };
  }, []);
  return null;
}

const CHOICES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "Same as this computer" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Settings → Appearance. Saved on this computer only. */
export function AppearancePicker() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePref);
  return (
    <div role="radiogroup" aria-label="Look" className="inline-flex rounded-full bg-side p-1">
      {CHOICES.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={pref === c.value}
          onClick={() => setPref(c.value)}
          className={`state rounded-full px-4 py-1.5 text-[13.5px] font-medium transition-colors ${pref === c.value ? "bg-surface text-ink shadow-[0_1px_2px_rgb(29_42_36/0.12)]" : "text-muted hover:text-ink"}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
