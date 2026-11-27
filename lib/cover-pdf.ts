// The one-page cover put in front of a CV when it's shared: the firm's logo and name, who the
// candidate is and what stands out. Drawn with pdf-lib, in the browser (Download, Preview) or on the
// server (sending from Gmail). No phone or email on it: those stay on the CV itself.
// No app imports, so tests/cover.test.mjs can build one straight from Node.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type CoverData = {
  firmName: string;
  logo: { bytes: ArrayBuffer | Uint8Array; type: "png" | "jpg" } | null;
  name: string;
  /** "Senior Associate, AZB & Partners" */
  role: string | null;
  /** Short label/value pairs, already formatted: Experience, Based in, and CTC and notice when ticked. */
  facts: { label: string; value: string }[];
  practiceAreas: string[];
  highlights: string[];
  /** "Shared in confidence with JSA for TMT associate, Mumbai" */
  sharedLine: string;
  /** "27 Nov 2026 · Khyati Shrestha, Paradigm Shifters" */
  byLine: string;
};

export type CoverResult = {
  bytes: Uint8Array;
  /** The CV's own pages follow the cover in the same file. */
  joined: boolean;
  /** Why the CV couldn't be joined, when it wasn't. */
  reason?: "no_cv" | "not_pdf" | "locked" | "unreadable";
};

const A4: [number, number] = [595.28, 841.89];
const INK = rgb(0x1d / 255, 0x2a / 255, 0x24 / 255);
const MUTED = rgb(0x66 / 255, 0x73 / 255, 0x6c / 255);
const PANEL = rgb(0xf4 / 255, 0xf6 / 255, 0xf3 / 255);
const LINE = rgb(0xe2 / 255, 0xe7 / 255, 0xe1 / 255);

type Fonts = { serif: PDFFont; sans: PDFFont; bold: PDFFont; italic: PDFFont };
const charSets = new WeakMap<PDFFont, Set<number>>();

/** Text the font can draw: ₹ becomes Rs, accents fall back to the plain letter, anything else is dropped. */
export function drawable(font: PDFFont, text: string): string {
  let ok = charSets.get(font);
  if (!ok) charSets.set(font, (ok = new Set(font.getCharacterSet())));
  const s = text.replace(/₹\s?/g, "Rs ").replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim();
  let out = "";
  for (const ch of s) {
    if (ok.has(ch.codePointAt(0)!)) out += ch;
    else {
      const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      if (base && [...base].every((c) => ok!.has(c.codePointAt(0)!))) out += base;
    }
  }
  return out.replace(/ {2,}/g, " ").trim();
}

