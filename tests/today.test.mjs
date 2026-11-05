// Checks for the Today greeting: the day line, the illustrated moments and the rain check.
// Run: node tests/today.test.mjs   (Node 22.18+ reads the TypeScript files directly)
import assert from "node:assert/strict";
import { dayLine, lineText } from "../lib/day-line.ts";
import { FESTIVALS, festivalOn, pickMoment, workingDaysLeft } from "../lib/moments.ts";
import { inMumbai, isHeavy, isMonsoon, rainLeftToday } from "../lib/rain.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
};

const base = {
  hour: 11, weekday: 4, seed: 0, month: "November", workingDaysLeft: 18,
  joiningsToday: [], joiningsNextMonday: 0, joined: 0, target: 5, interviews: [], rainInterviews: 0,
  invoiceDue: null, nextCall: null, callsLeft: 0, followUps: [], quiet: null, suggestion: null,
};
const line = (over) => lineText(dayLine({ ...base, ...over }));
const p = (name) => ({ name, href: `/candidates/${name}` });

// --- day line ---------------------------------------------------------------
check("a joining beats everything", () => {
  assert.equal(
    line({ joiningsToday: [{ ...p("Rohan Mehta"), client: "Khaitan & Co" }], interviews: [{ ...p("Aisha Khan"), client: "JSA", stage: "interview", time: "11:00 am" }] }),
    "Rohan Mehta joins Khaitan & Co today. Raise the invoice before the day's out.",
  );
  assert.equal(line({ joiningsToday: [{ ...p("A B"), client: "X" }, { ...p("C D"), client: "Y" }] }), "A B and C D join today. Big day.");
  assert.match(line({ joiningsToday: [1, 2, 3].map((i) => ({ ...p(`P${i}`), client: "X" })) }), /^Three people join today, starting with P1/);
});
check("rain only matters with interviews", () => {
  assert.equal(line({ rainInterviews: 2 }), "Heavy rain forecast in Mumbai. Two interviews today; worth a confirm call.");
});
check("interviews use first names and stage words", () => {
  assert.equal(line({ interviews: [{ ...p("Aisha Khan"), client: "JSA", stage: "interview", time: "11:00 am" }] }), "Aisha's JSA interview is at 11:00 am. Fingers crossed.");
  assert.equal(
    line({ interviews: [{ ...p("Meera Pillai"), client: "SAM", stage: "final_round", time: "4:00 pm" }, { ...p("X Y"), client: "Z", stage: "interview", time: "5:00 pm" }] }),
    "Meera's SAM final round is at 4:00 pm (and one more). Fingers crossed.",
  );
});
check("invoice deadlines", () => {
  assert.equal(line({ invoiceDue: { ...p("Gaurav Iyer"), client: "Trilegal", days: 2 } }), "Trilegal's invoice for Gaurav Iyer is due in two days, or the fee's at risk.");
  assert.equal(line({ invoiceDue: { ...p("Gaurav Iyer"), client: "Trilegal", days: 0 } }), "Last day to invoice Trilegal for Gaurav Iyer. Don't let the fee slip.");
  assert.doesNotMatch(line({ invoiceDue: { ...p("Gaurav Iyer"), client: "Trilegal", days: 9 } }), /invoice/);
});
check("target", () => {
  assert.equal(line({ joined: 5, workingDaysLeft: 9 }), "5 of 5 this month. Target done with nine working days to spare.");
  assert.equal(line({ joined: 6, workingDaysLeft: 1 }), "6 joinings this month. Past target.");
  assert.equal(line({ joined: 3 }), "Third joining this month. Two more and you've hit target.");
  assert.equal(line({ joined: 4 }), "Fourth joining this month. One more and you've hit target.");
  assert.doesNotMatch(line({ joined: 1 }), /joining/);
});
check("next call soon", () => {
  assert.equal(line({ nextCall: { ...p("Rohan Mehta"), time: "11:30 am", minutes: 20 }, callsLeft: 3 }), "Rohan Mehta at 11:30 am. You've got 20 minutes.");
  assert.equal(line({ nextCall: { ...p("Rohan Mehta"), time: "11:30 am", minutes: 0 }, callsLeft: 3 }), "Rohan Mehta's call is now.");
  assert.equal(line({ nextCall: { ...p("Rohan Mehta"), time: "4:30 pm", minutes: 300 }, callsLeft: 3 }), "Three calls today.");
});
check("follow-ups", () => {
  assert.equal(line({ followUps: [{ ...p("Vikram Shah"), late: 2 }] }), "Vikram Shah was due a follow-up two days ago. A nudge today?");
  assert.equal(line({ followUps: [{ ...p("Neha Kapoor"), late: 0 }] }), "Nothing booked yet. Neha Kapoor is due a follow-up today; start there?");
});
check("late evening", () => assert.equal(line({ hour: 22, followUps: [{ ...p("V S"), late: 3 }] }), "Everything's saved. Go home."));
check("friday and month end", () => {
  assert.equal(line({ weekday: 5, joiningsNextMonday: 2 }), "Friday. Two people join on Monday. Invoices ready?");
  assert.equal(line({ weekday: 5 }), "Friday. Clear the follow-ups and it's a good week.");
  assert.equal(line({ workingDaysLeft: 3 }), "Last three working days of November. Anything close to an offer?");
  assert.equal(line({ workingDaysLeft: 1 }), "Last working day of November. Anything close to an offer?");
});
check("quiet mandates and suggestions", () => {
  assert.equal(line({ quiet: { client: "Argus Partners", href: "/m/1", days: 9 } }), "Argus Partners hasn't heard from us in nine days. Today's the day.");
  assert.equal(line({ suggestion: { mandate: "Khaitan & Co, M&A associate", href: "/m/2", count: 4 } }), "Khaitan & Co, M&A associate has four people you've spoken to before. They're below.");
});
check("names are links", () => {
  const segs = dayLine({ ...base, followUps: [{ ...p("Vikram Shah"), late: 2 }] });
  assert.deepEqual(segs[0], { text: "Vikram Shah", href: "/candidates/Vikram Shah" });
});
check("quiet days vary by day, and stay put within a day", () => {
  const a = line({ seed: 0 }), b = line({ seed: 1 }), c = line({ seed: 2 });
  assert.equal(new Set([a, b, c]).size, 3);
  assert.equal(line({ seed: 3 }), a);
  assert.equal(line({ weekday: 1 }), "New week. A good day to call people you haven't spoken to in a while.");
});

