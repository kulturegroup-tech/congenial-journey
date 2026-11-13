// Reads when the signed-in session's access token expires, straight from the Supabase cookie,
// without calling Supabase. proxy.ts uses it to skip the session refresh while the token is
// still fresh. It proves nothing about who someone is: pages verify the token (getSession) and
// row-level security guards the data. Import-free so tests/forms.test.mjs can run it.

/** Seconds since 1970 when the access token expires, or null when there's no readable session. */
export function sessionExpiry(get: (name: string) => string | undefined, projectRef: string): number | null {
  const key = `sb-${projectRef}-auth-token`;
  let raw = get(key);
  if (!raw) {
    const parts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const chunk = get(`${key}.${i}`);
      if (!chunk) break;
      parts.push(chunk);
    }
    raw = parts.join("") || undefined;
  }
  if (!raw) return null;
  try {
    const json = raw.startsWith("base64-") ? fromBase64Url(raw.slice(7)) : raw;
    const session = JSON.parse(json) as { expires_at?: unknown; user?: { id?: unknown } };
    return typeof session.expires_at === "number" && typeof session.user?.id === "string" ? session.expires_at : null;
  } catch {
    return null;
  }
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
