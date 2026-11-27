import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authUrl, newState } from "@/lib/google/core";
import { googleConfig, publicOrigin, redirectUriFor } from "@/lib/google/server";

// Settings → "Connect Google": sends the person to Google's sign-in, with a one-time state value in
// a short-lived cookie so the callback knows the reply is for this browser.
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const back = (why: string) => NextResponse.redirect(new URL(`/settings?google=${why}#google`, origin));
  const config = googleConfig();
  if (!config) return back("not-set-up");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return NextResponse.redirect(new URL("/login", origin));
  const { data: me } = await supabase.from("team_members").select("email").eq("id", uid).maybeSingle();
  if (!me) return back("not-on-team");

  const state = newState();
  const res = NextResponse.redirect(authUrl({ clientId: config.clientId, redirectUri: redirectUriFor(origin), state, loginHint: me.email }));
  res.cookies.set("g_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google", maxAge: 600 });
  return res;
}
