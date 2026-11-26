import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cvReaderKeySet, readCv, CV_MODEL } from "@/lib/ai/cv-reader";
import { getPracticeAreas } from "@/lib/data/options";
import { formatDate } from "@/lib/format";
import type { Json } from "@/lib/database.types";

// Reads one CV from the inbox with Claude and stores what it found. A route (not a Server Action)
// so the inbox can read a few CVs side by side; Server Actions from one page run one at a time.
export const maxDuration = 120;

const STUCK_MS = 3 * 60 * 1000;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Which CV?" }, { status: 400 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "You're signed out. Sign in again." }, { status: 401 });

  const [{ data: settings }, { data: row }] = await Promise.all([
    supabase.from("settings").select("ai_cv_reading").eq("id", true).maybeSingle(),
    supabase.from("cv_inbox").select("id, file_path, file_name, mime_type, status, updated_at").eq("id", id).maybeSingle(),
  ]);
  if (!row) return NextResponse.json({ error: "That CV isn't in the inbox." }, { status: 404 });
  if (!settings?.ai_cv_reading) return NextResponse.json({ error: "Reading CVs with AI is switched off. An admin can turn it on in Settings." }, { status: 409 });
  if (!cvReaderKeySet()) return NextResponse.json({ error: "The Claude API key isn't set on the server yet." }, { status: 503 });
  if (row.status === "saved" || row.status === "discarded") return NextResponse.json({ error: "This CV has already been dealt with." }, { status: 409 });
  if (row.status === "reading" && Date.now() - new Date(row.updated_at).getTime() < STUCK_MS)
    return NextResponse.json({ error: "Already reading this one." }, { status: 409 });

  // Claim it: only one reader at a time, even with two tabs open.
  const { data: claimed } = await supabase
    .from("cv_inbox")
    .update({ status: "reading", error: null })
    .eq("id", id)
    .eq("updated_at", row.updated_at)
    .select("id");
  if (!claimed?.length) return NextResponse.json({ error: "Already reading this one." }, { status: 409 });

  const fail = async (error: string, status = 422) => {
    await supabase.from("cv_inbox").update({ status: "failed", error }).eq("id", id);
    return NextResponse.json({ error }, { status });
  };

  const { data: blob, error: dl } = await supabase.storage.from("candidate-files").download(row.file_path);
  if (dl || !blob) return fail("Couldn't open the uploaded file. Upload it again.");

  const practices = (await getPracticeAreas()).map((p) => p.name);
  const result = await readCv({ bytes: await blob.arrayBuffer(), fileName: row.file_name, mime: row.mime_type }, practices, formatDate(new Date()));
  if ("error" in result) return fail(result.error);

  const extracted = { ...result.extract, model: CV_MODEL, read_at: new Date().toISOString() };
  const { error } = await supabase
    .from("cv_inbox")
    .update({ status: "ready", extracted: extracted as unknown as Json, error: null })
    .eq("id", id);
  if (error) return fail("Read the CV but couldn't save the details. Try again.", 500);
  return NextResponse.json({ ok: true, name: result.extract.full_name });
}
