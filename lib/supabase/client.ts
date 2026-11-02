"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

let client: ReturnType<typeof createBrowserClient> | undefined;

// One browser client per tab. Use it from Client Components only.
export function createClient() {
  client ??= createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}
