// What the CV reader asks the AI for, and how its answer is tidied before anyone sees it.
// No imports, so the tests can load it straight from Node (tests/cv.test.mjs).

export type CvJob = { firm: string; role: string | null; from: string | null; to: string | null };

export type CvExtract = {
  full_name: string | null;
  phones: string[];
  emails: string[];
  linkedin_url: string | null;
  current_firm: string | null;
  designation: string | null;
  current_city: string | null;
  /** YYYY-MM the person qualified (enrolment, or their first full-time legal job). PQE counts from here. */
  qualified_on: string | null;
  graduation_year: number | null;
  education: string[];
  work_history: CvJob[];
  practice_areas: string[];
  highlights: string[];
};

export const CV_TOOL_NAME = "record_candidate";

/** The instructions. Kept short and strict: facts from the CV only, nothing sensitive. */
export const CV_SYSTEM = `You read CVs of lawyers for a legal recruitment firm in India and record what each CV says, using the record_candidate tool.

Rules:
- Record only what the CV states. Never guess or fill gaps. Leave a field out when the CV doesn't say.
- Never record date of birth, age, gender, marital status, religion, caste, nationality, family members, health, photos, or home address beyond the city.
- current_firm and designation come from the latest role with no end date ("present", "till date", "current"). If every role has ended, leave both out.
- qualified_on is the month they qualified as a lawyer: enrolment with a Bar Council or admission as a solicitor. If that isn't stated, use the start of their first full-time legal job after the law degree. Internships and trainee stints during the degree don't count. Format YYYY-MM.
- graduation_year is the year of the law degree (LLB, BA LLB, BBA LLB and so on), not a master's.
- practice_areas: at most 4 from the given list, only those their work clearly shows, the main one first.
- highlights: 3 or 4 lines, each under 20 words, on what a recruiter should notice: years and kind of work, notable firms and clients, deal or matter types, rankings, scholarships, languages. Plain facts from the CV. No praise words, no opinions, nothing from the "never record" list.`;

/** The tool the AI must call. Its input is the record; the practice list is the firm's own. */
export function cvTool(practices: string[]) {
  const text = (description: string) => ({ type: "string", description });
  return {
    name: CV_TOOL_NAME,
    description: "Record the candidate details found in the CV.",
    input_schema: {
      type: "object",
      properties: {
        full_name: text("The person's name as written on the CV"),
        phones: { type: "array", items: { type: "string" }, description: "Phone numbers as written" },
        emails: { type: "array", items: { type: "string" } },
        linkedin_url: text("Their LinkedIn profile URL, if the CV gives one"),
        current_firm: text("Organisation of the current role"),
        designation: text("Title in the current role, e.g. Senior Associate"),
        current_city: text("City they work in now"),
        qualified_on: text("YYYY-MM they qualified, per the rules"),
        graduation_year: { type: "integer", description: "Year of the law degree" },
        education: { type: "array", items: { type: "string" }, description: "One line per degree: degree, institution, year" },
        work_history: {
          type: "array",
          description: "Roles, newest first",
          items: {
            type: "object",
            properties: {
              firm: { type: "string" },
              role: { type: "string" },
              from: text("YYYY-MM or YYYY"),
              to: text("YYYY-MM, YYYY, or 'present'"),
            },
            required: ["firm"],
          },
        },
        practice_areas: { type: "array", items: { type: "string", enum: practices }, description: "At most 4, main one first" },
        highlights: { type: "array", items: { type: "string" }, description: "3 or 4 short factual lines" },
      },
      required: ["full_name", "phones", "emails", "work_history", "practice_areas", "highlights"],
    },
  };
}

const str = (v: unknown, max = 200): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};
const strs = (v: unknown, maxItems: number, maxLen = 200): string[] =>
  Array.isArray(v) ? [...new Set(v.map((x) => str(x, maxLen)).filter((x): x is string => !!x))].slice(0, maxItems) : [];

const ymd = (d: Date) => ({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });

/** "2019-08" → "7.3" (years.months as of today), the way the candidate form takes PQE. */
export function pqeFromMonth(ym: string | null, today = new Date()): string {
  const m = ym ? /^(\d{4})-(\d{2})$/.exec(ym) : null;
  if (!m) return "";
  const t = ymd(today);
  const months = (t.y - Number(m[1])) * 12 + (t.m - Number(m[2]));
  if (months < 0) return "";
  return `${Math.floor(months / 12)}.${months % 12}`;
}

