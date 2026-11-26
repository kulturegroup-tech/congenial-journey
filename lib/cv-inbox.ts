import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/forms";

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Files an inbox CV on a candidate: it becomes their next CV version and the inbox row is marked
 * saved. The file stays where it was uploaded (candidate-files/inbox/…); candidate_files keeps the path.
 */
export async function fileInboxCv(supabase: Db, inboxId: string, candidateId: string): Promise<string | null> {
  const { data: row } = await supabase.from("cv_inbox").select("file_path, file_name, mime_type, status").eq("id", inboxId).maybeSingle();
  if (!row) return "That CV isn't in the inbox any more.";
  if (row.status === "saved") return "This CV has already been saved to a candidate.";
  const { count } = await supabase.from("candidate_files").select("id", { count: "exact", head: true }).eq("candidate_id", candidateId);
  const { error } = await supabase
    .from("candidate_files")
    .insert({ candidate_id: candidateId, storage_path: row.file_path, file_name: row.file_name, mime_type: row.mime_type, version: (count ?? 0) + 1 });
  if (error) return dbError(error);
  const { error: e2 } = await supabase.from("cv_inbox").update({ status: "saved", candidate_id: candidateId }).eq("id", inboxId);
  return e2 ? dbError(e2) : null;
}
