import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailFromIdToken, missingScopes, sameState, sealToken } from "@/lib/google/core";
import { exchangeCode, forgetAccessToken, googleConfig, publicOrigin, redirectUriFor } from "@/lib/google/server";

// Google sends the person back here after they allow (or refuse) Covaro. We check it's the same
// browser and the right Google account, then keep the refresh token, encrypted.
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const done = (why: string) => {
    const res = NextResponse.redirect(new URL(`/settings?google=${why}#google`, origin));
    res.cookies.set("g_state", "", { path: "/api/google", maxAge: 0 });
    return res;
  };
  const config = googleConfig();
  if (!config) return done("not-set-up");

  const q = request.nextUrl.searchParams;
  if (q.get("error")) return done("denied");
  if (!sameState(q.get("state") ?? undefined, request.cookies.get("g_state")?.value)) return done("expired");
  const code = q.get("code");
  if (!code) return done("failed");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return NextResponse.redirect(new URL("/login", origin));
  const { data: me } = await supabase.from("team_members").select("email").eq("id", uid).maybeSingle();
  if (!me) return done("not-on-team");

  const t = await exchangeCode(code, redirectUriFor(origin));
  if (!t.refresh_token || !t.access_token) return done("failed");
  const email = emailFromIdToken(t.id_token);
  // Only their own work account: a personal Gmail would put the firm's candidates in the wrong inbox.
  if (!email || email !== me.email.toLowerCase()) return done("wrong-account");
  if (missingScopes(t.scope ?? "").length) return done("missing-access");

  const { error } = await supabase.from("google_connections").upsert(
    {
      member_id: uid,
      google_email: email,
      scopes: (t.scope ?? "").split(/\s+/).filter(Boolean),
      refresh_token_enc: sealToken(t.refresh_token, config.tokenKey),
      status: "connected",
      last_error: null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "member_id" },
  );
  if (error) return done("failed");
  forgetAccessToken(uid);
  return done("connected");
}
