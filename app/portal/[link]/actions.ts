"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { formatDateTime } from "@/lib/format";
import { isPortalLink, PORTAL_COOKIE, PORTAL_HOURS, portalToken, visitor } from "@/lib/portal";

// The client portal's three actions. Anyone on the internet can call these, so they only pass the
// link, code and session token to the portal_* functions, which decide everything.

export type SignInState = { error?: string } | null;

export async function portalSignIn(link: string, _: SignInState, fd: FormData): Promise<SignInState> {
  const code = String(fd.get("code") ?? "").replace(/\D+/g, "");
  if (code.length !== 6) return { error: "Type the 6 digits of your code." };
  if (!isPortalLink(link)) return { error: "This link doesn't work. Ask the person who sent it for a new one." };
  const { data, error } = await visitor().rpc("portal_sign_in", { p_link: link, p_code: code });
  if (error || !data) return { error: "Couldn't sign you in just now. Try again in a minute." };
  const r = data as { token?: string; error?: string; tries_left?: number; until?: string };
  if (r.error === "link") return { error: "This link doesn't work any more. Ask the person who sent it for a new one." };
  if (r.error === "locked") return { error: `Too many wrong codes. Try again after ${r.until ? formatDateTime(r.until) : "15 minutes"}.` };
  if (r.error === "code") return { error: `That code isn't right. ${r.tries_left} ${r.tries_left === 1 ? "try" : "tries"} left before it locks for 15 minutes.` };
  if (!r.token) return { error: "Couldn't sign you in just now. Try again in a minute." };
  (await cookies()).set(PORTAL_COOKIE, r.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/portal",
    maxAge: PORTAL_HOURS * 3600,
  });
  refresh();
  return null;
}

export async function portalFeedback(link: string, shareId: string, verdict: string, note: string): Promise<{ error?: string }> {
  const token = await portalToken();
  if (!token) return { error: "You've been signed out. Sign in again with your code." };
  const { data, error } = await visitor().rpc("portal_give_feedback", {
    p_link: link,
    p_token: token,
    p_share: shareId,
    p_verdict: verdict,
    p_note: note.slice(0, 2000),
  });
  if (error || !data) return { error: "Couldn't save that just now. Try again in a minute." };
  const r = data as { ok?: boolean; error?: string };
  if (r.error === "session") return { error: "You've been signed out. Sign in again with your code." };
  if (r.error) return { error: "Couldn't save that. Reload the page and try again." };
  refresh();
  return {};
}

export async function portalSignOut(): Promise<void> {
  const token = await portalToken();
  if (token) await visitor().rpc("portal_sign_out", { p_token: token });
  (await cookies()).delete({ name: PORTAL_COOKIE, path: "/portal" });
  refresh();
}
