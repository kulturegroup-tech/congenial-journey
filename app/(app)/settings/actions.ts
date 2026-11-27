"use server";

import { refreshAll } from "@/lib/refresh";
import { BRAND_NAME, BRAND_SHORT } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { bool, dbError, num, text, type ActionState } from "@/lib/forms";

/** Admin adds a member (or updates one). A new member needs a PIN; Google users can be added without one. */
export async function saveMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const email = text(fd, "email");
  const name = text(fd, "full_name");
  const pin = text(fd, "pin");
  if (!email || !name) return { error: "Enter a name and email." };
  const { error } = await supabase.rpc("admin_upsert_member", {
    p_email: email,
    p_full_name: name,
    p_pin: pin ?? undefined,
    p_is_admin: bool(fd, "is_admin"),
  });
  if (error) return { error: error.message === "Set a PIN for a new member" ? "New members need a PIN (6–12 digits) to sign in." : error.message };
  refreshAll();
  return { ok: true, message: pin ? `Saved. ${name} signs in with ${email} and the PIN you set.` : "Saved." };
}

export async function setMemberActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.sub === id && !active) return { error: "You can't deactivate yourself." };
  const { error, count } = await supabase.from("team_members").update({ active }, { count: "exact" }).eq("id", id);
  if (error) return { error: dbError(error) };
  if (!count) return { error: "Only an admin can change the team." };
  refreshAll();
  return { ok: true };
}

/** Anyone can change their own PIN. */
export async function changeMyPin(_: ActionState, fd: FormData): Promise<ActionState> {
  const pin = text(fd, "pin");
  if (!pin || !/^[0-9]{6,12}$/.test(pin)) return { error: "PIN must be 6 to 12 digits." };
  if (pin !== text(fd, "pin2")) return { error: "The two PINs don't match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pin });
  if (error) return { error: error.message };
  return { ok: true, message: "PIN changed. Use it next time you sign in." };
}

export async function saveFirmSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const gstin = text(fd, "gstin")?.toUpperCase().replace(/\s/g, "") ?? null;
  if (gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin)) return { error: "GSTIN should be 15 characters and start with the 2-digit state code." };
  const target = num(fd, "monthly_joining_target");
  const values = {
    // The firm's own state (first two digits of its GSTIN) decides the tax split on invoices:
    // a client in the same state pays CGST + SGST, anyone else IGST.
    ...(gstin ? { home_state_code: gstin.slice(0, 2) } : {}),
    firm_name: text(fd, "firm_name") ?? BRAND_NAME,
    address: text(fd, "address"),
    gstin,
    bank_details: text(fd, "bank_details"),
    invoice_prefix: text(fd, "invoice_prefix") ?? BRAND_SHORT,
    next_invoice_serial: num(fd, "next_invoice_serial") ?? 1,
    gst_rate: num(fd, "gst_rate") ?? 18,
    sac_code: text(fd, "sac_code") ?? "9985",
    stale_after_working_days: num(fd, "stale_after_working_days") ?? 5,
    default_cooling_off_months: num(fd, "default_cooling_off_months") ?? 6,
    default_resume_validity_months: num(fd, "default_resume_validity_months") ?? 12,
    updated_at: new Date().toISOString(),
  };
  const save = (v: typeof values & { monthly_joining_target?: number }) => supabase.from("settings").update(v, { count: "exact" }).eq("id", true);
  let { error, count } = await save(target != null ? { ...values, monthly_joining_target: target } : values);
  // Until the monthly-target column exists (migration 7), save everything else rather than nothing.
  let note = "";
  if (error?.code === "PGRST204" && error.message.includes("monthly_joining_target")) {
    ({ error, count } = await save(values));
    note = " The monthly target will save once the database update is applied.";
  }
  if (error) return { error: dbError(error) };
  if (!count) return { error: "Only an admin can change these." };
  refreshAll();
  return { ok: true, message: `Saved.${note}` };
}

export async function addPracticeArea(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const name = text(fd, "name");
  if (!name) return { error: "Enter a name." };
  const { error } = await supabase.from("practice_areas").insert({ name, sort: 500 });
  if (error) return { error: error.code === "23505" ? "That practice area already exists." : dbError(error) };
  refreshAll();
  return { ok: true, message: `Added ${name}.` };
}

/** Admin switch for the CV reader: while off, no CV is sent to the Claude API. */
export async function setCvReading(on: boolean) {
  const supabase = await createClient();
  const { error, count } = await supabase.from("settings").update({ ai_cv_reading: on, updated_at: new Date().toISOString() }, { count: "exact" }).eq("id", true);
  if (error) return { error: dbError(error) };
  if (!count) return { error: "Only an admin can change this." };
  refreshAll();
  return { ok: true };
}

/** Admin sets (or clears) the firm's logo: a file already uploaded to the private branding bucket. */
export async function setLogo(path: string | null) {
  if (path && !/^logo-[0-9a-f-]{36}\.(png|jpg)$/.test(path)) return { error: "That isn't a logo file." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("settings").update({ logo_path: path, updated_at: new Date().toISOString() }, { count: "exact" }).eq("id", true);
  if (error) return { error: dbError(error) };
  if (!count) return { error: "Only an admin can change the logo." };
  refreshAll();
  return { ok: true };
}

/** Unlinks the signed-in person's own Google account: Google is told to cancel access, the token is cleared. */
export async function disconnectGoogle() {
  const { openToken } = await import("@/lib/google/core");
  const { forgetAccessToken, googleConfig, revokeToken } = await import("@/lib/google/server");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { error: "You're signed out." };
  const { data: row } = await supabase.from("google_connections").select("refresh_token_enc").eq("member_id", uid).maybeSingle();
  const key = googleConfig()?.tokenKey;
  const token = row?.refresh_token_enc && key ? openToken(row.refresh_token_enc, key) : null;
  if (token) await revokeToken(token);
  const { error } = await supabase.from("google_connections").update({ status: "disconnected", refresh_token_enc: null, last_error: null }).eq("member_id", uid);
  if (error) return { error: dbError(error) };
  forgetAccessToken(uid);
  refreshAll();
  return { ok: true };
}
