"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markRead(id: string) {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  refresh();
}

export async function markAllRead() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", me).is("read_at", null);
  refresh();
}
