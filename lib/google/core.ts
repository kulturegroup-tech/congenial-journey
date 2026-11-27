// The parts of Connect Google that need no server or network: sealing the token, the sign-in
// link, reading who signed in. No app imports, so tests/google.test.mjs can load it from Node.
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** What every connected account allows. Asked for once, so people connect a single time. */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send", // send CV shares from their own Gmail
  "https://www.googleapis.com/auth/gmail.readonly", // show the emails with a candidate or client, live
  "https://www.googleapis.com/auth/calendar.events", // calls and interviews both ways
];
export const REQUIRED_SCOPES = GOOGLE_SCOPES.filter((s) => s.startsWith("https://"));

const keyFrom = (secret: string) => createHash("sha256").update(secret).digest();
const b64 = (b: Buffer) => b.toString("base64url");

/** Encrypts the refresh token with the server's key (AES-256-GCM). "v1.<iv>.<tag>.<data>". */
export function sealToken(token: string, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const data = Buffer.concat([c.update(token, "utf8"), c.final()]);
  return ["v1", b64(iv), b64(c.getAuthTag()), b64(data)].join(".");
}

/** The token back, or null when it was sealed with another key or has been tampered with. */
export function openToken(sealed: string, secret: string): string | null {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const newState = () => b64(randomBytes(32));
export function sameState(a: string | undefined, b: string | undefined) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Google's sign-in page for connecting. Offline + consent, so Google always returns a refresh token. */
export function authUrl(o: { clientId: string; redirectUri: string; state: string; loginHint?: string | null }) {
  const p = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: o.state,
  });
  if (o.loginHint) p.set("login_hint", o.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** The signed-in email from the id_token Google's token endpoint returned to us directly (over TLS). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  const part = idToken?.split(".")[1];
  if (!part) return null;
  try {
    const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as { email?: string; email_verified?: boolean };
    return claims.email && claims.email_verified !== false ? claims.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Which of the scopes we need the person actually ticked on Google's screen. */
export const missingScopes = (granted: string) => REQUIRED_SCOPES.filter((s) => !granted.split(/\s+/).includes(s));
