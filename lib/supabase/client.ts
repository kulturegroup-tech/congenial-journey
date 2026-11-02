"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";
import type { Database } from "@/lib/database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

// One browser client per tab. Use it from Client Components only.
export function createClient() {
  client ??= createBrowserClient<Database>(supabaseUrl, supabaseKey);
  return client;
}
