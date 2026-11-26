import "server-only";

import { CV_SYSTEM, CV_TOOL_NAME, cvTool, fakeExtract, tidyExtract, type CvExtract } from "@/lib/cv-extract";

// Reads one CV with the Claude API (Anthropic) and returns the tidied details.
// The firm's own key is ANTHROPIC_API_KEY on the server; ANTHROPIC_MODEL picks the model.
// CV_READER_FAKE=1 returns a pretend reading without calling anyone (local testing).
// Nothing from the CV is ever logged: errors carry the status code only.

const API = "https://api.anthropic.com/v1/messages";
export const CV_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
export const MAX_CV_BYTES = 10 * 1024 * 1024;

export const cvReaderFake = () => process.env.CV_READER_FAKE === "1";
export const cvReaderKeySet = () => cvReaderFake() || !!process.env.ANTHROPIC_API_KEY;

export type CvKind = "pdf" | "docx" | "doc" | "other";
export function cvKind(fileName: string, mime: string | null): CvKind {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (ext === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (ext === "doc" || mime === "application/msword") return "doc";
  return "other";
}

async function wordText(bytes: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return value.replace(/\n{3,}/g, "\n\n").trim();
}

function apiError(status: number, body: string): string {
  if (status === 401 || status === 403) return "The Claude API key was refused. Check ANTHROPIC_API_KEY on the server.";
  if (status === 429) return "Too many CVs at once for the Claude account's limit. Try again in a minute.";
  if (status === 529 || status === 503) return "Claude is busy right now. Try again in a minute.";
  if (status === 400 && /credit|balance|billing/i.test(body)) return "The Claude account is out of credit. Add credit in the Claude Console.";
  if (status === 400 && /pdf|document/i.test(body)) return "Claude couldn't open this PDF. If it has a password, save a copy without one.";
  if (status === 400 && /too long|too large|exceed/i.test(body)) return "This file is too long to read. Upload a shorter CV.";
  return `Claude couldn't read this CV (error ${status}). Try again, or fill the details in by hand.`;
}

export async function readCv(
  file: { bytes: ArrayBuffer; fileName: string; mime: string | null },
  practices: string[],
  todayLabel: string,
): Promise<{ extract: CvExtract } | { error: string }> {
  const kind = cvKind(file.fileName, file.mime);
  if (kind === "doc") return { error: "Old Word files (.doc) can't be read. Save it as PDF or .docx and upload that." };
  if (kind === "other") return { error: "Only PDF and Word (.docx) CVs can be read." };
  if (file.bytes.byteLength > MAX_CV_BYTES) return { error: "This file is over 10 MB. Upload a smaller copy." };

  // Word files are turned into text here; PDFs go to Claude as they are (it reads scanned ones too).
  let doc: Record<string, unknown>;
  if (kind === "pdf") {
    doc = { type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(file.bytes).toString("base64") } };
  } else {
    let text: string;
    try {
      text = await wordText(file.bytes);
    } catch {
      return { error: "Couldn't open this Word file. Save it as PDF and upload that." };
    }
    if (text.length < 40) return { error: "This Word file has almost no text in it. Upload the PDF instead." };
    doc = { type: "text", text: `The CV (text taken from a Word file):\n\n${text.slice(0, 60_000)}` };
  }

  if (cvReaderFake()) return { extract: fakeExtract(file.fileName, practices) };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: "The Claude API key isn't set on the server yet." };

  let res: Response;
  try {
    res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: CV_MODEL,
        max_tokens: 2048,
        system: CV_SYSTEM,
        tools: [cvTool(practices)],
        tool_choice: { type: "tool", name: CV_TOOL_NAME },
        messages: [{ role: "user", content: [doc, { type: "text", text: `Today is ${todayLabel}. Record this CV.` }] }],
      }),
      signal: AbortSignal.timeout(100_000),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return { error: timedOut ? "Claude took too long on this CV. Try again." : "Couldn't reach Claude. Check the internet and try again." };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`CV reader: Claude API answered ${res.status}`);
    return { error: apiError(res.status, body) };
  }
  const data = (await res.json().catch(() => null)) as { content?: { type: string; name?: string; input?: unknown }[] } | null;
  const call = data?.content?.find((b) => b.type === "tool_use" && b.name === CV_TOOL_NAME);
  if (!call) return { error: "Claude didn't return the details. Try again." };
  const extract = tidyExtract(call.input, practices);
  if (!extract.full_name && !extract.emails.length && !extract.phones.length) return { error: "This doesn't look like a CV: no name or contact details found." };
  return { extract };
}
