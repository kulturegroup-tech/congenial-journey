import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import type { PortalView } from "@/lib/portal-labels";

// The client portal talks to Supabase as a visitor with no session: it can only call the portal_*
// functions, which check the link and the session token themselves (migration 19). The token sits
// in an httpOnly cookie scoped to /portal, so page scripts never see it.

export const PORTAL_COOKIE = "cv_portal";
export const PORTAL_HOURS = 12;

export const isPortalLink = (link: string) => /^[0-9a-f]{64}$/.test(link);

export const visitor = () =>
  createClient<Database>(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

export async function portalToken() {
  return (await cookies()).get(PORTAL_COOKIE)?.value ?? null;
}

/** What this browser may see for this link, or null when it needs to sign in. */
export async function loadPortal(link: string): Promise<PortalView | null> {
  const token = await portalToken();
  if (!token || !isPortalLink(link)) return null;
  const { data, error } = await visitor().rpc("portal_view", { p_link: link, p_token: token });
  if (error || !data) return null;
  return data as unknown as PortalView;
}
