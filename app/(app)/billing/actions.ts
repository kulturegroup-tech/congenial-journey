"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bool, dbError, monthlyToAnnual, num, text, type ActionState } from "@/lib/forms";
import type { Database } from "@/lib/database.types";

type PStatus = Database["public"]["Enums"]["placement_status"];

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}

/** Joined, backed out, left inside the replacement window, or completed. The database does the follow-on work. */
export async function updatePlacement(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await me();
  const status = text(fd, "status") as PStatus;
  const joining = text(fd, "joining_date");
  if ((status === "joined" || status === "completed" || status === "left_in_window") && !joining) return { error: "Enter the joining date." };
  const leftOn = text(fd, "left_on");
  if (status === "left_in_window" && !leftOn) return { error: "When did they leave?" };
  const salary = monthlyToAnnual(fd, "monthly_fixed_salary");
  const { error } = await supabase
    .from("placements")
    .update({
      status,
      joining_date: joining,
      offer_accepted_on: text(fd, "offer_accepted_on"),
      ...(salary ? { annual_fixed_salary: salary } : {}),
      fee_percent: num(fd, "fee_percent"),
      left_on: leftOn,
      left_reason: text(fd, "left_reason"),
      left_for_medical: bool(fd, "left_for_medical"),
    })
    .eq("id", text(fd, "id")!);
  if (error) return { error: dbError(error) };
  refresh();
  return {
    ok: true,
    message:
      status === "left_in_window" ? "Saved. If this is inside the replacement window, a replacement mandate was opened." : status === "backed_out" ? "Saved. They're out of the pipeline." : "Saved.",
  };
}

/** Number, GST split, deadline and due date are all computed by create_invoice(). */
export async function raiseInvoice(placementId: string) {
  const { supabase } = await me();
  const { data, error } = await supabase.rpc("create_invoice", { p_placement: placementId });
  if (error || !data) return { error: error?.message ?? "Couldn't raise the invoice." };
  refresh();
  redirect(`/billing/invoices/${(data as { id: string }).id}`);
}

export async function markSent(invoiceId: string) {
  const { supabase, userId } = await me();
  const { error } = await supabase.from("invoices").update({ status: "sent", sent_by: userId, sent_at: new Date().toISOString() }).eq("id", invoiceId).eq("status", "draft");
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}

export async function cancelInvoice(invoiceId: string) {
  const { supabase } = await me();
  const { error } = await supabase.from("invoices").update({ status: "cancelled" }).eq("id", invoiceId);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}

export async function recordPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await me();
  const amount = num(fd, "amount");
  if (!amount || amount <= 0) return { error: "Enter the amount received, in rupees." };
  const { error } = await supabase.from("payments").insert({
    invoice_id: text(fd, "invoice_id")!,
    received_on: text(fd, "received_on") ?? new Date().toISOString().slice(0, 10),
    amount,
    reference: text(fd, "reference"),
  });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Payment recorded." };
}
