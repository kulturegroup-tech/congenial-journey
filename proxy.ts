import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { sessionExpiry } from "@/lib/supabase/session-cookie";

// Runs before every page: refreshes the Supabase session cookie and sends signed-out
// visitors to /login. This is an optimistic check only; RLS is what protects the data.
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next({ request });

  // Signed in with a token that's good for more than two minutes: nothing to refresh, so skip the
  // Supabase client entirely (it cost about a quarter of a second on every page). The page
  // still verifies the token itself, and row-level security guards the data.
  const expires = sessionExpiry((name) => request.cookies.get(name)?.value, new URL(supabaseUrl).hostname.split(".")[0]);
  if (expires && expires - Date.now() / 1000 > 120) {
    if (request.nextUrl.pathname === "/login") return NextResponse.redirect(new URL("/today", request.url));
    return NextResponse.next({ request });
  }

  // Loaded only when a refresh is needed, so the proxy itself starts fast on a cold server.
  const { createServerClient } = await import("@supabase/ssr");
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  // /warm is the keep-awake ping (app/warm/page.tsx): no session, and it shows nothing.
  const isPublic = path === "/login" || path === "/warm" || path.startsWith("/auth/");

  const redirectTo = (target: URL) => {
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!signedIn && !isPublic) {
    const url = new URL("/login", request.url);
    if (path !== "/") url.searchParams.set("next", path + request.nextUrl.search);
    return redirectTo(url);
  }
  if (signedIn && path === "/login") return redirectTo(new URL("/today", request.url));

  return response;
}

// Outline prefetches ("next-router-prefetch: 1") skip the proxy altogether: they only fetch a
// screen's prebuilt outline (no data), served straight from Vercel's cache. Going through the
// proxy, they waited on it and sometimes took over 2 seconds, which made clicks feel dead.
// Anything that renders with the session (navigations, and the full prefetch components/fast-link
// asks for on hover, which sends no prefetch header) still passes through, so an expiring session
// is refreshed here, where the new cookie can be saved. (Next.js hides the prefetch headers inside
// the proxy, so this has to be decided here, not in code.)
export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch", value: "1" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
