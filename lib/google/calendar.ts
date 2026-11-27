import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { googleAccessToken, googleConfig } from "./server";
import { planSync, type Action, type FeedRow, type Link } from "./calendar-core";

// Calendar sync, part 1: makes each connected person's Google Calendar match Covaro.
// Called from POST /api/google/calendar/sync, which open Covaro tabs ping about once a minute.
// One sync at a time across the team (calendar_sync_state); nothing is logged but counts.

type Db = Awaited<ReturnType<typeof createClient>>;

const EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const PER_RUN = 60; // writes per run; anything left over goes in the next run a minute later
const LOCK_MS = 2 * 60_000;
const MIN_GAP_MS = 30_000;

export type SyncResult = { skipped?: string; written: number; removed: number; failed: number; left: number };

async function google(token: string, method: string, url: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
}

async function apply(a: Action, token: string): Promise<boolean> {
  if (a.do === "remove") {
    const r = await google(token, "DELETE", `${EVENTS}/${a.eventId}`);
    return !!r && (r.ok || r.status === 404 || r.status === 410);
  }
  const body = { id: a.eventId, ...a.event, status: "confirmed" };
  const created = await google(token, "POST", EVENTS, body);
  if (created?.ok) return true;
  // Already there (written before, or taken off and coming back): replace it in place.
  if (created?.status === 409) {
    const updated = await google(token, "PUT", `${EVENTS}/${a.eventId}`, body);
    return !!updated?.ok;
  }
  return false;
}

export async function syncCalendars(supabase: Db, origin: string): Promise<SyncResult> {
  const none = (skipped: string): SyncResult => ({ skipped, written: 0, removed: 0, failed: 0, left: 0 });
  if (!googleConfig()) return none("not-set-up");

  const { data: conns } = await supabase.from("google_connections").select("member_id, status, calendar_sync");
  const connected = new Set((conns ?? []).filter((c) => c.status === "connected").map((c) => c.member_id));
  if (!connected.size) return none("nobody-connected");
  const syncing = new Set((conns ?? []).filter((c) => c.status === "connected" && c.calendar_sync).map((c) => c.member_id));

  // Take the team-wide lock: free, and the last run was over 30 seconds ago.
  const now = Date.now();
  const { data: claimed } = await supabase
    .from("calendar_sync_state")
    .update({ running_until: new Date(now + LOCK_MS).toISOString() })
    .eq("id", true)
    .lt("running_until", new Date(now).toISOString())
    .or(`last_run_at.is.null,last_run_at.lt.${new Date(now - MIN_GAP_MS).toISOString()}`)
    .select("id");
  if (!claimed?.length) return none("recent");

  const result: SyncResult = { written: 0, removed: 0, failed: 0, left: 0 };
  let lastError: string | null = null;
  try {
    const [feed, links] = await Promise.all([
      syncing.size ? supabase.from("v_calendar_feed").select("*").in("member_id", [...syncing]) : { data: [] },
      supabase.from("calendar_links").select("kind, item_id, member_id, event_id, hash, starts_on, removed"),
    ]);
    const today = new Date(now + 330 * 60_000).toISOString().slice(0, 10);
    const actions = planSync({ feed: (feed.data ?? []) as FeedRow[], links: (links.data ?? []) as Link[], syncing, connected, origin, today });
    result.left = Math.max(0, actions.length - PER_RUN);

    const tokens = new Map<string, string | null>();
    const misses = new Map<string, number>();
    for (const a of actions.slice(0, PER_RUN)) {
      // Two refusals in a row for one person (say the Calendar API isn't switched on): leave them for this run.
      if ((misses.get(a.member) ?? 0) >= 2) {
        result.failed++;
        continue;
      }
      if (!tokens.has(a.member)) {
        const t = await googleAccessToken(supabase, a.member);
        tokens.set(a.member, "token" in t ? t.token : null);
        if ("error" in t) lastError = t.error;
      }
      const token = tokens.get(a.member);
      if (!token || !(await apply(a, token))) {
        result.failed++;
        misses.set(a.member, (misses.get(a.member) ?? 0) + 1);
        continue;
      }
      misses.set(a.member, 0);
      if (a.do === "put") {
        await supabase
          .from("calendar_links")
          .upsert(
            { kind: a.kind, item_id: a.itemId, member_id: a.member, event_id: a.eventId, hash: a.hash, starts_on: a.startsOn, removed: false },
            { onConflict: "kind,item_id" },
          );
        result.written++;
      } else {
        // Only mark removed if it still points at the calendar we just cleared (it may have moved on).
        await supabase.from("calendar_links").update({ removed: true }).eq("kind", a.kind).eq("item_id", a.itemId).eq("member_id", a.member);
        result.removed++;
      }
    }
    if (result.failed && !lastError) lastError = "Google refused some changes; they'll be tried again.";
  } finally {
    const done = new Date().toISOString();
    await supabase.from("calendar_sync_state").update({ running_until: done, last_run_at: done, last_error: lastError }).eq("id", true);
  }
  return result;
}
