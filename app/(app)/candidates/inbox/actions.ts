"use server";

import { refreshAll } from "@/lib/refresh";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/forms";
import { fileInboxCv } from "@/lib/cv-inbox";
import type { CvExtract } from "@/lib/cv-extract";

const OK_EXT = /\.(pdf|docx|doc)$/i;

/** Puts files already uploaded to candidate-files/inbox/ into the inbox. Returns their inbox ids in the same order (null if refused). */
export async function addToInbox(files: { path: string; name: string; mime: string | null }[]): Promise<{ ids?: (string | null)[]; error?: string }> {
  const rows = files
    .filter((f) => /^inbox\/[0-9a-f-]{36}\.(pdf|docx|doc)$/i.test(f.path) && OK_EXT.test(f.name))
    .map((f) => ({ file_path: f.path, file_name: f.name.slice(0, 200), mime_type: f.mime || null }));
  if (!rows.length) return { error: "No PDF or Word files to add." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("cv_inbox").insert(rows).select("id, file_path");
  if (error || !data) return { error: dbError(error) };
  const byPath = new Map(data.map((r) => [r.file_path, r.id]));
  refreshAll();
  return { ids: files.map((f) => byPath.get(f.path) ?? null) };
}

/** Takes a CV out of the inbox without creating anyone. The file stays in storage; an admin can clear it. */
export async function discardInboxCv(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cv_inbox").update({ status: "discarded" }).eq("id", id).neq("status", "saved");
  if (error) return { error: dbError(error) };
  refreshAll();
  return { ok: true };
}

/** Puts a discarded CV back in the inbox (the Undo on the toast). */
export async function restoreInboxCv(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("cv_inbox").select("extracted").eq("id", id).maybeSingle();
  const { error } = await supabase.from("cv_inbox").update({ status: data?.extracted ? "ready" : "uploaded" }).eq("id", id).eq("status", "discarded");
  if (error) return { error: dbError(error) };
  refreshAll();
  return { ok: true };
}

/**
 * The CV belongs to someone we already have: file it as their next CV, add any new phone or email
 * from it, and keep its highlights if they have none yet. Nothing they already have is overwritten.
 */
export async function attachInboxCv(inboxId: string, candidateId: string): Promise<{ ok?: boolean; error?: string; id?: string }> {
  const supabase = await createClient();
  const [{ data: row }, { data: cand }] = await Promise.all([
    supabase.from("cv_inbox").select("extracted").eq("id", inboxId).maybeSingle(),
    supabase.from("candidates").select("id, highlights").eq("id", candidateId).maybeSingle(),
  ]);
  if (!cand) return { error: "That candidate isn't there any more." };
  const x = (row?.extracted ?? null) as Partial<CvExtract> | null;

  const err = await fileInboxCv(supabase, inboxId, candidateId);
  if (err) return { error: err };

  if (x?.phones?.length) {
    const { data: phones } = await supabase.rpc("normalize_phones", { raw: x.phones.join(", ") });
    if (phones?.length)
      await supabase
        .from("candidate_phones")
        .upsert(phones.map((phone) => ({ candidate_id: candidateId, phone, raw: x.phones!.join(", "), source: "cv" as const })), { onConflict: "phone", ignoreDuplicates: true });
  }
  if (x?.emails?.length)
    await supabase
      .from("candidate_emails")
      .upsert(x.emails.map((email) => ({ candidate_id: candidateId, email })), { onConflict: "email", ignoreDuplicates: true });
  if (!cand.highlights && x?.highlights?.length) await supabase.from("candidates").update({ highlights: x.highlights.join("\n") }).eq("id", candidateId);

  refreshAll();
  return { ok: true, id: candidateId };
}
