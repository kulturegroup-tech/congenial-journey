// Connect Google: token sealing, the sign-in link, who signed in. Run: node --no-warnings tests/google.test.mjs
import assert from "node:assert/strict";
import { authUrl, emailFromIdToken, missingScopes, openToken, REQUIRED_SCOPES, sameState, sealToken } from "../lib/google/core.ts";

let n = 0;
const ok = (c, m) => (assert.ok(c, m), n++);

const sealed = sealToken("1//fake-refresh-token", "server-key-one");
ok(sealed.startsWith("v1.") && !sealed.includes("fake-refresh-token"), "the stored token is unreadable");
ok(openToken(sealed, "server-key-one") === "1//fake-refresh-token", "the server key opens it");
ok(openToken(sealed, "another-key") === null, "another key can't");
const parts = sealed.split(".");
parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA");
ok(openToken(parts.join("."), "server-key-one") === null, "a tampered token is refused");
ok(sealToken("same", "k") !== sealToken("same", "k"), "sealing the same token twice gives different text");

const url = new URL(authUrl({ clientId: "cid.apps.googleusercontent.com", redirectUri: "https://example.onrender.com/api/google/callback", state: "s1", loginHint: "kumar@example.com" }));
ok(url.origin === "https://accounts.google.com", "connect goes to Google's sign-in");
ok(url.searchParams.get("access_type") === "offline" && url.searchParams.get("prompt") === "consent", "asks for a lasting connection every time");
ok(REQUIRED_SCOPES.every((s) => url.searchParams.get("scope").includes(s)), "asks for Gmail send, Gmail read and Calendar at once");
ok(url.searchParams.get("login_hint") === "kumar@example.com" && url.searchParams.get("state") === "s1", "suggests their work account and carries the state");

const jwt = (claims) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;
ok(emailFromIdToken(jwt({ email: "Kumar@Example.com", email_verified: true })) === "kumar@example.com", "reads the signed-in email");
ok(emailFromIdToken(jwt({ email: "a@example.com", email_verified: false })) === null, "an unverified email doesn't count");
ok(emailFromIdToken("garbage") === null && emailFromIdToken(undefined) === null, "junk gives nothing");

ok(missingScopes(REQUIRED_SCOPES.join(" ") + " openid email").length === 0, "all boxes ticked: nothing missing");
ok(missingScopes("openid email https://www.googleapis.com/auth/calendar.events").length === 2, "unticked Gmail boxes are noticed");
ok(sameState("abc", "abc") && !sameState("abc", "abd") && !sameState(undefined, "abc"), "the state must match exactly");

console.log(`${n} Google checks passed`);
