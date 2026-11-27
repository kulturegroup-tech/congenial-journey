// Calendar sync, part 1: what each Covaro item looks like as a Google Calendar event, and what has to
// change to make a person's calendar match Covaro. No app imports and no network, so
// tests/calendar.test.mjs can run it straight from Node.
import { createHash } from "node:crypto";

export type Kind = "call" | "interview" | "follow_up" | "joining";

export type FeedRow = {
  kind: Kind;
  item_id: string;
  member_id: string | null;
  starts_at: string | null; // timed: calls and interviews
  on_date: string | null; // all-day: follow-ups and joinings (YYYY-MM-DD)
  candidate_id: string;
  candidate_name: string | null;
  mandate_title: string | null;
  client_name: string | null;
  stage: string | null;
  phone: string | null;
};

export type Link = { kind: Kind; item_id: string; member_id: string; event_id: string; hash: string; starts_on: string; removed: boolean };

export type GoogleEvent = {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string } | { date: string };
  end: { dateTime: string; timeZone: string } | { date: string };
  colorId: string;
  transparency: "opaque" | "transparent";
  reminders: { useDefault: boolean };
  extendedProperties: { private: { covaro: string } };
};

export type Action =
  | { do: "put"; kind: Kind; itemId: string; member: string; eventId: string; event: GoogleEvent; hash: string; startsOn: string }
  | { do: "remove"; kind: Kind; itemId: string; member: string; eventId: string };

const TZ = "Asia/Kolkata";
const LETTER: Record<Kind, string> = { call: "c", interview: "i", follow_up: "f", joining: "j" };
const COLOR: Record<Kind, string> = { call: "7", interview: "3", follow_up: "6", joining: "10" };
const MINUTES: Record<string, number> = { call: 30, interview: 60 };
const STAGE: Record<string, string> = { interview: "Interview", assignment: "Assignment", final_round: "Final round" };

/** Google event ids allow a–v and 0–9; one fixed id per item makes every write safe to repeat. */
export const eventIdFor = (kind: Kind, itemId: string) => `cv${LETTER[kind]}${itemId.replace(/-/g, "").toLowerCase()}`;

const nextDay = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

/** "2026-11-28T05:30:00Z" → "2026-11-28" in India time. */
export const istDate = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);

export function eventFor(row: FeedRow, origin: string): GoogleEvent {
  const name = row.candidate_name ?? "Candidate";
  const where = [row.client_name, row.mandate_title].filter(Boolean).join(" · ");
  const summary =
    row.kind === "call"
      ? `Call: ${name}`
      : row.kind === "interview"
        ? `${STAGE[row.stage ?? ""] ?? "Interview"}: ${name}${row.client_name ? ` · ${row.client_name}` : ""}`
        : row.kind === "follow_up"
          ? `Follow up: ${name}`
          : `${name} joins${row.client_name ? ` ${row.client_name}` : ""}`;
  const description = [where, row.kind === "call" && row.phone ? `Phone: ${row.phone}` : null, `Open in Covaro: ${origin}/candidates/${row.candidate_id}`]
    .filter(Boolean)
    .join("\n");

  let start: GoogleEvent["start"];
  let end: GoogleEvent["end"];
  if (row.starts_at) {
    const s = new Date(row.starts_at);
    const e = new Date(s.getTime() + (MINUTES[row.kind] ?? 30) * 60_000);
    start = { dateTime: s.toISOString(), timeZone: TZ };
    end = { dateTime: e.toISOString(), timeZone: TZ };
  } else {
    start = { date: row.on_date! };
    end = { date: nextDay(row.on_date!) };
  }
  return {
    summary,
    description,
    start,
    end,
    colorId: COLOR[row.kind],
    transparency: row.starts_at ? "opaque" : "transparent", // all-day reminders don't make anyone look busy
    reminders: { useDefault: true },
    extendedProperties: { private: { covaro: `${row.kind}:${row.item_id}` } },
  };
}

/** The id for an item put back after it came off: the same base, plus a suffix that changes each time. */
export const nextEventId = (previous: string, kind: Kind, itemId: string) =>
  `${eventIdFor(kind, itemId)}r${createHash("sha1").update(previous).digest("hex").slice(0, 8)}`;

export const hashOf = (e: GoogleEvent) => createHash("sha1").update(JSON.stringify(e)).digest("hex");

/**
 * What to do so every syncing person's calendar matches Covaro.
 * - New or changed items are written (same event id every time, so a repeat is harmless).
 * - An item that moved to someone else comes off the old person's calendar first.
 * - An item no longer in Covaro's list comes off, unless it's already in the past: history stays.
 * - People who aren't connected are left alone (no access); their records wait until they connect.
 */
export function planSync(o: { feed: FeedRow[]; links: Link[]; syncing: Set<string>; connected: Set<string>; origin: string; today: string }): Action[] {
  const actions: Action[] = [];
  const key = (k: string, id: string) => `${k}:${id}`;
  const linkBy = new Map(o.links.map((l) => [key(l.kind, l.item_id), l]));
  const wanted = new Set<string>();

  for (const row of o.feed) {
    if (!row.member_id || !o.syncing.has(row.member_id) || (!row.starts_at && !row.on_date)) continue;
    const k = key(row.kind, row.item_id);
    wanted.add(k);
    const event = eventFor(row, o.origin);
    const hash = hashOf(event);
    const startsOn = row.on_date ?? istDate(row.starts_at!);
    const link = linkBy.get(k);
    // Google may not let a deleted event's id be used again, so an item coming back gets the next id.
    const eventId = !link ? eventIdFor(row.kind, row.item_id) : link.removed ? nextEventId(link.event_id, row.kind, row.item_id) : link.event_id;
    if (link && !link.removed && link.member_id === row.member_id && link.hash === hash) continue;
    if (link && !link.removed && link.member_id !== row.member_id && o.connected.has(link.member_id))
      actions.push({ do: "remove", kind: row.kind, itemId: row.item_id, member: link.member_id, eventId: link.event_id });
    actions.push({ do: "put", kind: row.kind, itemId: row.item_id, member: row.member_id, eventId, event, hash, startsOn });
  }

  const yesterday = new Date(`${o.today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const cutoff = yesterday.toISOString().slice(0, 10);
  for (const l of o.links) {
    if (l.removed || wanted.has(key(l.kind, l.item_id)) || l.starts_on < cutoff || !o.connected.has(l.member_id)) continue;
    actions.push({ do: "remove", kind: l.kind, itemId: l.item_id, member: l.member_id, eventId: l.event_id });
  }
  return actions;
}
