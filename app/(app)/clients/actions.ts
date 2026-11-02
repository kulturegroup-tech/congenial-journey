"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bool, dbError, num, text, type ActionState } from "@/lib/forms";
import type { Database } from "@/lib/database.types";

type Role = Database["public"]["Enums"]["contact_role"];
type Basis = Database["public"]["Enums"]["payment_basis"];
type Kind = Database["public"]["Enums"]["client_type"];

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}

/** Create or update a client. The firm is matched on name and aliases before a new one is made. */
export async function saveClient(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, userId } = await me();
  const id = text(fd, "id");
  const firmName = text(fd, "firm");
  if (!firmName) return { error: "Enter the firm's name." };
  const gstin = text(fd, "gstin")?.toUpperCase().replace(/\s/g, "") ?? null;
  if (gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin)) return { error: "GSTIN should be 15 characters and start with the 2-digit state code (27 for Maharashtra)." };

  const { data: firmId, error: firmErr } = await supabase.rpc("resolve_firm", { p_name: firmName, p_create: true });
  if (firmErr || !firmId) return { error: dbError(firmErr) };
  await supabase.from("firms").update({ kind: (text(fd, "kind") ?? "law_firm") as Kind }).eq("id", firmId);

  const row = {
    firm_id: firmId,
    display_name: text(fd, "display_name") ?? firmName,
    billing_name: text(fd, "billing_name"),
    billing_address: text(fd, "billing_address"),
    gstin,
    owner_id: text(fd, "owner_id") ?? userId,
    notes: text(fd, "notes"),
  };
  const res = id
    ? await supabase.from("clients").update(row).eq("id", id).select("id").single()
    : await supabase.from("clients").insert(row).select("id").single();
  if (res.error || !res.data) {
    if (res.error?.code === "23505") {
      const { data: existing } = await supabase.from("clients").select("id").eq("firm_id", firmId).maybeSingle();
      return { error: "That firm is already a client.", id: existing?.id };
    }
    return { error: dbError(res.error) };
  }
  refresh();
  redirect(`/clients/${res.data.id}`);
}

export async function saveContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await me();
  const id = text(fd, "id");
  const name = text(fd, "name");
  if (!name) return { error: "Enter a name." };
  const row = {
    client_id: text(fd, "client_id")!,
    name,
    role: (text(fd, "role") ?? "other") as Role,
    email: text(fd, "email")?.toLowerCase() ?? null,
    phone: text(fd, "phone"),
    city: text(fd, "city"),
    copy_on_shares: bool(fd, "copy_on_shares"),
    notes: text(fd, "notes"),
  };
  const { error } = id ? await supabase.from("client_contacts").update(row).eq("id", id) : await supabase.from("client_contacts").insert(row);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Saved." };
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  const { error, count } = await supabase.from("client_contacts").delete({ count: "exact" }).eq("id", id);
  if (error) return { error: dbError(error) };
  if (!count) return { error: "Only an admin can delete." };
  refresh();
  return { ok: true };
}

/** Agreement terms and fee rates. These drive fees, duplicates, deadlines and reminders. */
export async function saveAgreement(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await me();
  const id = text(fd, "id");
  const clientId = text(fd, "client_id")!;
  const startsOn = text(fd, "starts_on");
  if (!startsOn) return { error: "When does the agreement start?" };
  const feeLegal = num(fd, "fee_legal");
  const feeSupport = num(fd, "fee_support_staff");
  if (feeLegal == null && feeSupport == null) return { error: "Enter at least one fee %." };

  const row = {
    client_id: clientId,
    title: text(fd, "title") ?? "Agreement",
    starts_on: startsOn,
    ends_on: text(fd, "ends_on"),
    cooling_off_months: num(fd, "cooling_off_months") ?? 6,
    resume_validity_months: num(fd, "resume_validity_months") ?? 12,
    replacement_days: num(fd, "replacement_days") ?? 90,
    replacement_excludes_medical: bool(fd, "replacement_excludes_medical"),
    invoice_deadline_days: num(fd, "invoice_deadline_days"),
    payment_days: num(fd, "payment_days") ?? 15,
    payment_from: (text(fd, "payment_from") ?? "invoice_date") as Basis,
    requires_portal: bool(fd, "requires_portal"),
    portal_name: text(fd, "portal_name"),
    copy_ta_on_partner_shares: bool(fd, "copy_ta_on_partner_shares"),
    no_fee_if_backed_out: bool(fd, "no_fee_if_backed_out"),
    notes: text(fd, "notes"),
  };
  const res = id
    ? await supabase.from("agreements").update(row).eq("id", id).select("id").single()
    : await supabase.from("agreements").insert(row).select("id").single();
  if (res.error || !res.data) return { error: dbError(res.error) };

  const rates = [
    feeLegal != null ? { agreement_id: res.data.id, role_category: "legal" as const, fee_percent: feeLegal } : null,
    feeSupport != null ? { agreement_id: res.data.id, role_category: "support_staff" as const, fee_percent: feeSupport } : null,
  ].filter((r) => r !== null);
  const { error } = await supabase.from("agreement_fee_rates").upsert(rates, { onConflict: "agreement_id,role_category" });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Agreement saved." };
}

export async function attachAgreementFile(agreementId: string, path: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("agreements").update({ document_path: path }).eq("id", agreementId);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}

export async function agreementLink(agreementId: string) {
  const supabase = await createClient();
  const { data: a } = await supabase.from("agreements").select("document_path").eq("id", agreementId).single();
  if (!a?.document_path) return { error: "No file attached." };
  const { data, error } = await supabase.storage.from("agreements").createSignedUrl(a.document_path, 60 * 10);
  if (error || !data) return { error: error?.message ?? "Couldn't open the file." };
  return { url: data.signedUrl };
}
