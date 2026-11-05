// Display helpers. India time, Indian number grouping, lakhs for money.
const IST = "Asia/Kolkata";

const toDate = (value: string | Date) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+05:30`) : new Date(value);

const istDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(d); // YYYY-MM-DD

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: IST }).format(toDate(value));
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST,
  }).format(toDate(value));
}

// Whole days between that date and today, in India time. Negative = in the future.
export function daysSince(value: string | Date, now = new Date()) {
  const a = Date.parse(istDay(toDate(value)));
  const b = Date.parse(istDay(now));
  return Math.round((b - a) / 86_400_000);
}

export function ago(value: string | Date | null | undefined, now = new Date()) {
  if (!value) return "—";
  const d = daysSince(value, now);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d === -1) return "tomorrow";
  return d > 0 ? `${d} days ago` : `in ${-d} days`;
}

export function formatLakhs(rupees: number | null | undefined) {
  if (rupees == null) return "—";
  const l = rupees / 100_000;
  return `${l.toFixed(l >= 10 ? 0 : 1).replace(/\.0$/, "")} L`;
}

export function formatRupees(rupees: number | null | undefined) {
  if (rupees == null) return "—";
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(rupees);
}

export function formatPhone(e164: string) {
  if (e164.startsWith("+91") && e164.length === 13) return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
  return e164;
}

export function formatPqe(years: number | string | null | undefined) {
  if (years == null) return "—";
  return `${Number(years).toFixed(1).replace(/\.0$/, "")} yrs`;
}

export function formatPqeRange(min: number | null, max: number | null, grade?: string | null) {
  if (grade) return grade;
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${Number(min)}–${Number(max)} yrs`;
  return min != null ? `${Number(min)}+ yrs` : `up to ${Number(max)} yrs`;
}

/** Rupees with paise, Indian grouping: ₹2,47,800.00 */
export function formatMoney(rupees: number | null | undefined) {
  if (rupees == null) return "—";
  return "₹" + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rupees);
}

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function twoDigits(n: number) {
  return n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? "-" + ones[n % 10] : ""}`;
}
function threeDigits(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ones[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
}

/** Amount in words, Indian system, for invoices: "Rupees Two Lakh Forty-Seven Thousand Eight Hundred Only". */
export function rupeesInWords(amount: number) {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1000);
  const rest = rupees % 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  const words = parts.join(" ") || "Zero";
  return `Rupees ${words}${paise ? ` and ${twoDigits(paise)} Paise` : ""} Only`;
}

// ---------- Calendar helpers (all India time) ----------

/** Today as YYYY-MM-DD in India. */
export function todayIst(now = new Date()) {
  return istDay(now);
}

/** Add days to a YYYY-MM-DD date. */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The instant an India-time day starts, as an ISO string (for timestamp filters). */
export function istStart(day: string) {
  return new Date(`${day}T00:00:00+05:30`).toISOString();
}

/** Monday of the week containing the day. */
export function weekStart(day: string) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}

export function monthStart(day: string) {
  return `${day.slice(0, 7)}-01`;
}

export function monthEnd(day: string) {
  const d = new Date(`${monthStart(day)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/** The India-time calendar day of an instant. */
export function istDayOf(value: string | Date) {
  return istDay(toDate(value));
}

/** "3:00 pm" in India time. */
export function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST }).format(toDate(value)).replace(" ", " ").toLowerCase();
}

/** "Wednesday, 4 November". */
export function formatLongDay(day: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** "Good morning" / "Good afternoon" / "Good evening" by the hour in India. */
/** Hour of the day in India time, 0–23. */
export function istHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: IST }).format(now)) % 24;
}

export function greeting(now = new Date()) {
  const h = istHour(now);
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** "November" for a YYYY-MM-DD day. */
export function monthName(day: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** Minutes from now until that instant (negative once it has passed). */
export function minutesUntil(value: string | Date, now = new Date()) {
  return (toDate(value).getTime() - now.getTime()) / 60_000;
}
