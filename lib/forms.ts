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

/** Lakhs typed by the user ("24", "24.5") → rupees. */
export const lakhs = (fd: FormData, key: string) => {
  const n = num(fd, key);
  return n === null ? null : Math.round(n * 100_000);
};

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
