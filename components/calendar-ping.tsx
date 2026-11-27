"use client";

import { useEffect } from "react";

// Keeps Google Calendars in step: while a Covaro tab is open and visible, asks the server to sync
// about once a minute, and straight away when the tab comes back. The server decides whether there
// is anything to do. Stops for this visit if Google isn't set up.
const EVERY_MS = 60_000;
let last = 0;
let off = false;

export function pingCalendarSync(force = false) {
  if (off || document.visibilityState !== "visible") return;
  if (!force && Date.now() - last < EVERY_MS) return;
  last = Date.now();
  fetch("/api/google/calendar/sync", { method: "POST", keepalive: true })
    .then((r) => r.json())
    .then((j: { skipped?: string }) => {
      if (j?.skipped === "not-set-up") off = true;
    })
    .catch(() => {});
}

export function CalendarPing() {
  useEffect(() => {
    const kick = () => pingCalendarSync();
    const first = setTimeout(kick, 4_000); // after the page has settled
    const timer = setInterval(kick, EVERY_MS);
    document.addEventListener("visibilitychange", kick);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", kick);
    };
  }, []);
  return null;
}
