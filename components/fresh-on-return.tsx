"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const AWAY_MS = 15_000;

/**
 * Coming back to a Covaro tab after working somewhere else (another Covaro tab, Odoo, WhatsApp)
 * quietly reloads the data on screen, so a candidate a teammate added, or one you added in the
 * other tab, is there without pressing reload. Only after 15 seconds away, so flicking between
 * windows costs nothing. What you are typing stays: only the data from the server is re-read.
 */
export function FreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    let leftAt: number | null = null;
    const away = () => {
      leftAt ??= Date.now();
    };
    const back = () => {
      if (leftAt != null && Date.now() - leftAt >= AWAY_MS) router.refresh();
      leftAt = null;
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? away() : back());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", away);
    window.addEventListener("focus", back);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", away);
      window.removeEventListener("focus", back);
    };
  }, [router]);
  return null;
}
