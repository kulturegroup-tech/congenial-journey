// The email Covaro sends from someone's own Gmail when they share a CV: reading the To and CC boxes,
// safe headers, the note as plain text and HTML (with their Gmail signature), and the attachments,
// put together as one MIME message for Gmail's upload endpoint.
// No app imports, so tests/gmail.test.mjs runs it straight from Node.

export type Attachment = { fileName: string; mimeType: string; bytes: Uint8Array };

export type Mail = {
  from?: { name?: string | null; email: string } | null;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  html: string;
  attachments: Attachment[];
};

// Gmail turns away anything over 25 MB for most recipients' servers anyway.
export const MAX_ATTACHMENTS_BYTES = 25 * 1024 * 1024;

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export const isEmail = (s: string) => s.length <= 254 && EMAIL.test(s);

/**
 * Reads a To or CC box: "a@firm.com, b@firm.com; Name <c@firm.com>". Returns the addresses in
 * order, without repeats (ignoring case), and anything that isn't an address.
 */
export function readAddresses(input: string | null | undefined): { emails: string[]; bad: string[] } {
  const emails: string[] = [];
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const raw of (input ?? "").split(/[,;\n]+/)) {
    const part = raw.trim();
    if (!part) continue;
    const inAngles = part.match(/<([^<>]+)>\s*$/);
    const email = (inAngles ? inAngles[1] : part).trim();
    if (!isEmail(email)) {
      bad.push(part);
      continue;
    }
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }
  return { emails, bad };
}

/** No line breaks or other control characters in a header: they would let text add headers of its own. */
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();

const isAscii = (s: string) => /^[\x20-\x7e]*$/.test(s);

const utf8 = (s: string) => new TextEncoder().encode(s);

function base64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Base64 in lines of 76, as mail wants it. */
export const wrap76 = (b64: string) => b64.replace(/.{1,76}/g, "$&\r\n").replace(/\r\n$/, "");

/** A header value Gmail and every mail app reads: plain ASCII as it is, anything else as UTF-8 encoded words. */
export function encodeWords(value: string): string {
  const s = clean(value);
  if (isAscii(s)) return s;
  // Each encoded word stays under 75 characters, and never splits a character.
  const words: string[] = [];
  let chunk = "";
  for (const ch of s) {
    if (utf8(chunk + ch).length > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${base64(utf8(w))}?=`).join("\r\n ");
}

function address(name: string | null | undefined, email: string): string {
  const n = clean(name ?? "");
  if (!n) return email;
  return isAscii(n) ? `"${n.replace(/["\\]/g, "\\$&")}" <${email}>` : `${encodeWords(n)} <${email}>`;
}

function fileParams(fileName: string) {
  const name = clean(fileName) || "attachment";
  if (isAscii(name)) {
    const q = `"${name.replace(/["\\]/g, "\\$&")}"`;
    return { type: `name=${q}`, disposition: `filename=${q}` };
  }
  const pct = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return { type: `name="${encodeWords(name)}"`, disposition: `filename*=UTF-8''${pct}` };
}

const randomBoundary = () => {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return `=_covaro_${[...b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
};

/**
 * The whole message as text, ready to upload to Gmail (message/rfc822). Everything in it is ASCII:
 * non-English text is encoded, and the body and files are base64. Boundaries start with "=_",
 * which base64 can never contain, so no file can break the message apart.
 */
export function buildMime(mail: Mail, boundary: string = randomBoundary()): string {
  const outer = `${boundary}_m`;
  const alt = `${boundary}_a`;
  const headers = [
    mail.from?.email && isEmail(mail.from.email) ? `From: ${address(mail.from.name, mail.from.email)}` : null,
    // Long lists are folded onto continuation lines, so no header line gets too long for mail servers.
    `To: ${mail.to.filter(isEmail).join(",\r\n ")}`,
    mail.cc.filter(isEmail).length ? `Cc: ${mail.cc.filter(isEmail).join(",\r\n ")}` : null,
    `Subject: ${encodeWords(mail.subject)}`,
    "MIME-Version: 1.0",
  ].filter((h): h is string => !!h);

  const body = [
    `--${alt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(base64(utf8(mail.text))),
    `--${alt}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(base64(utf8(mail.html))),
    `--${alt}--`,
  ];

  if (!mail.attachments.length) {
    return [...headers, `Content-Type: multipart/alternative; boundary="${alt}"`, "", ...body, ""].join("\r\n");
  }
  const files = mail.attachments.flatMap((a) => {
    const p = fileParams(a.fileName);
    return [
      `--${outer}`,
      `Content-Type: ${clean(a.mimeType) || "application/octet-stream"}; ${p.type}`,
      `Content-Disposition: attachment; ${p.disposition}`,
      "Content-Transfer-Encoding: base64",
      "",
      wrap76(base64(a.bytes)),
    ];
  });
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${outer}"`,
    "",
    `--${outer}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    "",
    ...body,
    ...files,
    `--${outer}--`,
    "",
  ].join("\r\n");
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The note as the HTML part, with their Gmail signature under it (Gmail doesn't add it to mail sent this way). */
export function noteHtml(note: string, signatureHtml?: string | null): string {
  const lines = note.replace(/\r\n?/g, "\n").split("\n").map(escapeHtml).join("<br>\n");
  const sig = signatureHtml?.trim() ? `<br>\n<div class="gmail_signature">${signatureHtml.trim()}</div>` : "";
  return `<div dir="ltr">${lines}${sig}</div>`;
}

/** The signature as plain text, for the plain-text part. */
export function signatureText(html: string | null | undefined): string {
  if (!html?.trim()) return "";
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/?\s*(p|div|tr|li|table|h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" })[e as string]!)
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** The note as the plain-text part, with the signature under the usual "-- " line. */
export function noteText(note: string, signatureHtml?: string | null): string {
  const sig = signatureText(signatureHtml);
  return note.replace(/\r\n?/g, "\n") + (sig ? `\n\n-- \n${sig}` : "");
}

/** Opens the sent email in Gmail, in the right account if they have several. */
export const gmailThreadUrl = (threadId: string, email?: string | null) =>
  `https://mail.google.com/mail/${email ? `?authuser=${encodeURIComponent(email)}` : ""}#all/${encodeURIComponent(threadId)}`;

/** Gmail's answer to a send, in words for the person who pressed the button. */
export function sendProblem(status: number | null, body?: { error?: { message?: string; errors?: { reason?: string }[] } } | null): string {
  if (status == null) return "Couldn't reach Gmail. Check the internet and try again.";
  const reason = body?.error?.errors?.[0]?.reason ?? "";
  if (status === 401) return "Google asked you to sign in again. Connect Google again in Settings, then try again.";
  if (status === 403 && /insufficient|scope|forbidden/i.test(reason + (body?.error?.message ?? "")))
    return "Google hasn't allowed sending from your Gmail. Connect Google again in Settings and tick every box.";
  if (status === 403) return "Gmail refused to send this from your account. Ask your Google admin, or open the email yourself instead.";
  if (status === 413) return "The attachments are too big for Gmail.";
  if (status === 429) return "Gmail says you've sent a lot just now. Wait a few minutes and try again.";
  if (status >= 500) return "Gmail had a problem. Try again in a minute.";
  return "Gmail refused the email. Check the To and CC addresses.";
}
