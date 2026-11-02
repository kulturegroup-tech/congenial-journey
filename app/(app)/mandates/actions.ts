"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { all, dbError, lakhs, num, text, type ActionState } from "@/lib/forms";
import type { Database } from "@/lib/database.types";

type Stage = Database["public"]["Enums"]["pipeline_stage"];
type Status = Database["public"]["Enums"]["mandate_status"];
type Channel = Database["public"]["Enums"]["share_channel"];
type RoleCategory = Database["public"]["Enums"]["role_category"];

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}

/** Create or update a mandate. Creating one (or setting it back to active) runs re-engagement in the database. */
export async function saveMandate(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, userId } = await me();
  const id = text(fd, "id");
  const clientId = text(fd, "client_id");
  const title = text(fd, "title");
  if (!clientId) return { error: "Pick the client." };
  if (!title) return { error: "Give the mandate a title, e.g. “TMT associate”." };
  const pqeMin = num(fd, "pqe_min");
  const pqeMax = num(fd, "pqe_max");
  if (pqeMin != null && pqeMax != null && pqeMin > pqeMax) return { error: "PQE “from” is more than “to”." };

  const row = {
    client_id: clientId,
    title,
    role_category: (text(fd, "role_category") ?? "legal") as RoleCategory,
    practice_area: text(fd, "practice_area"),
    pqe_min: pqeMin,
    pqe_max: pqeMax,
    grade_label: text(fd, "grade_label"),
    city: text(fd, "city"),
    headcount: num(fd, "headcount") ?? 1,
    received_on: text(fd, "received_on") ?? undefined,
    owner_id: text(fd, "owner_id") ?? userId,
    team_size: text(fd, "team_size"),
    team_structure: text(fd, "team_structure"),
    client_profile: text(fd, "client_profile"),
    work_profile: text(fd, "work_profile"),
    soft_points: text(fd, "soft_points"),
    pain_points: text(fd, "pain_points"),
    research_notes: text(fd, "research_notes"),
  };

  const res = id
    ? await supabase.from("mandates").update(row).eq("id", id).select("id").single()
    : await supabase.from("mandates").insert(row).select("id").single();
  if (res.error || !res.data) return { error: dbError(res.error) };
  refresh();
  redirect(`/mandates/${res.data.id}`);
}

export async function setMandateStatus(id: string, status: Status) {
  const { supabase } = await me();
  const { error } = await supabase.from("mandates").update({ status }).eq("id", id);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}

/** Move a pipeline entry. Moving to “CV shared” or later is refused until a share is logged. */
export async function moveStage(entryId: string, stage: Stage) {
  const { supabase } = await me();
  const { error } = await supabase.from("pipeline_entries").update({ stage }).eq("id", entryId);
  if (error) {
    if (error.message.includes("Log the CV share first")) return { error: "Share the CV first: use “Share CV” on the card. It runs the duplicate check.", needsShare: true };
    return { error: dbError(error) };
  }
  refresh();
  return { ok: true };
}

export async function exitEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await me();
  const reason = text(fd, "exit_reason");
  if (!reason) return { error: "Pick a reason." };
  const followUp = text(fd, "follow_up_on");
  if (reason === "asked_for_time" && !followUp) return { error: "When should we follow up? Pick a date." };
  const { error } = await supabase
    .from("pipeline_entries")
    .update({ exit_reason: reason, exit_note: text(fd, "exit_note"), follow_up_on: followUp })
    .eq("id", text(fd, "entry_id")!);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}

export async function reopenEntry(entryId: string) {
  const { supabase } = await me();
  const { error } = await supabase.from("pipeline_entries").update({ exit_reason: null, exit_note: null, follow_up_on: null }).eq("id", entryId);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}

/** Put past candidates on this mandate (from the “Past candidates who fit” panel). */
export async function addCandidates(mandateId: string, candidateIds: string[]) {
  const { supabase, userId } = await me();
  if (!candidateIds.length) return { error: "Tick at least one candidate." };
  const { error } = await supabase
    .from("pipeline_entries")
    .upsert(
      candidateIds.map((c) => ({ candidate_id: c, mandate_id: mandateId, stage: "mapped" as const })),
      { onConflict: "candidate_id,mandate_id", ignoreDuplicates: true },
    );
  if (error) return { error: dbError(error) };
  // Their re-engagement alerts for this mandate are now handled.
  if (userId) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("mandate_id", mandateId)
      .in("candidate_id", candidateIds)
      .is("read_at", null);
  }
  refresh();
  return { ok: true };
}

export type Finding = { rule: string; blocking: boolean; detail: string; seen_on: string | null };

