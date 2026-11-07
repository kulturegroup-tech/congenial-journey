// Reading form fields in Server Actions, and the result shape every action returns.

export type ActionState = { ok?: boolean; error?: string; message?: string; id?: string; duplicateId?: string } | null;

/** Trimmed text, or null when empty. */
export const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

/** A number (commas allowed), or null. */
export const num = (fd: FormData, key: string) => {
  const v = text(fd, key);
  if (v === null) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * A salary as people type it → rupees. "24", "24.5", "24 L", "24 lakhs", "2.4 Cr", "24,00,000", "₹24,00,000".
 * A bare number under 1,000 is lakhs; 1,00,000 and up is rupees; in between we ask rather than guess.
 */
export function parseRupees(raw: string): { value: number | null; error?: string } {
  const s = raw.toLowerCase().replace(/₹|rs\.?|inr|p\.?a\.?|per annum|ctc/g, "").replace(/[,\s]/g, "");
  if (!s) return { value: null };
  if (/\d\s*(-|to|–)\s*\d/.test(s)) return { value: null, error: "one number, not a range (put the range in the notes)" };
  const m = s.match(/^(\d+(?:\.\d+)?)(cr|crore|crores|l|lakh|lakhs|lac|lacs|lpa|k)?$/);
  if (!m) return { value: null, error: "a number like 24 (lakhs) or 24,00,000" };
  const n = Number(m[1]);
  const unit = m[2] ?? "";
  let rupees: number;
  if (unit.startsWith("c")) rupees = n * 1_00_00_000;
  else if (unit === "k") rupees = n * 1_000;
  else if (unit) rupees = n * 1_00_000;
  else if (n < 1_000) rupees = n * 1_00_000;
  else if (n >= 1_00_000) rupees = n;
  else return { value: null, error: "lakhs or rupees? Type 24 for 24 lakhs, or 24,00,000" };
  if (rupees > 99_99_99_99_999) return { value: null, error: "too large; type it in lakhs, like 24" };
  return { value: Math.round(rupees) };
}

/** A salary field → rupees, or null when empty or unreadable (check moneyProblem first). */
export const lakhs = (fd: FormData, key: string) => parseRupees(text(fd, key) ?? "").value;

/** The first salary field that can't be read, as a sentence for the form, or null when all are fine. */
export function moneyProblem(fd: FormData, fields: Record<string, string>): string | null {
  for (const [key, label] of Object.entries(fields)) {
    const r = parseRupees(text(fd, key) ?? "");
    if (r.error) return `${label}: enter ${r.error}.`;
  }
  return null;
}

/** Comma- or newline-separated list. */
export const list = (fd: FormData, key: string) =>
  (text(fd, key) ?? "")
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

/** All values of a repeated field (checkbox groups). */
export const all = (fd: FormData, key: string) =>
  fd.getAll(key).filter((v): v is string => typeof v === "string" && v.trim() !== "");

export const bool = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";

/** JSON from a hidden field (repeating rows built in the browser). */
export function json<T>(fd: FormData, key: string, fallback: T): T {
  const v = text(fd, key);
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/** Database errors in words the team can act on. */
export function dbError(e: { code?: string; message: string } | null | undefined): string {
  if (!e) return "Something went wrong.";
  if (e.code === "23505") {
    if (e.message.includes("candidate_phones_phone_key")) return "That phone number already belongs to another candidate.";
    if (e.message.includes("candidates_linkedin_key")) return "A candidate with this LinkedIn URL already exists.";
    if (e.message.includes("candidate_emails_email_key")) return "That email already belongs to another candidate.";
    if (e.message.includes("pipeline_entries_candidate_id_mandate_id_key")) return "This candidate is already on that mandate.";
    if (e.message.includes("clients_firm_id_key")) return "That firm is already a client.";
    if (e.message.includes("firms_name_key")) return "A firm with that name already exists.";
    if (e.message.includes("invoices_one_live_per_placement")) return "This placement already has an invoice.";
    return "That already exists.";
  }
  if (e.code === "23503") return "That record is still linked to something else, so it can't be removed.";
  if (e.code === "23514") return "Some values aren't allowed. Check the form and try again.";
  if (e.code === "42501") return "You don't have permission to do that.";
  if (e.code === "22003") return "A number is too large. Type salaries in lakhs, like 24 or 24.5.";
  if (e.code === "22P02" || e.code === "22007" || e.code === "22008") return "One of the values isn't in the right format. Check numbers and dates.";
  if (e.code === "23502") return "A required field is empty.";
  if (e.code === "PGRST204" || e.code === "PGRST202" || e.code === "42703" || e.code === "42883")
    return "This part of the app is waiting for a database update. Nothing was saved; let Priyanshi know.";
  if (/requires a WHERE clause/i.test(e.message)) return "Couldn't save because of a database bug. Nothing was changed; let Priyanshi know.";
  if (/fetch failed|network|timed? ?out/i.test(e.message)) return "Couldn't reach the database. Check your internet and try again.";
  return e.message;
}

/** Same rule as the database's linkedin_slug(): used to spot duplicates before saving. */
export function linkedinSlug(url: string | null) {
  if (!url) return null;
  const m = url.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  return m ? m[1].toLowerCase() : null;
}

/** practice_start_date → "3.6" (years.months) for editing. */
export function pqeInput(start: string | null) {
  if (!start) return "";
  const s = new Date(`${start}T00:00:00+05:30`);
  const now = new Date();
  let months = (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth());
  if (now.getDate() < s.getDate()) months -= 1;
  return `${Math.floor(months / 12)}.${months % 12}`;
}

/** Monthly fixed salary typed in rupees ("175000", "1,75,000") or lakhs ("1.75") → annual rupees (× 12).
 *  The fee is worked out on fixed pay only: no bonus, no ESOPs. */
export const monthlyToAnnual = (fd: FormData, key: string) => {
  const monthly = parseRupees(text(fd, key) ?? "").value;
  return monthly && monthly > 0 ? Math.round(monthly * 12) : null;
};
