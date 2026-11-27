import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncCalendars } from "@/lib/google/calendar";
import { publicOrigin } from "@/lib/google/server";

// Open Covaro tabs ping this about once a minute (components/calendar-ping.tsx). It does nothing
// unless Google is set up, someone is connected, and nobody synced in the last 30 seconds.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ skipped: "signed-out" }, { status: 401 });
  const result = await syncCalendars(supabase, publicOrigin(request));
  return NextResponse.json(result);
}