// --- moments ----------------------------------------------------------------
const mf = { day: "2026-11-05", month: "November", joiningsToday: [], joinDates: [], target: 5, heavyRain: false };
check("festival dates are sane and don't overlap", () => {
  const sorted = [...FESTIVALS].sort((a, b) => a.from.localeCompare(b.from));
  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i];
    assert.match(f.from, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!f.to || f.to >= f.from, f.from);
    if (i) assert.ok((sorted[i - 1].to ?? sorted[i - 1].from) < f.from, `overlap at ${f.from}`);
  }
});
check("diwali 2026", () => {
  assert.equal(festivalOn("2026-11-05"), null);
  assert.equal(festivalOn("2026-11-06").caption, "Happy Dhanteras");
  assert.equal(festivalOn("2026-11-08").caption, "Happy Diwali");
  assert.equal(festivalOn("2026-11-08").kind, "diya");
  assert.equal(festivalOn("2026-11-11").caption, "Happy Bhau Beej");
  assert.equal(festivalOn("2026-11-12"), null);
});
check("most days have no moment", () => {
  assert.equal(pickMoment(mf), null);
  assert.equal(pickMoment({ ...mf, day: "2026-11-17" }), null);
});
check("joining beats a festival", () => {
  const m = pickMoment({ ...mf, day: "2026-11-09", joiningsToday: ["Rohan Mehta"] });
  assert.equal(m.kind, "joining");
  assert.equal(m.caption, "Rohan joins today");
  assert.equal(pickMoment({ ...mf, day: "2026-11-09" }).kind, "diya");
});
check("trophy for three days from the day the target was hit", () => {
  const joinDates = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-12", "2026-11-16", "2026-11-25"];
  assert.equal(pickMoment({ ...mf, day: "2026-11-16", joinDates }).kind, "trophy");
  assert.equal(pickMoment({ ...mf, day: "2026-11-18", joinDates }).kind, "trophy");
  assert.equal(pickMoment({ ...mf, day: "2026-11-19", joinDates }), null);
  assert.equal(pickMoment({ ...mf, day: "2026-11-13", joinDates }), null);
});
check("month end on the last two working days", () => {
  assert.equal(workingDaysLeft("2026-11-05"), 18);
  assert.equal(workingDaysLeft("2026-11-30"), 1);
  assert.equal(pickMoment({ ...mf, day: "2026-11-27" }).kind, "hourglass"); // Fri: 27 and 30 left
  assert.equal(pickMoment({ ...mf, day: "2026-11-30" }).caption, "Last day of November");
  assert.equal(pickMoment({ ...mf, day: "2026-11-28" }), null); // Saturday
  assert.equal(pickMoment({ ...mf, day: "2026-11-26" }), null);
});
check("rain moment credits the forecast", () => {
  const m = pickMoment({ ...mf, day: "2027-07-14", heavyRain: true });
  assert.equal(m.kind, "rain");
  assert.match(m.note, /MET Norway/);
});

// --- rain -------------------------------------------------------------------
check("monsoon window", () => {
  assert.ok(isMonsoon("2027-06-01"));
  assert.ok(isMonsoon("2027-10-15"));
  assert.ok(!isMonsoon("2027-10-16"));
  assert.ok(!isMonsoon("2026-11-05"));
});
check("rain left today sums the rest of the India-time day", () => {
  const hour = (iso, mm) => ({ time: iso, data: { next_1_hours: { details: { precipitation_amount: mm } } } });
  const f = { properties: { timeseries: [
    hour("2027-07-14T02:00:00Z", 30), // 07:30 IST, already past
    hour("2027-07-14T06:00:00Z", 12),
    hour("2027-07-14T10:00:00Z", 20),
    hour("2027-07-14T18:00:00Z", 15), // 23:30 IST, still today
    hour("2027-07-14T18:30:00Z", 99), // midnight IST: tomorrow
    { time: "2027-07-14T12:00:00Z", data: {} },
  ] } };
  const now = Date.parse("2027-07-14T05:30:00Z"); // 11:00 IST
  assert.equal(rainLeftToday(f, "2027-07-14", now), 47);
  assert.ok(isHeavy(47));
  assert.ok(!isHeavy(20));
  assert.equal(rainLeftToday({}, "2027-07-14", now), 0);
});
check("mumbai interviews", () => {
  assert.ok(inMumbai("Mumbai"));
  assert.ok(inMumbai("Navi Mumbai"));
  assert.ok(inMumbai(null));
  assert.ok(!inMumbai("Delhi"));
  assert.ok(!inMumbai("Bengaluru"));
});

console.log(`${n} Today checks passed`);
