import "server-only";

import { sendProblem } from "./gmail-core";

// Gmail on the server: who the person sends as (name, address, signature) and the send itself.
// Nothing here is logged: not the message, not the addresses, not the token.

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const UPLOAD = "https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media";

export type SendAs = { email: string; name: string | null; signature: string | null };

// Signatures rarely change: keep each person's for 10 minutes per server process.
const sendAsCache = new Map<string, { value: SendAs | null; until: number }>();

/** Their default "send mail as" address, display name and Gmail signature. Null if Gmail won't say. */
export async function sendAsFor(memberId: string, token: string): Promise<SendAs | null> {
  const hit = sendAsCache.get(memberId);
  if (hit && hit.until > Date.now()) return hit.value;
  const res = await fetch(`${GMAIL}/settings/sendAs`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  let value: SendAs | null = null;
  if (res?.ok) {
    const j = (await res.json().catch(() => ({}))) as {
      sendAs?: { sendAsEmail?: string; displayName?: string; signature?: string; isDefault?: boolean; isPrimary?: boolean }[];
    };
    const list = j.sendAs ?? [];
    const pick = list.find((s) => s.isDefault) ?? list.find((s) => s.isPrimary) ?? list[0];
    if (pick?.sendAsEmail) value = { email: pick.sendAsEmail, name: pick.displayName?.trim() || null, signature: pick.signature?.trim() || null };
  }
  sendAsCache.set(memberId, { value, until: Date.now() + 10 * 60_000 });
  return value;
}

export type Sent = { ok: true; id: string; threadId: string } | { ok: false; status: number | null; problem: string };

/** Sends a whole MIME message from their Gmail. It lands in their Sent folder like any other email. */
export async function sendMime(token: string, mime: string): Promise<Sent> {
  const res = await fetch(UPLOAD, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "message/rfc822" },
    body: mime,
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null);
  if (!res) return { ok: false, status: null, problem: sendProblem(null) };
  const j = (await res.json().catch(() => null)) as { id?: string; threadId?: string; error?: { message?: string; errors?: { reason?: string }[] } } | null;
  if (res.ok && j?.id) return { ok: true, id: j.id, threadId: j.threadId ?? j.id };
  console.error(`Gmail send answered ${res.status}`);
  return { ok: false, status: res.status, problem: sendProblem(res.status, j) };
}
