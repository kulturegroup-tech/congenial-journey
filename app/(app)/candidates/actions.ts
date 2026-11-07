"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { all, dbError, json, lakhs, linkedinSlug, list, moneyProblem, num, text, type ActionState } from "@/lib/forms";
import type { Database } from "@/lib/database.types";

type Source = Database["public"]["Enums"]["candidate_source"];
type Route = Database["public"]["Enums"]["prior_route"];
type Outcome = Database["public"]["Enums"]["call_outcome"];

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}

async function practiceStart(supabase: Awaited<ReturnType<typeof createClient>>, raw: string | null) {
  if (!raw) return { date: null as string | null };
  const { data, error } = await supabase.rpc("parse_sheet_pqe", { raw });
  if (error || !data) return { error: `Couldn't read PQE "${raw}". Use years.months, like 3.6 for 3 years 6 months.` };
  return { date: data as string };
}

/** Create or update a candidate. New candidates are checked for duplicates first. */
export async function saveCandidate(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, userId } = await me();
  const id = text(fd, "id");
  const fullName = text(fd, "full_name");
  if (!fullName) return { error: "Enter the candidate's name." };
  const badMoney = moneyProblem(fd, { current_ctc: "Current CTC", expected_ctc: "Expected CTC" });
  if (badMoney) return { error: badMoney };

  const linkedin = text(fd, "linkedin_url");
  const pqe = await practiceStart(supabase, text(fd, "pqe"));
  if ("error" in pqe) return { error: pqe.error };

  const firmName = text(fd, "current_firm");
  let firmId: string | null = null;
  if (firmName) {
    const { data, error } = await supabase.rpc("resolve_firm", { p_name: firmName, p_create: true });
    if (error) return { error: dbError(error) };
    firmId = data;
  }

  const row = {
    full_name: fullName,
    linkedin_url: linkedin,
    current_firm_id: firmId,
    current_firm_raw: firmName,
    designation: text(fd, "designation"),
    practice_areas: all(fd, "practice_areas"),
    practice_start_date: pqe.date,
    pqe_recorded: text(fd, "pqe"),
    current_city: text(fd, "current_city"),
    preferred_cities: list(fd, "preferred_cities"),
    graduation_year: num(fd, "graduation_year"),
    current_ctc: lakhs(fd, "current_ctc"),
    expected_ctc: lakhs(fd, "expected_ctc"),
    notice_period_days: num(fd, "notice_period_days"),
    source: (text(fd, "source") ?? "other") as Source,
    owner_id: text(fd, "owner_id") ?? userId,
    review_note: text(fd, "review_note"),
  };

  if (id) {
    const { error } = await supabase.from("candidates").update(row).eq("id", id);
    if (error) return { error: dbError(error) };
    refresh();
    redirect(`/candidates/${id}`);
  }

  // Duplicate check before creating: phone, email, LinkedIn.
  const rawPhones = text(fd, "phones");
  const phones: string[] = [];
  if (rawPhones) {
    const { data } = await supabase.rpc("normalize_phones", { raw: rawPhones });
    phones.push(...(data ?? []));
    if (phones.length === 0) return { error: `Couldn't read a phone number in "${rawPhones}".` };
  }
  const emails = list(fd, "emails").map((e) => e.toLowerCase());
  const slug = linkedinSlug(linkedin);

  const dupes = await Promise.all([
    phones.length ? supabase.from("candidate_phones").select("candidate_id, candidates(full_name)").in("phone", phones).limit(1) : null,
    emails.length ? supabase.from("candidate_emails").select("candidate_id, candidates(full_name)").in("email", emails).limit(1) : null,
    slug ? supabase.from("candidates").select("id, full_name").eq("linkedin_slug", slug).limit(1) : null,
  ]);
  const byPhone = dupes[0]?.data?.[0];
  const byEmail = dupes[1]?.data?.[0];
  const byLinkedin = dupes[2]?.data?.[0];
  if (byPhone) return { error: `This phone number already belongs to ${byPhone.candidates?.full_name}.`, duplicateId: byPhone.candidate_id };
  if (byEmail) return { error: `This email already belongs to ${byEmail.candidates?.full_name}.`, duplicateId: byEmail.candidate_id };
  if (byLinkedin) return { error: `${byLinkedin.full_name} already has this LinkedIn profile.`, duplicateId: byLinkedin.id };

  const { data: created, error } = await supabase.from("candidates").insert(row).select("id").single();
  if (error || !created) return { error: dbError(error) };

  const phoneSource = text(fd, "phone_source") === "weekday" ? "weekday" : "manual";
  if (phones.length) {
    const { error: e } = await supabase.from("candidate_phones").insert(
      phones.map((phone, i) => ({ candidate_id: created.id, phone, raw: rawPhones, source: phoneSource as "weekday" | "manual", is_primary: i === 0 })),
    );
    if (e) return { error: dbError(e), duplicateId: created.id };
  }
  if (emails.length) {
    const { error: e } = await supabase.from("candidate_emails").insert(emails.map((email, i) => ({ candidate_id: created.id, email, is_primary: i === 0 })));
    if (e) return { error: dbError(e), duplicateId: created.id };
  }
  refresh();
  redirect(`/candidates/${created.id}`);
}

