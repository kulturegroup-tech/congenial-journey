import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { createClient } from "@/lib/supabase/server";
import { coverFileName, coverInput, isPdfFile, logoTypeOf, type CoverSource } from "@/lib/cover-input";
import { forgetAccessToken, googleAccessToken, googleConfig, type TokenProblem } from "@/lib/google/server";
import { sendAsFor, sendMime } from "@/lib/google/gmail";
import { buildMime, gmailThreadUrl, MAX_ATTACHMENTS_BYTES, noteHtml, noteText, readAddresses, type Attachment } from "@/lib/google/gmail-core";

// Step C: a CV share sent straight from the sharer's own Gmail, with the CV attached (and the
// cover page in front of it when ticked, built here the same way the browser builds it).
// The share is logged first (cv_shares runs the duplicate check); then the email goes, at most once
// (claim_share_email). Only Gmail keeps the body; Covaro keeps the thread id for the replies later.

type Db = Awaited<ReturnType<typeof createClient>>;

export type ShareEmail = { to: string; cc: string; subject: string; note: string; cover: boolean; withMoney: boolean };
export type ShareEmailResult = { sent: true; from: string; url: string } | { sent: false; error: string };

/** The To and CC boxes, subject and note, checked before anything is logged or sent. */
export function shareEmailProblem(m: ShareEmail): string | null {
  const to = readAddresses(m.to);
  if (to.bad.length) return `“${to.bad[0]}” isn't an email address.`;
  if (!to.emails.length) return "Add the email address to send it to.";
  const cc = readAddresses(m.cc);
  if (cc.bad.length) return `“${cc.bad[0]}” in CC isn't an email address.`;
  if (!m.subject.trim()) return "Add a subject.";
  if (!m.note.trim()) return "Write the note.";
  return null;
}

const tokenWords: Record<TokenProblem, string> = {
  not_set_up: "Sending from Gmail isn't set up for this workspace yet.",
  not_connected: "Connect your Google account in Settings to send from Gmail.",
  key_changed: "Connect Google again in Settings (the server's key changed), then try again.",
  refused: "Google stopped accepting your connection. Connect again in Settings, then try again.",
  unreachable: "Couldn't reach Google. Try again in a minute.",
};

const mimeFor = (name: string, mime: string | null) =>
  mime ||
  (/\.pdf$/i.test(name)
    ? "application/pdf"
    : /\.docx$/i.test(name)
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : /\.doc$/i.test(name)
        ? "application/msword"
        : "application/octet-stream");

