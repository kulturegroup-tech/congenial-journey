"use client";

import { useEffect } from "react";

/** One listener for the whole app: anything marked data-ripple gets a press ripple from the pointer. */
export function Ripples() {
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-ripple]");
      if (!t || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const r = t.getBoundingClientRect();
      const d = Math.max(r.width, r.height) * 2.2;
      const s = document.createElement("span");
      s.className = "ripple";
      s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
      if (getComputedStyle(t).position === "static") t.style.position = "relative";
      t.appendChild(s);
      setTimeout(() => s.remove(), 600);
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, []);
  return null;
}
