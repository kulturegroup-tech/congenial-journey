import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Lists used by forms and filters, read once per request.

export const getPracticeAreas = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("practice_areas").select("name").eq("active", true).order("sort");
  return (data ?? []).map((p) => p.name);
});

export const getTeam = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("team_members").select("id, full_name, is_admin, active").order("full_name");
  return data ?? [];
});

/** Firm names and aliases, for type-ahead lists. */
export const getFirmNames = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("firms").select("name, aliases").order("name");
  return [...new Set((data ?? []).flatMap((f) => [f.name, ...(f.aliases ?? [])]))];
});

export const getClients = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, display_name, firm_id").order("display_name");
  return data ?? [];
});

export const getExitReasons = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("exit_reasons").select("code, label").eq("active", true).order("sort");
  return data ?? [];
});

export const getOpenMandates = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mandates")
    .select("id, title, city, status, clients(display_name)")
    .in("status", ["active", "on_hold"])
    .order("received_on", { ascending: false });
  return (data ?? []).map((m) => ({ id: m.id, label: `${m.clients?.display_name ?? "?"} · ${m.title}${m.city ? ` (${m.city})` : ""}` }));
});
