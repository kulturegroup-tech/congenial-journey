"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ImportRow = { n: number; data: Record<string, string>; mandate_id: string | null };
export type ImportResult = { n: number; status: "imported" | "merged" | "needs_review" | "skipped"; candidate_id?: string; issue?: string };

/** Sends one chunk to import_batch(); each row is matched, merged or created in the database. */
export async function runImport(batch: string, rows: ImportRow[]): Promise<{ results?: ImportResult[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_batch", { p_batch: batch, p_rows: rows });
  if (error) return { error: error.message };
  return { results: data as ImportResult[] };
}

export async function finishImport() {
  refresh();
}

/** Review list: the two records are the same person. Keeps the older one. */
export async function mergeInto(keep: string, drop: string, importRowId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_candidates", { p_keep: keep, p_drop: drop });
  if (error) return { error: error.message };
  await supabase.from("import_rows").update({ status: "merged", candidate_id: keep }).eq("id", importRowId);
  refresh();
  return { ok: true };
}

/** Review list: checked, nothing to fix. */
export async function markReviewed(importRowId: number, candidateId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("import_rows").update({ status: "imported" }).eq("id", importRowId);
  if (error) return { error: error.message };
  if (candidateId) await supabase.from("candidates").update({ needs_review: false }).eq("id", candidateId);
  refresh();
  return { ok: true };
}
