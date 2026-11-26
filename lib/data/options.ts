import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Practice } from "@/components/practice";

// Lists used by forms and filters, read once per request.

/** Practice areas to pick from, in order, each with its group (for <optgroup>s). */
export const getPracticeAreas = cache(async (): Promise<Practice[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("practice_areas").select("name, category").eq("active", true).order("sort");
  return data ?? [];
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

/** Every client's points of contact, for picking a mandate's contacts. */
export const getClientContacts = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("client_contacts").select("id, client_id, name, role, email").order("name");
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

/** Firm grade labels the team has used (A1–A3, SA…), for type-ahead. */
export const getGradeLabels = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("firm_grades").select("grade");
  return [...new Set((data ?? []).map((g) => g.grade))].sort();
});
