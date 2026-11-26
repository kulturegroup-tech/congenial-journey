// The CV reader's tidy-up of what the AI returns. Run: node --no-warnings tests/cv.test.mjs
// Fake people only.
import assert from "node:assert/strict";
import { cvNotes, cvTool, fakeExtract, pqeFromMonth, tidyExtract } from "../lib/cv-extract.ts";

let n = 0;
const eq = (a, b, msg) => (assert.deepEqual(a, b, msg), n++);
const today = new Date("2026-11-27T06:00:00Z");
const practices = ["General Corporate", "Mergers and Acquisitions", "Data Privacy and Cybersecurity"];

const x = tidyExtract(
  {
    full_name: "  Test   Person ",
    phones: ["+91 90000 00001", "call me", "90000 00001", "+91 90000 00001"],
    emails: ["Test.Person@Example.COM", "not-an-email", "mailto:other@example.in"],
    linkedin_url: "www.linkedin.com/in/test-person-01",
    current_firm: "Example & Co",
    qualified_on: "2019-08",
    graduation_year: 2019,
    work_history: [{ firm: "Example & Co", role: "Associate", from: "2021-01", to: "present" }, { role: "No firm" }, "junk"],
    practice_areas: ["mergers and acquisitions", "Made-up Practice", "Mergers and Acquisitions", "General Corporate"],
    highlights: ["• Seven years in M&A", "- Led cross-border deals", "", 3],
    date_of_birth: "1990-01-01",
  },
  practices,
  today,
);
eq(x.full_name, "Test Person", "name tidied");
eq(x.phones, ["+91 90000 00001", "90000 00001"], "phones without digits dropped, exact repeats dropped");
eq(x.emails, ["test.person@example.com", "other@example.in"], "emails lower-cased, mailto: and junk dropped");
eq(x.linkedin_url, "https://www.linkedin.com/in/test-person-01", "LinkedIn gets https://");
eq(x.practice_areas, ["Mergers and Acquisitions", "General Corporate"], "practice areas matched to the firm's list, unknown ones dropped");
eq(x.highlights, ["Seven years in M&A", "Led cross-border deals"], "bullets stripped from highlights");
eq(x.work_history.length, 1, "roles without a firm dropped");
eq("date_of_birth" in x, false, "fields we never keep don't come through");
eq(pqeFromMonth(x.qualified_on, today), "7.3", "qualified Aug 2019 → 7.3 PQE in Nov 2026");

eq(tidyExtract({ qualified_on: "2027-01" }, practices, today).qualified_on, null, "a qualification date in the future is dropped");
eq(tidyExtract({ qualified_on: "Aug 2019" }, practices, today).qualified_on, null, "a date not in YYYY-MM is dropped");
eq(tidyExtract({ linkedin_url: "https://example.com/me" }, practices, today).linkedin_url, null, "a non-LinkedIn URL is dropped");
eq(tidyExtract({ graduation_year: 3019 }, practices, today).graduation_year, null, "an impossible year is dropped");
eq(tidyExtract(null, practices, today).phones, [], "an empty answer gives an empty record");
eq(pqeFromMonth(null, today), "", "no date, no PQE");

const notes = cvNotes(x, "27 Nov 2026");
assert.ok(notes.startsWith("From the CV (read 27 Nov 2026)") && notes.includes("• Associate, Example & Co (2021-01 – present)")); n++;
eq(cvNotes(tidyExtract({}, practices, today), "27 Nov 2026"), "", "nothing read, no notes block");

const tool = cvTool(practices);
eq(tool.input_schema.properties.practice_areas.items.enum, practices, "the AI may only pick from the firm's practice list");
eq(fakeExtract("Asha_Rao_CV_2026.pdf", practices).full_name, "Asha Rao", "test mode takes the name from the file name");

console.log(`${n} CV reader checks passed`);