export async function addPhone(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await me();
  const candidateId = text(fd, "candidate_id")!;
  const raw = text(fd, "phone");
  if (!raw) return { error: "Enter a number." };
  const { data } = await supabase.rpc("normalize_phones", { raw });
  if (!data?.length) return { error: `Couldn't read a phone number in "${raw}".` };
  const { data: taken } = await supabase.from("candidate_phones").select("candidate_id, candidates(full_name)").in("phone", data).limit(1);
  if (taken?.[0] && taken[0].candidate_id !== candidateId)
    return { error: `This number already belongs to ${taken[0].candidates?.full_name}.`, duplicateId: taken[0].candidate_id };
  const source = text(fd, "source") === "weekday" ? "weekday" : "manual";
  const { error } = await supabase.from("candidate_phones").upsert(
    data.map((phone) => ({ candidate_id: candidateId, phone, raw, source: source as "weekday" | "manual" })),
    { onConflict: "phone", ignoreDuplicates: true },
  );
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Number added." };
}

export async function addEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await me();
  const email = text(fd, "email")?.toLowerCase();
  if (!email || !email.includes("@")) return { error: "Enter an email address." };
  const { error } = await supabase.from("candidate_emails").insert({ candidate_id: text(fd, "candidate_id")!, email });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Email added." };
}

type TagRow = { firm?: string; city?: string; practice?: string; role?: string };
type PriorRow = { firm?: string; route?: Route; date?: string; details?: string };

async function saveTags(supabase: Awaited<ReturnType<typeof createClient>>, candidateId: string, rows: TagRow[], reason: string | null, callId: string | null) {
  for (const r of rows) {
    const firmId = r.firm?.trim() ? (await supabase.rpc("resolve_firm", { p_name: r.firm, p_create: true })).data : null;
    if (!firmId && !r.city?.trim() && !r.practice?.trim() && !r.role?.trim()) continue;
    const { error } = await supabase.from("interest_tags").insert({
      candidate_id: candidateId,
      firm_id: firmId,
      city: r.city?.trim() || null,
      practice_area: r.practice?.trim() || null,
      role_text: r.role?.trim() || null,
      not_taken_reason: reason,
      screening_call_id: callId,
    });
    if (error) return dbError(error);
  }
  return null;
}

async function savePriors(supabase: Awaited<ReturnType<typeof createClient>>, candidateId: string, rows: PriorRow[]) {
  for (const r of rows) {
    if (!r.firm?.trim()) continue;
    const firmId = (await supabase.rpc("resolve_firm", { p_name: r.firm, p_create: true })).data;
    if (!firmId) continue;
    const { error } = await supabase.from("prior_applications").insert({
      candidate_id: candidateId,
      firm_id: firmId,
      route: r.route ?? "other",
      applied_on: r.date || null,
      details: r.details?.trim() || null,
    });
    if (error) return dbError(error);
  }
  return null;
}

export async function addInterest(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await me();
  const err = await saveTags(
    supabase,
    text(fd, "candidate_id")!,
    [{ firm: text(fd, "firm") ?? "", city: text(fd, "city") ?? "", practice: text(fd, "practice") ?? "", role: text(fd, "role") ?? "" }],
    text(fd, "reason"),
    null,
  );
  if (err) return { error: err };
  refresh();
  return { ok: true, message: "Saved." };
}

export async function addPriorApplication(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await me();
  if (!text(fd, "firm")) return { error: "Enter the firm." };
  const err = await savePriors(supabase, text(fd, "candidate_id")!, [
    { firm: text(fd, "firm") ?? "", route: (text(fd, "route") ?? "other") as Route, date: text(fd, "applied_on") ?? "", details: text(fd, "details") ?? "" },
  ]);
  if (err) return { error: err };
  refresh();
  return { ok: true, message: "Saved." };
}

export async function deleteRow(table: "interest_tags" | "prior_applications" | "candidate_phones" | "candidate_emails", id: string) {
  const supabase = await createClient();
  const { error, count } = await supabase.from(table).delete({ count: "exact" }).eq("id", id);
  if (error) return { error: dbError(error) };
  if (!count) return { error: "Only an admin can delete." };
  refresh();
  return { ok: true };
}

