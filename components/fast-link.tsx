"use client";

import NextLink from "next/link";
import { useRef, useState, type ComponentProps, type FocusEvent, type PointerEvent } from "react";

// A Link that fetches the whole destination page, data included, the moment someone shows they're
// about to open it: the pointer rests on it for a beat, a finger or button goes down, or it gets
// keyboard focus. The page then opens as soon as it's clicked instead of waiting on the server.
//
// Only links being pointed at do this. Prefetching every visible link with its data would render
// each page on the server for every page load, and again after every save. When the pointer leaves,
// the link goes back to the default (the page's frame only); what it already fetched stays usable
// for staleTimes.static (next.config.ts).
const HOVER_MS = 70;

export default function Link({ prefetch, onPointerEnter, onPointerLeave, onPointerDown, onFocus, onBlur, ...props }: ComponentProps<typeof NextLink>) {
  const [intent, setIntent] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const off = prefetch === false;

  const stop = () => clearTimeout(timer.current);

  return (
    <NextLink
      {...props}
      prefetch={off ? false : intent ? true : prefetch}
      onPointerEnter={(e: PointerEvent<HTMLAnchorElement>) => {
        onPointerEnter?.(e);
        if (off || e.pointerType !== "mouse") return;
        stop();
        timer.current = setTimeout(() => setIntent(true), HOVER_MS);
      }}
      onPointerLeave={(e: PointerEvent<HTMLAnchorElement>) => {
        onPointerLeave?.(e);
        stop();
        setIntent(false);
      }}
      onPointerDown={(e: PointerEvent<HTMLAnchorElement>) => {
        onPointerDown?.(e);
        if (!off) setIntent(true);
      }}
      onFocus={(e: FocusEvent<HTMLAnchorElement>) => {
        onFocus?.(e);
        if (!off && e.currentTarget.matches(":focus-visible")) setIntent(true);
      }}
      onBlur={(e: FocusEvent<HTMLAnchorElement>) => {
        onBlur?.(e);
        setIntent(false);
      }}
    />
  );
}