// The cover's serif. On Render it's on disk; where it isn't (a bundled server), fetch it from the site.
let serif: Promise<Uint8Array> | null = null;
function serifFont(origin: string) {
  serif ??= readFile(join(process.cwd(), "public/fonts/InstrumentSerif-Regular.ttf"))
    .then((b) => new Uint8Array(b))
    .catch(async () => {
      const r = await fetch(`${origin}/fonts/InstrumentSerif-Regular.ttf`, { signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error("font");
      return new Uint8Array(await r.arrayBuffer());
    })
    .catch((e) => {
      serif = null;
      throw e;
    });
  return serif;
}

type ShareRow = { cv_file_id: string | null; candidate_id: string; mandate_id: string; shared_by: string };

/** The files to attach: the CV, or the cover joined in front of it, or the cover and a Word CV side by side. */
async function attachmentsFor(supabase: Db, share: ShareRow, m: ShareEmail, origin: string): Promise<{ files: Attachment[] } | { error: string }> {
  const { data: f } = await supabase.from("candidate_files").select("file_name, mime_type, storage_path").eq("id", share.cv_file_id!).maybeSingle();
  if (!f) return { error: "The CV picked for this share isn't on file any more." };
  const dl = await supabase.storage.from("candidate-files").download(f.storage_path);
  if (dl.error || !dl.data) return { error: "Couldn't open the CV file. Try again." };
  const cv = new Uint8Array(await dl.data.arrayBuffer());
  const original: Attachment = { fileName: f.file_name, mimeType: mimeFor(f.file_name, f.mime_type), bytes: cv };

  let files = [original];
  if (m.cover) {
    const [cand, extra, mandate, settings, sharer] = await Promise.all([
      supabase
        .from("v_candidates")
        .select("full_name, designation, current_firm, pqe_today, current_ctc, expected_ctc, notice_period_days, current_city, practice_areas")
        .eq("id", share.candidate_id)
        .maybeSingle(),
      supabase.from("candidates").select("highlights").eq("id", share.candidate_id).maybeSingle(),
      supabase.from("mandates").select("title, city, clients(display_name)").eq("id", share.mandate_id).maybeSingle(),
      supabase.from("settings").select("firm_name, logo_path").eq("id", true).maybeSingle(),
      supabase.from("team_members").select("full_name").eq("id", share.shared_by).maybeSingle(),
    ]);
    const src: CoverSource = {
      firm: settings.data?.firm_name ?? null,
      logoPath: settings.data?.logo_path ?? null,
      highlights: extra.data?.highlights ?? null,
      sharer: sharer.data?.full_name ?? null,
      candidate: cand.data,
      mandate: { title: mandate.data?.title ?? "", city: mandate.data?.city ?? null, client: mandate.data?.clients?.display_name ?? "" },
      files: [],
    };
    const input = coverInput(src, m.withMoney);
    if (!input || !mandate.data) return { error: "Couldn't load the candidate for the cover page." };
    try {
      const [{ buildCover }, font, logo] = await Promise.all([
        import("@/lib/cover-pdf"),
        serifFont(origin),
        src.logoPath ? supabase.storage.from("branding").download(src.logoPath) : null,
      ]);
      const made = await buildCover(
        { ...input, logo: logo?.data ? { bytes: await logo.data.arrayBuffer(), type: logoTypeOf(src.logoPath) } : null },
        font,
        { bytes: cv, isPdf: isPdfFile(f) },
      );
      const cover: Attachment = { fileName: coverFileName(input.name, src.firm, made.joined), mimeType: "application/pdf", bytes: made.bytes };
      files = made.joined ? [cover] : [cover, original];
    } catch {
      return { error: "Couldn't make the cover page. Try again, or untick it." };
    }
  }
  const size = files.reduce((n, a) => n + a.bytes.length, 0);
  if (size > MAX_ATTACHMENTS_BYTES) return { error: "The CV is over 25 MB, too big to email. Upload a smaller file on their profile." };
  return { files };
}

/**
 * Sends a logged share from the sharer's Gmail. Safe to call again after a failure: a share that
 * already went comes back as sent, and one that is going right now isn't sent twice.
 */
export async function sendShareEmail(supabase: Db, userId: string, shareId: string, m: ShareEmail, origin: string): Promise<ShareEmailResult> {
  const fail = (error: string): ShareEmailResult => ({ sent: false, error });
  const problem = shareEmailProblem(m);
  if (problem) return fail(problem);
  if (!googleConfig()) return fail(tokenWords.not_set_up);

  const [{ data: share }, { data: conn }] = await Promise.all([
    supabase
      .from("cv_shares")
      .select("id, shared_by, cv_file_id, candidate_id, mandate_id, email_status, email_from, email_thread_id")
      .eq("id", shareId)
      .maybeSingle(),
    supabase.from("google_connections").select("google_email").eq("member_id", userId).maybeSingle(),
  ]);
  if (!share) return fail("Couldn't find this share.");
  if (share.shared_by !== userId) return fail("Only the person who logged this share can send it from their Gmail.");
  if (share.email_status === "sent" && share.email_thread_id) {
    return { sent: true, from: share.email_from ?? "", url: gmailThreadUrl(share.email_thread_id, share.email_from) };
  }
  if (!share.cv_file_id) return fail("There's no CV on this share to attach. Upload it on their profile first.");

  const t = await googleAccessToken(supabase, userId);
  if ("error" in t) return fail(tokenWords[t.code]);

  // Everything is ready before the claim, so a missing file never leaves the share stuck at "sending".
  const made = await attachmentsFor(supabase, share, m, origin);
  if ("error" in made) return fail(made.error);

  const { data: claimed } = await supabase.rpc("claim_share_email", { p_share: shareId });
  if (!claimed) return fail("This email is already on its way. Give it a moment, then check your Gmail's Sent folder.");

  let from = conn?.google_email ?? "";
  const finish = (error: string | null, ids?: { id: string; threadId: string }) =>
    supabase.rpc("finish_share_email", {
      p_share: shareId,
      p_from: from || null,
      p_message_id: ids?.id ?? null,
      p_thread_id: ids?.threadId ?? null,
      p_error: error,
    });

  try {
    const me = await sendAsFor(userId, t.token);
    if (me?.email) from = me.email;
    const to = readAddresses(m.to).emails;
    const cc = readAddresses(m.cc).emails.filter((e) => !to.some((x) => x.toLowerCase() === e.toLowerCase()));
    const mime = buildMime({
      from: me ? { name: me.name, email: me.email } : null,
      to,
      cc,
      subject: m.subject,
      text: noteText(m.note, me?.signature),
      html: noteHtml(m.note, me?.signature),
      attachments: made.files,
    });
    let r = await sendMime(t.token, mime);
    if (!r.ok && r.status === 401) {
      // The cached access token went stale early: get a fresh one and try once more.
      forgetAccessToken(userId);
      const again = await googleAccessToken(supabase, userId);
      if ("token" in again) r = await sendMime(again.token, mime);
    }
    if (!r.ok) {
      await finish(r.problem);
      return fail(r.problem);
    }
    await finish(null, r);
    return { sent: true, from, url: gmailThreadUrl(r.threadId, from) };
  } catch {
    const why = "Something went wrong while sending. Try again.";
    await finish(why);
    return fail(why);
  }
}
