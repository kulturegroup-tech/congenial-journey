"use client";

// A thin bar at the top while a page is loading, so a click always shows it was heard.
// Starts on any internal link click (or a "ps:navigate" event from code that calls router.push)
// and finishes when the address changes.
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = `${pathname}?${search}`;
  const last = useRef(key);

  useEffect(() => {
    const start = () => {
      if (timer.current) clearTimeout(timer.current);
      // Fast navigations finish before the bar would show; only slower ones get it.
      timer.current = setTimeout(() => {
        setState("loading");
        // If the page never changes (a failed load), don't leave the bar hanging.
        timer.current = setTimeout(() => setState("idle"), 15_000);
      }, 120);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("ps:navigate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("ps:navigate", start);
    };
  }, []);

  useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    if (timer.current) clearTimeout(timer.current);
    const raf = requestAnimationFrame(() => setState((s) => (s === "loading" ? "done" : "idle")));
    const t = setTimeout(() => setState("idle"), 400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [key]);

  return <div aria-hidden data-state={state} className="nav-progress no-print" />;
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}

/** For code that navigates with router.push: show the bar too. */
export const navigating = () => window.dispatchEvent(new Event("ps:navigate"));

export function navigateTo(router: { push: (href: string) => void }, href: string) {
  navigating();
  router.push(href);
}