/** Everything the share dialog needs, read when it opens. */
export async function shareContext(entryId: string) {
  const { supabase } = await me();
  const { data: e } = await supabase
    .from("pipeline_entries")
    .select("id, candidate_id, mandate_id, mandates(title, city, client_id, clients(display_name))")
    .eq("id", entryId)
    .single();
  if (!e || !e.mandates) return { error: "Pipeline entry not found." };
  const clientId = e.mandates.client_id;
  const [cand, files, dup, contacts, agreement] = await Promise.all([
    supabase.from("v_candidates").select("full_name, designation, current_firm, pqe_today, current_ctc, expected_ctc, notice_period_days, current_city").eq("id", e.candidate_id).single(),
    supabase.from("candidate_files").select("id, file_name, version, created_at").eq("candidate_id", e.candidate_id).order("version", { ascending: false }),
    supabase.rpc("check_duplicate", { p_candidate: e.candidate_id, p_client: clientId, p_exclude_entry: entryId }),
    supabase.from("client_contacts").select("id, name, role, email, phone, copy_on_shares").eq("client_id", clientId).order("name"),
    supabase
      .from("agreements")
      .select("requires_portal, portal_name, copy_ta_on_partner_shares, resume_validity_months, cooling_off_months")
      .eq("client_id", clientId)
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    candidate: cand.data,
    mandate: { title: e.mandates.title, city: e.mandates.city, client: e.mandates.clients?.display_name ?? "" },
    files: files.data ?? [],
    findings: (dup.data ?? []) as Finding[],
    contacts: contacts.data ?? [],
    agreement: agreement.data,
  };
}

export type ShareState = { ok?: boolean; error?: string; blocked?: Finding[]; shareId?: string; validUntil?: string } | null;

/** Log a CV share. The database re-runs the duplicate check and refuses without an override reason. */
export async function shareCv(_: ShareState, fd: FormData): Promise<ShareState> {
  const { supabase, userId } = await me();
  const channels = all(fd, "channels") as Channel[];
  if (!channels.length) return { error: "Pick at least one channel." };
  const { data, error } = await supabase
    .from("cv_shares")
    .insert({
      pipeline_entry_id: text(fd, "entry_id")!,
      channels,
      recipients: text(fd, "recipients"),
      cv_file_id: text(fd, "cv_file_id"),
      override_reason: text(fd, "override_reason"),
      shared_by: userId!,
      // Filled by the database trigger from the pipeline entry and agreement.
      candidate_id: "00000000-0000-0000-0000-000000000000",
      client_id: "00000000-0000-0000-0000-000000000000",
      mandate_id: "00000000-0000-0000-0000-000000000000",
      valid_until: "2000-01-01",
    })
    .select("id, valid_until")
    .single();
  if (error) {
    if (error.message === "DUPLICATE_BLOCKED") {
      let findings: Finding[] = [];
      try {
        findings = JSON.parse(error.details ?? "[]");
      } catch {}
      return { blocked: findings };
    }
    return { error: dbError(error) };
  }
  refresh();
  return { ok: true, shareId: data.id, validUntil: data.valid_until };
}

/** Offer accepted (or already joined): the fee % and replacement window come from the agreement. */
export async function recordPlacement(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await me();
  const salary = lakhs(fd, "annual_fixed_salary");
  if (!salary) return { error: "Enter the annual fixed salary in lakhs." };
  const joining = text(fd, "joining_date");
  const joined = fd.get("joined") === "on";
  if (joined && !joining) return { error: "Enter the joining date." };
  const entryId = text(fd, "entry_id")!;
  const { error } = await supabase.from("placements").insert({
    pipeline_entry_id: entryId,
    offer_accepted_on: text(fd, "offer_accepted_on"),
    joining_date: joining,
    annual_fixed_salary: salary,
    fee_percent: num(fd, "fee_percent"),
    status: joined ? "joined" : "offer_accepted",
    // Filled by the database trigger from the pipeline entry.
    candidate_id: "00000000-0000-0000-0000-000000000000",
    client_id: "00000000-0000-0000-0000-000000000000",
    mandate_id: "00000000-0000-0000-0000-000000000000",
  });
  if (error) return { error: dbError(error) };
  if (!joined) {
    const target: Stage = joining ? "doj_fixed" : "documents";
    const { data: e } = await supabase.from("pipeline_entries").select("stage").eq("id", entryId).single();
    const order = ["offer", "documents", "doj_fixed", "joined"];
    if (e && order.indexOf(e.stage) < order.indexOf(target)) await supabase.from("pipeline_entries").update({ stage: target }).eq("id", entryId);
  }
  refresh();
  return { ok: true, message: joined ? "Placement recorded as joined. Raise the invoice from Billing." : "Offer recorded." };
}