/** "2019-08" → 7.3 years as a number (Nov 2026), for showing PQE the way the rest of the app does. */
export function pqeYears(ym: string | null, today = new Date()): number | null {
  const s = pqeFromMonth(ym, today);
  if (!s) return null;
  const [y, m] = s.split(".").map(Number);
  return Math.round((y + m / 12) * 10) / 10;
}

/** The AI's answer → a record we can trust the shape of. Unknown practice areas, bad dates and junk are dropped. */
export function tidyExtract(raw: unknown, practices: string[], today = new Date()): CvExtract {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const byLower = new Map(practices.map((p) => [p.toLowerCase(), p]));
  const t = ymd(today);

  const phones = strs(r.phones, 4, 40).filter((p) => (p.match(/\d/g) ?? []).length >= 8);
  const emails = strs(r.emails, 4, 120)
    .map((e) => e.toLowerCase().replace(/^mailto:/, ""))
    .filter((e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e));

  let linkedin = str(r.linkedin_url, 300);
  if (linkedin && /linkedin\.com\/in\/[^/?#\s]+/i.test(linkedin)) {
    if (!/^https?:\/\//i.test(linkedin)) linkedin = `https://${linkedin.replace(/^\/+/, "")}`;
  } else linkedin = null;

  let qualified = str(r.qualified_on, 7);
  const qm = qualified ? /^(\d{4})-(\d{2})$/.exec(qualified) : null;
  if (!qm || Number(qm[1]) < 1960 || Number(qm[2]) < 1 || Number(qm[2]) > 12 || Number(qm[1]) * 12 + Number(qm[2]) > t.y * 12 + t.m) qualified = null;

  const gy = typeof r.graduation_year === "number" ? Math.round(r.graduation_year) : Number(str(r.graduation_year, 4));
  const graduation = Number.isFinite(gy) && gy >= 1960 && gy <= t.y + 1 ? gy : null;

  const jobs: CvJob[] = Array.isArray(r.work_history)
    ? r.work_history
        .map((j) => (j && typeof j === "object" ? (j as Record<string, unknown>) : {}))
        .map((j) => ({ firm: str(j.firm, 120) ?? "", role: str(j.role, 120), from: str(j.from, 20), to: str(j.to, 20) }))
        .filter((j) => j.firm)
        .slice(0, 12)
    : [];

  const areas = [...new Set(strs(r.practice_areas, 8, 120).map((p) => byLower.get(p.toLowerCase())).filter((p): p is string => !!p))].slice(0, 4);
  const highlights = strs(r.highlights, 4, 240).map((h) => h.replace(/^[-•*·\d.)\s]+/, "").trim()).filter(Boolean);

  return {
    full_name: str(r.full_name, 120),
    phones,
    emails,
    linkedin_url: linkedin,
    current_firm: str(r.current_firm, 120),
    designation: str(r.designation, 120),
    current_city: str(r.current_city, 60),
    qualified_on: qualified,
    graduation_year: graduation,
    education: strs(r.education, 6, 200),
    work_history: jobs,
    practice_areas: areas,
    highlights,
  };
}

/** The CV's work history and education as a block for the candidate's notes, so nothing read is lost. */
export function cvNotes(x: CvExtract, readOn: string): string {
  const lines = [`From the CV (read ${readOn})`];
  if (x.work_history.length) {
    lines.push("Work:");
    for (const j of x.work_history) {
      const when = [j.from, j.to].filter(Boolean).join(" – ");
      lines.push(`• ${[j.role, j.firm].filter(Boolean).join(", ")}${when ? ` (${when})` : ""}`);
    }
  }
  if (x.education.length) {
    lines.push("Education:");
    for (const e of x.education) lines.push(`• ${e}`);
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

/** A pretend reading for local testing (CV_READER_FAKE=1): a name from the file name, fake details, no network. */
export function fakeExtract(fileName: string, practices: string[]): CvExtract {
  const name =
    fileName
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_\-.()\d]+/g, " ")
      .replace(/\b(cv|resume|updated|final|new|latest)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "Test Candidate";
  const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");
  return {
    full_name: name,
    phones: [],
    emails: [`${slug}@example.com`],
    linkedin_url: null,
    current_firm: "Example & Co",
    designation: "Associate",
    current_city: "Mumbai",
    qualified_on: "2021-07",
    graduation_year: 2021,
    education: ["BA LLB (Hons), Example Law School, 2021"],
    work_history: [
      { firm: "Example & Co", role: "Associate", from: "2023-01", to: "present" },
      { firm: "Sample Partners", role: "Associate", from: "2021-07", to: "2022-12" },
    ],
    practice_areas: practices.slice(0, 2),
    highlights: ["Test reading: no AI was used", "5 years across two firms", "Works on general corporate matters"],
  };
}
