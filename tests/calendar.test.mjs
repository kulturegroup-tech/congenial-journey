// Calendar sync, part 1: event shapes and the plan of changes. Run: node --no-warnings tests/calendar.test.mjs
// Fake people only.
import assert from "node:assert/strict";
import { eventFor, eventIdFor, hashOf, istDate, planSync } from "../lib/google/calendar-core.ts";

let n = 0;
const ok = (c, m) => (assert.ok(c, m), n++);
const ORIGIN = "https://example.onrender.com";
const KHYATI = "11111111-1111-4111-8111-111111111111", KOPAL = "22222222-2222-4222-8222-222222222222";
const row = (o) => ({ kind: "call", item_id: "aaaaaaaa-0000-4000-8000-000000000001", member_id: KHYATI, starts_at: "2026-11-28T05:30:00Z", on_date: null,
  candidate_id: "cccccccc-0000-4000-8000-000000000001", candidate_name: "Test Person", mandate_title: "TMT associate", client_name: "Example & Co", stage: null, phone: "+919000000001", ...o });

// Event shapes
const id = eventIdFor("interview", "aaaaaaaa-0000-4000-8000-000000000001");
ok(/^[a-v0-9]{5,1024}$/.test(id), "event ids use only the characters Google allows");
ok(id !== eventIdFor("call", "aaaaaaaa-0000-4000-8000-000000000001"), "a call and an interview never share an event");
const call = eventFor(row({}), ORIGIN);
ok(call.summary === "Call: Test Person" && call.description.includes("Phone: +919000000001"), "a call shows who and the number to ring");
ok(call.description.includes(`${ORIGIN}/candidates/cccccccc-0000-4000-8000-000000000001`), "every event links back to the profile");
ok(new Date(call.end.dateTime) - new Date(call.start.dateTime) === 30 * 60_000 && call.start.timeZone === "Asia/Kolkata", "a call is 30 minutes, in India time");
const iv = eventFor(row({ kind: "interview", stage: "final_round", phone: null }), ORIGIN);
ok(iv.summary === "Final round: Test Person · Example & Co" && new Date(iv.end.dateTime) - new Date(iv.start.dateTime) === 60 * 60_000, "an interview names the round and the client, one hour");
ok(!iv.description.includes("Phone"), "only calls carry the phone number");
const fu = eventFor(row({ kind: "follow_up", starts_at: null, on_date: "2026-11-30" }), ORIGIN);
ok(fu.start.date === "2026-11-30" && fu.end.date === "2026-12-01" && fu.transparency === "transparent", "a follow-up is an all-day reminder that doesn't block time");
ok(eventFor(row({ kind: "joining", starts_at: null, on_date: "2026-12-31" }), ORIGIN).end.date === "2027-01-01", "an all-day event ending on New Year's Eve rolls into the next year");
ok(istDate("2026-11-27T20:00:00Z") === "2026-11-28", "1:30 am in India counts as the next day");

// The plan
const base = { links: [], syncing: new Set([KHYATI, KOPAL]), connected: new Set([KHYATI, KOPAL]), origin: ORIGIN, today: "2026-11-27" };
let p = planSync({ ...base, feed: [row({})] });
ok(p.length === 1 && p[0].do === "put" && p[0].member === KHYATI && p[0].startsOn === "2026-11-28", "a new call is written to the recruiter's calendar");
const written = { kind: "call", item_id: row({}).item_id, member_id: KHYATI, event_id: p[0].eventId, hash: p[0].hash, starts_on: "2026-11-28", removed: false };
ok(planSync({ ...base, feed: [row({})], links: [written] }).length === 0, "nothing changed, nothing to do");
p = planSync({ ...base, feed: [row({ starts_at: "2026-11-28T08:30:00Z" })], links: [written] });
ok(p.length === 1 && p[0].do === "put" && p[0].eventId === written.event_id, "a moved call updates the same event");
p = planSync({ ...base, feed: [row({ member_id: KOPAL })], links: [written] });
ok(p.length === 2 && p[0].do === "remove" && p[0].member === KHYATI && p[1].do === "put" && p[1].member === KOPAL, "a call handed to Kopal leaves Khyati's calendar and lands on Kopal's");
p = planSync({ ...base, feed: [], links: [written] });
ok(p.length === 1 && p[0].do === "remove" && p[0].member === KHYATI, "a cancelled call comes off the calendar");
ok(planSync({ ...base, feed: [], links: [{ ...written, starts_on: "2026-11-20" }] }).length === 0, "past events stay on the calendar as history");
ok(planSync({ ...base, feed: [], links: [{ ...written, removed: true }] }).length === 0, "an event already taken off isn't removed twice");
p = planSync({ ...base, feed: [row({})], links: [{ ...written, removed: true }] });
ok(p.length === 1 && p[0].do === "put" && p[0].eventId !== written.event_id && /^[a-v0-9]+$/.test(p[0].eventId), "a call put back after it came off gets a fresh event id");
p = planSync({ ...base, feed: [row({ starts_at: "2026-11-29T05:30:00Z" })], links: [{ ...written, event_id: "cvcsomethingelse" }] });
ok(p[0].eventId === "cvcsomethingelse", "an item keeps the event id it was written with");
p = planSync({ ...base, syncing: new Set([KOPAL]), feed: [row({})], links: [written] });
ok(p.length === 1 && p[0].do === "remove", "turning calendar sync off takes the upcoming events back off");
ok(planSync({ ...base, syncing: new Set([KOPAL]), connected: new Set([KOPAL]), feed: [row({})], links: [written] }).length === 0, "someone who disconnected is left alone (no access to their calendar)");
ok(planSync({ ...base, feed: [row({ member_id: null })] }).length === 0, "an item with no owner goes nowhere");
ok(hashOf(eventFor(row({}), ORIGIN)) === hashOf(eventFor(row({}), ORIGIN)), "the same item always gives the same fingerprint");

console.log(`${n} calendar checks passed`);
