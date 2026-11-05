// The one line under the greeting on Today. Picked from the person's own day, most important first,
// so it changes with what is actually happening instead of rotating quotes.
// Pure and import-free so tests/today.test.mjs can run it directly.

export type Seg = string | { text: string; href: string };

export type Person = { name: string; href: string };

export type DayFacts = {
  hour: number; // 0–23, India time
  weekday: number; // 0 = Sunday
  seed: number; // changes once a day; picks between equal-weight lines
  month: string; // "November"
  workingDaysLeft: number; // Mon–Fri left in the month, today included
  joiningsToday: (Person & { client: string })[]; // whole firm
  joiningsNextMonday: number; // whole firm, only read on Fridays
  joined: number; // joinings this month
  target: number;
  interviews: (Person & { client: string; stage: string; time: string })[]; // mine, still to come today
  rainInterviews: number; // interviews today in Mumbai when heavy rain is forecast; 0 otherwise
  invoiceDue: (Person & { client: string; days: number }) | null; // fee forfeited after the deadline
  nextCall: (Person & { time: string; minutes: number }) | null;
  callsLeft: number;
  followUps: (Person & { late: number })[]; // mine, due today or late, most overdue first
  quiet: { client: string; href: string; days: number } | null;
  suggestion: { mandate: string; href: string; count: number } | null;
};

const first = (name: string) => name.split(" ")[0];
const link = (p: Person, text = p.name): Seg => ({ text, href: p.href });
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const num = (n: number) => WORDS[n] ?? String(n);
const count = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ORDINAL = ["", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
const STAGE_WORD: Record<string, string> = { interview: "interview", assignment: "assignment", final_round: "final round" };

export function dayLine(f: DayFacts): Seg[] {
  // Someone starts today: the best news there is, and the invoice is due today.
  if (f.joiningsToday.length === 1) {
    const j = f.joiningsToday[0];
    return [link(j), ` joins ${j.client} today. Raise the invoice before the day's out.`];
  }
  if (f.joiningsToday.length > 1) {
    const [a, b, ...rest] = f.joiningsToday;
    return rest.length
      ? [`${cap(count(f.joiningsToday.length, "person", "people"))} join today, starting with `, link(a), ". Big day."]
      : [link(a), " and ", link(b), " join today. Big day."];
  }

  if (f.rainInterviews > 0)
    return [`Heavy rain forecast in Mumbai. ${cap(count(f.rainInterviews, "interview"))} today; worth a confirm call.`];

  if (f.interviews.length) {
    const i = f.interviews[0];
    const more = f.interviews.length > 1 ? ` (and ${count(f.interviews.length - 1, "more", "more")})` : "";
    return [link(i, `${first(i.name)}'s`), ` ${i.client} ${STAGE_WORD[i.stage] ?? "interview"} is at ${i.time}${more}. Fingers crossed.`];
  }

  if (f.invoiceDue && f.invoiceDue.days <= 3) {
    const d = f.invoiceDue;
    return d.days <= 0
      ? [`Last day to invoice ${d.client} for `, link(d), ". Don't let the fee slip."]
      : [`${d.client}'s invoice for `, link(d), ` is due in ${count(d.days, "day")}, or the fee's at risk.`];
  }

  if (f.target > 0 && f.joined >= f.target) {
    const spare = f.workingDaysLeft > 1 ? ` with ${count(f.workingDaysLeft, "working day")} to spare` : "";
    return f.joined === f.target
      ? [`${f.joined} of ${f.target} this month. Target done${spare}.`]
      : [`${f.joined} joinings this month. Past target${spare ? `,${spare}` : ""}.`];
  }

  if (f.nextCall && f.nextCall.minutes <= 45 && f.nextCall.minutes > -30) {
    const c = f.nextCall;
    if (c.minutes <= 1) return [link(c), "'s call is now."];
    return [link(c), ` at ${c.time}. You've got ${c.minutes} minutes.`];
  }

  if (f.hour >= 21) return ["Everything's saved. Go home."];

  const late = f.followUps.find((x) => x.late > 0);
  if (late) return [link(late), ` was due a follow-up ${count(late.late, "day")} ago. A nudge today?`];

  if (f.callsLeft === 0 && f.followUps.length)
    return ["Nothing booked yet. ", link(f.followUps[0]), " is due a follow-up today; start there?"];

  const toGo = f.target - f.joined;
  if (f.joined > 0 && toGo > 0 && toGo <= 2 && ORDINAL[f.joined])
    return [`${ORDINAL[f.joined]} joining this month. ${cap(count(toGo, "more", "more"))} and you've hit target.`];

  if (f.weekday === 5)
    return f.joiningsNextMonday
      ? [`Friday. ${cap(count(f.joiningsNextMonday, "person", "people"))} join${f.joiningsNextMonday === 1 ? "s" : ""} on Monday. Invoices ready?`]
      : ["Friday. Clear the follow-ups and it's a good week."];

  if (f.workingDaysLeft > 0 && f.workingDaysLeft <= 3)
    return [f.workingDaysLeft === 1 ? `Last working day of ${f.month}. Anything close to an offer?` : `Last ${num(f.workingDaysLeft)} working days of ${f.month}. Anything close to an offer?`];

  if (f.quiet && f.quiet.days >= 5) return [{ text: f.quiet.client, href: f.quiet.href }, ` hasn't heard from us in ${count(f.quiet.days, "day")}. Today's the day.`];

  if (f.suggestion)
    return [{ text: f.suggestion.mandate, href: f.suggestion.href }, ` has ${count(f.suggestion.count, "person", "people")} you've spoken to before. They're below.`];

  if (f.weekday === 1)
    return [f.callsLeft ? `New week, ${count(f.callsLeft, "call")} booked already.` : "New week. A good day to call people you haven't spoken to in a while."];

  if (f.callsLeft) return [`${cap(count(f.callsLeft, "call"))} today${f.followUps.length ? ` and ${count(f.followUps.length, "follow-up")}` : ""}.`];

  const quietDay = [
    "A quiet day. Good one for calling people you haven't spoken to in a while.",
    "Nothing booked yet. Paste a number below to see if we already have them.",
    "Clear calendar. Good day to add the CVs sitting in your inbox.",
  ];
  return [quietDay[f.seed % quietDay.length]];
}

/** Plain text of a line, for tests and screen readers. */
export const lineText = (segs: Seg[]) => segs.map((s) => (typeof s === "string" ? s : s.text)).join("");
