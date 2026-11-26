// The CV cover page. Run: node --no-warnings tests/cover.test.mjs
// Fake people only. Set COVER_OUT=<folder> to also write the PDFs there for a look.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { buildCover, drawable } from "../lib/cover-pdf.ts";

let n = 0;
const ok = (cond, msg) => (assert.ok(cond, msg), n++);
const serif = fs.readFileSync(new URL("../public/fonts/InstrumentSerif-Regular.ttf", import.meta.url));
// A 1×1 PNG stands in for a firm's logo.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function fakeCv(pages, size = [612, 792]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) doc.addPage(size).drawText(`Test CV page ${i + 1}`, { x: 50, y: 700, size: 12, font });
  return doc.save();
}

const data = {
  firmName: "Example Search Partners",
  logo: { bytes: png, type: "png" },
  name: "Test Candidate",
  role: "Senior Associate, Example & Co",
  facts: [
    { label: "Experience", value: "5.4 yrs PQE" },
    { label: "Based in", value: "Mumbai" },
    { label: "Current CTC", value: "₹ 24 L" },
  ],
  practiceAreas: ["General Corporate", "Mergers and Acquisitions"],
  highlights: ["Five years of M&A work across two firms", "Led diligence on two listed-company acquisitions", "Gold medal, Example Law School"],
  sharedLine: "Shared in confidence with Example Client for Corporate associate, Mumbai",
  byLine: "27 Nov 2026 · Test Recruiter, Example Search Partners",
};

const joined = await buildCover(data, serif, { bytes: await fakeCv(2), isPdf: true });
const j = await PDFDocument.load(joined.bytes, { updateMetadata: false });
ok(joined.joined && j.getPageCount() === 3, "cover + a 2-page CV = one 3-page file");
ok(j.getPage(0).getSize().width === 612, "the cover takes the CV's paper size (Letter here)");
ok(j.getTitle() === "Test Candidate - Example Search Partners", "the file is titled with the candidate and the firm");
ok(!/covaro|pdf-lib/i.test(`${j.getProducer()} ${j.getCreator()}`), "nothing in the file names the app or the library");

const word = await buildCover({ ...data, logo: null }, serif, { bytes: new Uint8Array([1, 2, 3]), isPdf: false });
ok(!word.joined && word.reason === "not_pdf" && (await PDFDocument.load(word.bytes)).getPageCount() === 1, "a Word CV gets the cover on its own");
ok((await PDFDocument.load(word.bytes)).getPage(0).getSize().width === 595.28, "…on A4");

const broken = await buildCover(data, serif, { bytes: new TextEncoder().encode("not a pdf"), isPdf: true });
ok(!broken.joined && broken.reason === "unreadable", "a PDF that can't be opened gets the cover on its own");

const bare = await buildCover({ ...data, logo: null, role: null, facts: [], practiceAreas: [], highlights: [] }, serif, null);
ok(bare.reason === "no_cv" && bare.bytes.length > 0, "a cover with only a name still works");

const long = await buildCover({ ...data, highlights: Array(4).fill("A very long highlight ".repeat(30)) }, serif, null);
ok(long.bytes.length > 0, "very long highlights don't break the page");

const doc = await PDFDocument.create();
const helv = await doc.embedFont(StandardFonts.Helvetica);
ok(drawable(helv, "₹24 L") === "Rs 24 L", "₹ becomes Rs");
ok(drawable(helv, "Zoë Śharma") === "Zoë Sharma", "letters the font lacks fall back to the plain letter");
ok(drawable(helv, "Name 名前") === "Name", "characters with no fallback are dropped");

if (process.env.COVER_OUT) {
  fs.writeFileSync(`${process.env.COVER_OUT}/cover-joined.pdf`, joined.bytes);
  fs.writeFileSync(`${process.env.COVER_OUT}/cover-word.pdf`, word.bytes);
  fs.writeFileSync(`${process.env.COVER_OUT}/cover-bare.pdf`, bare.bytes);
}
console.log(`${n} cover checks passed`);
