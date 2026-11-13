// The proxy's quick session check. Run: node --no-warnings tests/session.test.mjs
import assert from "node:assert/strict";
import { sessionExpiry } from "../lib/supabase/session-cookie.ts";

const ref = "abcdref";
const session = { access_token: "x", refresh_token: "y", expires_at: 1_900_000_000, user: { id: "u1", user_metadata: { full_name: "Khyātī ✓" } } };
const enc = (o) => "base64-" + Buffer.from(JSON.stringify(o), "utf8").toString("base64url");
const jar = (pairs) => (name) => pairs[name];
let n = 0;
const eq = (a, b) => (assert.equal(a, b), n++);

eq(sessionExpiry(jar({ [`sb-${ref}-auth-token`]: enc(session) }), ref), 1_900_000_000);
const v = enc(session);
eq(sessionExpiry(jar({ [`sb-${ref}-auth-token.0`]: v.slice(0, 20), [`sb-${ref}-auth-token.1`]: v.slice(20) }), ref), 1_900_000_000);
eq(sessionExpiry(jar({ [`sb-${ref}-auth-token`]: JSON.stringify(session) }), ref), 1_900_000_000);
eq(sessionExpiry(jar({}), ref), null);
eq(sessionExpiry(jar({ [`sb-${ref}-auth-token`]: "base64-!!!" }), ref), null);
eq(sessionExpiry(jar({ [`sb-${ref}-auth-token`]: enc({ expires_at: 1 }) }), ref), null); // no user
eq(sessionExpiry(jar({ [`sb-other-auth-token`]: enc(session) }), ref), null);
console.log(`${n} session checks passed`);
