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
