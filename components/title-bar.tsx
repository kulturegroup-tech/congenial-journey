"use client";

import { useEffect, useState } from "react";

/** Apple-style: once the big title scrolls away, a slim frosted bar keeps it in view. */
export function TitleBar({ title }: { title: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const on = () => setShown(window.scrollY > 90);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div
      aria-hidden={!shown}
      className={`no-print fixed left-[248px] right-0 top-0 z-30 flex h-14 items-center border-b px-10 backdrop-blur-xl backdrop-saturate-150 transition-[opacity,border-color] duration-200 ${
        shown ? "border-line bg-surface/80 opacity-100" : "pointer-events-none border-transparent bg-surface/0 opacity-0"
      }`}
    >
      <span
        className={`text-[15px] font-semibold transition-transform duration-500 [transition-timing-function:var(--ease-spring)] ${shown ? "translate-y-0" : "translate-y-1.5"}`}
      >
        {title}
      </span>
    </div>
  );
}
