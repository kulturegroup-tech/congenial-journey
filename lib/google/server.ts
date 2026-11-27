import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { openToken } from "./core";

// Connect Google on the server: settings from env, Google's token endpoint, and a fresh access
// token for any connected teammate (later steps call googleAccessToken). Tokens are never logged.

type Db = Awaited<ReturnType<typeof createClient>>;

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const tokenKey = process.env.GOOGLE_TOKEN_KEY;
  return clientId && clientSecret && tokenKey ? { clientId, clientSecret, tokenKey } : null;
}

/**
 * The site's public address. Render and Vercel end HTTPS in front of the app, so the request can look
 * like plain http; Google needs the exact https address registered in the firm's Google project.
 */
export function publicOrigin(request: { headers: Headers; nextUrl: { host: string } }) {
  return originFromHeaders(request.headers, request.nextUrl.host);
}

/** The same, from a Server Action's headers(). */
export function originFromHeaders(h: { get(name: string): string | null }, fallbackHost = "localhost") {
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() || h.get("host") || fallbackHost;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (local ? "http" : "https");
  return `${local ? proto : "https"}://${host}`;
}

export const redirectUriFor = (origin: string) => process.env.GOOGLE_REDIRECT_URI || `${origin}/api/google/callback`;

export type TokenReply = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; id_token?: string; error?: string };

async function tokenCall(body: Record<string, string>): Promise<TokenReply> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await res.json().catch(() => ({}))) as TokenReply;
    if (!res.ok) console.error(`Google token endpoint answered ${res.status}`);
    return res.ok ? j : { error: j.error ?? `http_${res.status}` };
  } catch {
    return { error: "unreachable" };
  }
}

export function exchangeCode(code: string, redirectUri: string) {
  const c = googleConfig()!;
  return tokenCall({ code, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" });
}

/** Tells Google to cancel the access (used on "Disconnect"); best effort. */
export async function revokeToken(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST", signal: AbortSignal.timeout(10_000) }).catch(() => null);
}

// Access tokens last about an hour; keep them per server process until a minute before they expire.
const cache = new Map<string, { token: string; until: number }>();

/**
 * A working access token for a teammate's Google account, or why not. Marks the connection broken
 * when Google refuses it (password changed, access removed), so Settings can ask them to reconnect.
 */
export type TokenProblem = "not_set_up" | "not_connected" | "key_changed" | "refused" | "unreachable";

export async function googleAccessToken(supabase: Db, memberId: string): Promise<{ token: string } | { error: string; code: TokenProblem }> {
  const c = googleConfig();
  if (!c) return { error: "Google isn't set up for this workspace yet.", code: "not_set_up" };
  const hit = cache.get(memberId);
  if (hit && hit.until > Date.now()) return { token: hit.token };

  const { data: row } = await supabase.from("google_connections").select("status, refresh_token_enc").eq("member_id", memberId).maybeSingle();
  if (!row || row.status !== "connected" || !row.refresh_token_enc) return { error: "Their Google account isn't connected.", code: "not_connected" };
  const refresh = openToken(row.refresh_token_enc, c.tokenKey);
  if (!refresh) return { error: "Their Google connection needs to be made again (the server key changed).", code: "key_changed" };

  const r = await tokenCall({ refresh_token: refresh, client_id: c.clientId, client_secret: c.clientSecret, grant_type: "refresh_token" });
  if (!r.access_token) {
    if (r.error === "invalid_grant") {
      await supabase.from("google_connections").update({ status: "broken", last_error: "Google stopped accepting this connection. Connect again." }).eq("member_id", memberId);
      return { error: "Google stopped accepting their connection. They need to connect again in Settings.", code: "refused" };
    }
    return { error: "Couldn't reach Google. Try again in a minute.", code: "unreachable" };
  }
  cache.set(memberId, { token: r.access_token, until: Date.now() + Math.max(60, (r.expires_in ?? 3600) - 60) * 1000 });
  return { token: r.access_token };
}

export const forgetAccessToken = (memberId: string) => cache.delete(memberId);
