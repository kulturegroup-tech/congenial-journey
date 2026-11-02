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
