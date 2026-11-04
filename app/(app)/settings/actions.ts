"use server";

import { refresh } from "next/cache";
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
  refresh();
  return { ok: true, message: pin ? `Saved. ${name} signs in with ${email} and the PIN you set.` : "Saved." };
}

export async function setMemberActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.sub === id && !active) return { error: "You can't deactivate yourself." };
  const { error, count } = await supabase.from("team_members").update({ active }, { count: "exact" }).eq("id", id);
  if (error) return { error: dbError(error) };
  if (!count) return { error: "Only an admin can change the team." };
  refresh();
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
  const { error, count } = await supabase
    .from("settings")
    .update(
      {
        firm_name: text(fd, "firm_name") ?? "Paradigm Shifters",
        address: text(fd, "address"),
        gstin,
        bank_details: text(fd, "bank_details"),
        invoice_prefix: text(fd, "invoice_prefix") ?? "PS",
        next_invoice_serial: num(fd, "next_invoice_serial") ?? 1,
        gst_rate: num(fd, "gst_rate") ?? 18,
        sac_code: text(fd, "sac_code") ?? "9985",
        stale_after_working_days: num(fd, "stale_after_working_days") ?? 5,
        default_cooling_off_months: num(fd, "default_cooling_off_months") ?? 6,
        default_resume_validity_months: num(fd, "default_resume_validity_months") ?? 12,
        ...(num(fd, "monthly_joining_target") != null ? { monthly_joining_target: num(fd, "monthly_joining_target")! } : {}),
        updated_at: new Date().toISOString(),
      },
      { count: "exact" },
    )
    .eq("id", true);
  if (error) return { error: dbError(error) };
  if (!count) return { error: "Only an admin can change these." };
  refresh();
  return { ok: true, message: "Saved." };
}

export async function addPracticeArea(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const name = text(fd, "name");
  if (!name) return { error: "Enter a name." };
  const { error } = await supabase.from("practice_areas").insert({ name, sort: 500 });
  if (error) return { error: error.code === "23505" ? "That practice area already exists." : dbError(error) };
  refresh();
  return { ok: true, message: `Added ${name}.` };
}