/** Greedy word wrap; a word longer than the line is cut. */
function wrap(font: PDFFont, size: number, text: string, width: number): string[] {
  const words = drawable(font, text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (let w of words) {
    while (font.widthOfTextAtSize(w, size) > width) {
      let cut = w.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--;
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Small capitals-style label: upper case with a little air between letters. */
function spaced(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, color = MUTED) {
  let cx = x;
  for (const ch of drawable(font, text.toUpperCase())) {
    page.drawText(ch, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + size * 0.12;
  }
}

function roundedRect(page: PDFPage, x: number, y: number, w: number, h: number, r: number) {
  // drawSvgPath measures from the top-left with y going down.
  const path = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
  page.drawSvgPath(path, { x, y: y + h, color: PANEL });
}

async function drawCover(doc: PDFDocument, d: CoverData, fonts: Fonts, size: [number, number], cvFollows: boolean) {
  const [W, H] = size;
  const page = doc.insertPage(0, size);
  const M = Math.round(W * 0.105);
  const width = W - 2 * M;
  const { serif, sans, bold, italic } = fonts;
  let y = H - M;

  // Header: the firm's logo, or its name as a wordmark when there's no logo.
  const headerH = 52;
  let logoDrawn = false;
  if (d.logo) {
    try {
      const img = d.logo.type === "png" ? await doc.embedPng(d.logo.bytes) : await doc.embedJpg(d.logo.bytes);
      const scale = Math.min(170 / img.width, headerH / img.height, 1.5);
      page.drawImage(img, { x: M, y: y - img.height * scale, width: img.width * scale, height: img.height * scale });
      logoDrawn = true;
    } catch {
      // A broken image: fall back to the name rather than fail the whole cover.
    }
  }
  // The logo already carries the name (and the footer repeats it), so the name is drawn only without one.
  if (!logoDrawn) page.drawText(drawable(serif, d.firmName), { x: M, y: y - 26, size: 26, font: serif, color: INK });
  y -= headerH + 22;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: INK });

  // Who they are.
  y -= 34;
  spaced(page, bold, "Candidate profile", M, y, 8.5);
  y -= 44;
  let nameSize = 40;
  const name = drawable(serif, d.name);
  while (nameSize > 26 && serif.widthOfTextAtSize(name, nameSize) > width) nameSize -= 1;
  for (const line of wrap(serif, nameSize, d.name, width).slice(0, 2)) {
    page.drawText(line, { x: M, y, size: nameSize, font: serif, color: INK });
    y -= nameSize * 1.05;
  }
  if (d.role) {
    y -= 2;
    for (const line of wrap(sans, 13, d.role, width).slice(0, 2)) {
      page.drawText(line, { x: M, y, size: 13, font: sans, color: INK });
      y -= 18;
    }
  }

  // The facts, on a quiet panel: up to three to a row, then the practice areas across the width.
  // Laid out first, so the panel can be drawn behind them at the right height.
  const facts = d.facts.filter((f) => f.value.trim());
  const practice = d.practiceAreas.length ? wrap(sans, 11.5, d.practiceAreas.join(", "), width - 36).slice(0, 3) : [];
  if (facts.length || practice.length) {
    const pad = 18;
    const top = y - 22;
    const colW = (width - pad * 2) / 3;
    const draw: (() => void)[] = [];
    let fy = top - pad - 7;
    let bottom = fy;
    facts.forEach((f, i) => {
      const cx = M + pad + (i % 3) * colW;
      const ry = fy - Math.floor(i / 3) * 40;
      const v = drawable(bold, f.value);
      let vs = 12.5;
      while (vs > 9 && bold.widthOfTextAtSize(v, vs) > colW - 10) vs -= 0.5;
      draw.push(() => {
        spaced(page, bold, f.label, cx, ry, 7.5);
        page.drawText(v, { x: cx, y: ry - 17, size: vs, font: bold, color: INK });
      });
      bottom = Math.min(bottom, ry - 17);
    });
    if (facts.length) fy = bottom - 24;
    if (practice.length) {
      const ly = fy;
      draw.push(() => spaced(page, bold, "Practice", M + pad, ly, 7.5));
      let py = ly - 17;
      for (const line of practice) {
        const at = py;
        draw.push(() => page.drawText(line, { x: M + pad, y: at, size: 11.5, font: sans, color: INK }));
        bottom = at;
        py -= 16;
      }
    }
    const panelH = top - bottom + pad - 4;
    roundedRect(page, M, top - panelH, width, panelH, 10);
    draw.forEach((f) => f());
    y = top - panelH;
  }

  // What stands out: the highlights, kept above the footer.
  const footerTop = M + 40;
  if (d.highlights.length) {
    y -= 40;
    page.drawText("What stands out", { x: M, y, size: 19, font: serif, color: INK });
    y -= 22;
    for (const h of d.highlights) {
      const lines = wrap(sans, 11.5, h, width - 18);
      if (y - lines.length * 16.5 < footerTop + 10) break;
      page.drawCircle({ x: M + 3.5, y: y + 3.6, size: 2.1, color: INK });
      for (const line of lines) {
        page.drawText(line, { x: M + 16, y, size: 11.5, font: sans, color: INK, lineHeight: 16.5 });
        y -= 16.5;
      }
      y -= 7;
    }
  }

  // Footer: who it was shared with, when, by whom.
  page.drawLine({ start: { x: M, y: footerTop }, end: { x: W - M, y: footerTop }, thickness: 0.6, color: LINE });
  const shared = wrap(sans, 9, d.sharedLine, width * (cvFollows ? 0.68 : 1))[0] ?? "";
  page.drawText(shared, { x: M, y: footerTop - 18, size: 9, font: sans, color: MUTED });
  page.drawText(wrap(sans, 9, d.byLine, width)[0] ?? "", { x: M, y: footerTop - 31, size: 9, font: sans, color: MUTED });
  if (cvFollows) {
    const t = "Full CV on the following pages";
    page.drawText(t, { x: W - M - italic.widthOfTextAtSize(t, 9), y: footerTop - 18, size: 9, font: italic, color: MUTED });
  }
}

/**
 * The cover, followed by the CV's own pages when it's a readable PDF. Word CVs and locked PDFs
 * get the cover on its own (reason says why), to attach next to the CV.
 */
export async function buildCover(d: CoverData, serifTtf: ArrayBuffer | Uint8Array, cv: { bytes: ArrayBuffer | Uint8Array; isPdf: boolean } | null): Promise<CoverResult> {
  let src: PDFDocument | null = null;
  let reason: CoverResult["reason"] = cv ? undefined : "no_cv";
  if (cv && !cv.isPdf) reason = "not_pdf";
  else if (cv) {
    try {
      src = await PDFDocument.load(cv.bytes, { ignoreEncryption: true });
      if (src.isEncrypted) {
        src = null;
        reason = "locked";
      }
    } catch {
      reason = "unreadable";
    }
  }

  // updateMetadata off: otherwise pdf-lib signs the file as its own producer.
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(fontkit);
  const fonts: Fonts = {
    serif: await doc.embedFont(serifTtf, { subset: true }),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };

  // Same paper as the CV (A4 or Letter), so the file prints evenly.
  let size = A4;
  if (src && src.getPageCount()) {
    const { width, height } = src.getPage(0).getSize();
    if (width > 400 && width < 700 && height > 600 && height < 1000) size = [width, height];
  }
  if (src) {
    const pages = await doc.copyPages(src, src.getPageIndices());
    pages.forEach((p) => doc.addPage(p));
  }
  await drawCover(doc, d, fonts, size, !!src);

  const title = `${d.name} - ${d.firmName}`;
  doc.setTitle(drawable(fonts.sans, title));
  doc.setAuthor(drawable(fonts.sans, d.firmName));
  doc.setCreator(drawable(fonts.sans, d.firmName));
  doc.setProducer(drawable(fonts.sans, d.firmName));
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());
  return { bytes: await doc.save(), joined: !!src, reason: src ? undefined : reason };
}
