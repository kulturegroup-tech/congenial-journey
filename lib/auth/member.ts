import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Member = { id: string; full_name: string; email: string; is_admin: boolean };

export type Session =
  | { state: "signed_out" }
  | { state: "not_on_team"; email: string | null }
  | { state: "member"; member: Member };

// The signed-in person and their team_members row, read once per request.
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { state: "signed_out" };

  const { data: member } = await supabase
    .from("team_members")
    .select("id, full_name, email, is_admin")
    .eq("id", userId)
    .eq("active", true)
    .maybeSingle();

  if (!member) return { state: "not_on_team", email: (data.claims.email as string | undefined) ?? null };
  return { state: "member", member: member as Member };
});

// id -> first name, for "last called by" columns.
export const getTeamNames = cache(async (): Promise<Record<string, string>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("team_members").select("id, full_name");
  return Object.fromEntries((data ?? []).map((m: { id: string; full_name: string }) => [m.id, m.full_name.split(" ")[0]]));
});
