import "server-only";

import { cache } from "react";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";
import type { Database } from "@/lib/database.types";

// Server Components, Route Handlers and Server Actions. Reads the session cookie, so any
// Server Component that calls this must sit inside a <Suspense> boundary (Cache Components).
// One client per request: every part of a page shares it instead of each building its own.
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  // The Supabase client reads the clock as soon as it starts. io() tells Next.js that request-time
  // work follows, so it never tries to bake this into a prerendered shell (that failed on every
  // page with "encountered the unstable value Date.now()" and wasted a render each time).
  await io();
  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. proxy.ts refreshes the session.
        }
      },
    },
  });
});