export async function scheduleCall(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, userId } = await me();
  const when = text(fd, "when");
  if (!when) return { error: "Pick a date and time." };
  const { error } = await supabase.from("screening_calls").insert({
    candidate_id: text(fd, "candidate_id")!,
    mandate_id: text(fd, "mandate_id"),
    recruiter_id: text(fd, "recruiter_id") ?? userId!,
    status: "scheduled",
    scheduled_for: new Date(`${when}:00+05:30`).toISOString(),
  });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Call scheduled." };
}

export async function cancelCall(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("screening_calls").update({ status: "cancelled" }).eq("id", id);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}

export async function addToMandate(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await me();
  const mandateId = text(fd, "mandate_id");
  if (!mandateId) return { error: "Pick a mandate." };
  const { error } = await supabase
    .from("pipeline_entries")
    .insert({ candidate_id: text(fd, "candidate_id")!, mandate_id: mandateId, stage: "mapped" });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Added to the mandate." };
}

/** The 14-field screening call, plus what they want and where they've applied. */
export async function saveScreeningCall(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, userId } = await me();
  const candidateId = text(fd, "candidate_id")!;
  const mandateId = text(fd, "mandate_id");
  const scheduledId = text(fd, "scheduled_id");
  const outcome = text(fd, "outcome") as Outcome | null;
  if (!outcome) return { error: "Pick an outcome: fit, not a fit, or follow up." };
  const badMoney = moneyProblem(fd, { current_ctc: "10 · Current CTC", expected_ctc: "11 · Expected CTC" });
  if (badMoney) return { error: badMoney };
  const when = text(fd, "called_at");

  const call = {
    candidate_id: candidateId,
    mandate_id: mandateId,
    recruiter_id: userId!,
    status: "done" as const,
    called_at: when ? new Date(`${when}:00+05:30`).toISOString() : new Date().toISOString(),
    education: text(fd, "education"),
    work_history: text(fd, "work_history"),
    nature_of_work: text(fd, "nature_of_work"),
    industries_clients: text(fd, "industries_clients"),
    looking_for: text(fd, "looking_for"),
    team_experience: text(fd, "team_experience"),
    non_negotiables: text(fd, "non_negotiables"),
    current_city: text(fd, "current_city"),
    notice_period_days: num(fd, "notice_period_days"),
    current_ctc: lakhs(fd, "current_ctc"),
    expected_ctc: lakhs(fd, "expected_ctc"),
    applications_made: text(fd, "applications_made"),
    discussion: text(fd, "discussion"),
    action_points: text(fd, "action_points"),
    outcome,
  };

  const saved = scheduledId
    ? await supabase.from("screening_calls").update(call).eq("id", scheduledId).select("id").single()
    : await supabase.from("screening_calls").insert(call).select("id").single();
  if (saved.error || !saved.data) return { error: dbError(saved.error) };

  const tagErr = await saveTags(supabase, candidateId, json<TagRow[]>(fd, "interests", []), text(fd, "not_taken_reason"), saved.data.id);
  if (tagErr) return { error: tagErr };
  const priorErr = await savePriors(supabase, candidateId, json<PriorRow[]>(fd, "priors", []));
  if (priorErr) return { error: priorErr };

  // A call for a mandate puts the candidate on that mandate if they aren't already.
  if (mandateId) {
    await supabase
      .from("pipeline_entries")
      .upsert({ candidate_id: candidateId, mandate_id: mandateId, stage: "called" }, { onConflict: "candidate_id,mandate_id", ignoreDuplicates: true });
  }
  refresh();
  redirect(`/candidates/${candidateId}`);
}

export async function registerCv(candidateId: string, storagePath: string, fileName: string, mime: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("candidate_files").select("id", { count: "exact", head: true }).eq("candidate_id", candidateId);
  const { error } = await supabase
    .from("candidate_files")
    .insert({ candidate_id: candidateId, storage_path: storagePath, file_name: fileName, mime_type: mime, version: (count ?? 0) + 1 });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}

export async function cvLink(fileId: string) {
  const supabase = await createClient();
  const { data: f } = await supabase.from("candidate_files").select("storage_path").eq("id", fileId).single();
  if (!f) return { error: "File not found." };
  const { data, error } = await supabase.storage.from("candidate-files").createSignedUrl(f.storage_path, 60 * 10);
  if (error || !data) return { error: error?.message ?? "Couldn't open the file." };
  return { url: data.signedUrl };
}
