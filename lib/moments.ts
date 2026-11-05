// Illustrated moments beside the greeting on Today. Rare on purpose: festivals, someone joining,
// the month's target, the last stretch of the month, heavy rain. Most days show nothing.
// Pure and import-free so tests/today.test.mjs can run it directly.

export type MomentKind =
  | "diya" | "star" | "sparkler" | "kite" | "tricolour" | "holi" | "gudi" | "crescent" | "modak" | "toran"
  | "joining" | "trophy" | "hourglass" | "rain";

export type Moment = { id: string; kind: MomentKind; caption: string; note?: string };

type Festival = { from: string; to?: string; kind: MomentKind; caption: string };

// India time, inclusive. 2027 dates come from published calendars and can move by a day (Eid by the moon):
// check them against the Maharashtra government holiday list when it is out, and add the next year each November.
export const FESTIVALS: Festival[] = [
  { from: "2026-11-06", kind: "diya", caption: "Happy Dhanteras" },
  { from: "2026-11-07", to: "2026-11-09", kind: "diya", caption: "Happy Diwali" },
  { from: "2026-11-10", kind: "diya", caption: "Happy Diwali Padwa" },
  { from: "2026-11-11", kind: "diya", caption: "Happy Bhau Beej" },
  { from: "2026-12-24", to: "2026-12-25", kind: "star", caption: "Merry Christmas" },
  { from: "2026-12-31", kind: "sparkler", caption: "Last day of 2026" },
  { from: "2027-01-01", to: "2027-01-02", kind: "sparkler", caption: "Happy New Year" },
  { from: "2027-01-14", to: "2027-01-15", kind: "kite", caption: "Tilgul ghya, god god bola" },
  { from: "2027-01-26", kind: "tricolour", caption: "Happy Republic Day" },
  { from: "2027-03-10", to: "2027-03-11", kind: "crescent", caption: "Eid Mubarak" },
  { from: "2027-03-21", to: "2027-03-22", kind: "holi", caption: "Happy Holi" },
  { from: "2027-04-07", kind: "gudi", caption: "Happy Gudi Padwa" },
  { from: "2027-08-15", kind: "tricolour", caption: "Happy Independence Day" },
  { from: "2027-09-04", to: "2027-09-05", kind: "modak", caption: "Ganpati Bappa Morya" },
  { from: "2027-10-09", kind: "toran", caption: "Happy Dussehra" },
  { from: "2027-10-27", to: "2027-10-31", kind: "diya", caption: "Happy Diwali" },
  { from: "2027-12-24", to: "2027-12-25", kind: "star", caption: "Merry Christmas" },
];

export function festivalOn(day: string): Moment | null {
  const f = FESTIVALS.find((x) => day >= x.from && day <= (x.to ?? x.from));
  return f ? { id: `festival-${f.from}`, kind: f.kind, caption: f.caption } : null;
}

/** Monday to Friday left in the month of `day`, `day` included. */
export function workingDaysLeft(day: string): number {
  const d = new Date(`${day}T00:00:00Z`);
  const month = d.getUTCMonth();
  let n = 0;
  for (; d.getUTCMonth() === month; d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

export type MomentFacts = {
  day: string; // YYYY-MM-DD, India time
  month: string; // "November"
  joiningsToday: string[]; // names, whole firm
  joinDates: string[]; // this month's joining dates, any order, backed-out ones left out
  target: number;
  heavyRain: boolean;
};

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function pickMoment(f: MomentFacts): Moment | null {
  if (f.joiningsToday.length)
    return {
      id: `joining-${f.day}`,
      kind: "joining",
      caption: f.joiningsToday.length === 1 ? `${f.joiningsToday[0].split(" ")[0]} joins today` : `${f.joiningsToday.length} people join today`,
    };

  const festival = festivalOn(f.day);
  if (festival) return festival;

  // The target, for three days from the day it was reached.
  const dates = f.joinDates.filter((d) => d <= f.day).sort();
  if (f.target > 0 && dates.length >= f.target) {
    const hitOn = dates[f.target - 1];
    if (daysBetween(hitOn, f.day) <= 2) return { id: `target-${hitOn}`, kind: "trophy", caption: "Target hit" };
  }

  if (f.heavyRain) return { id: `rain-${f.day}`, kind: "rain", caption: "Heavy rain today", note: "Forecast: MET Norway" };

  const w = new Date(`${f.day}T00:00:00Z`).getUTCDay();
  const left = workingDaysLeft(f.day);
  if (w !== 0 && w !== 6 && left <= 2) return { id: `month-end-${f.day.slice(0, 7)}`, kind: "hourglass", caption: left === 1 ? `Last day of ${f.month}` : `Last stretch of ${f.month}` };

  return null;
}
