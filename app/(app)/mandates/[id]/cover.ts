// Builds the cover page (and the CV joined behind it) in the browser, from what the share dialog
// already loaded. The logo and the CV come straight from private storage; nothing leaves the computer.
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatLakhs, formatPqe } from "@/lib/format";
import type { CoverResult } from "@/lib/cover-pdf";

export type CoverSource = {
  firm: string | null;
  logoPath: string | null;
  highlights: string | null;
  sharer: string | null;
  candidate: {
    full_name: string | null;
    designation: string | null;
    current_firm: string | null;
    pqe_today: number | null;
    current_city: string | null;
    practice_areas: string[] | null;
    current_ctc: number | null;
    expected_ctc: number | null;
    notice_period_days: number | null;
  } | null;
  mandate: { title: string; city: string | null; client: string };
  files: { id: string; file_name: string; mime_type: string | null; storage_path: string }[];
};

let serifFont: Promise<ArrayBuffer> | null = null;
const serif = () =>
  (serifFont ??= fetch("/fonts/InstrumentSerif-Regular.ttf").then((r) => {
    if (!r.ok) throw new Error("font");
    return r.arrayBuffer();
  }));

export const isPdfFile = (f: { file_name: string; mime_type: string | null } | undefined) =>
  !!f && (f.mime_type === "application/pdf" || /\.pdf$/i.test(f.file_name));

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

export type CoverFile = { blob: Blob; fileName: string; joined: boolean; reason?: CoverResult["reason"] };

export async function makeCoverFile(src: CoverSource, fileId: string, withMoney: boolean): Promise<CoverFile | { error: string }> {
  const c = src.candidate;
  if (!c?.full_name) return { error: "Couldn't load the candidate." };
  const firm = src.firm || "Our firm";
  const file = src.files.find((f) => f.id === fileId);
  const storage = createClient().storage;

  try {
    const [{ buildCover }, font, logo, cv] = await Promise.all([
      import("@/lib/cover-pdf"),
      serif(),
      src.logoPath ? storage.from("branding").download(src.logoPath) : null,
      file && isPdfFile(file) ? storage.from("candidate-files").download(file.storage_path) : null,
    ]);
    if (cv?.error) return { error: "Couldn't open the CV. Check the internet and try again." };

    const facts = [
      { label: "Experience", value: c.pqe_today != null ? `${formatPqe(c.pqe_today)} PQE` : "" },
      { label: "Based in", value: c.current_city ?? "" },
      ...(withMoney
        ? [
            { label: "Notice period", value: c.notice_period_days != null ? `${c.notice_period_days} days` : "" },
            { label: "Current CTC", value: c.current_ctc != null ? formatLakhs(c.current_ctc) : "" },
            { label: "Expected CTC", value: c.expected_ctc != null ? formatLakhs(c.expected_ctc) : "" },
          ]
        : []),
    ];
    const logoType = src.logoPath && /\.png$/i.test(src.logoPath) ? "png" : "jpg";
    const result = await buildCover(
      {
        firmName: firm,
        logo: logo?.data ? { bytes: await logo.data.arrayBuffer(), type: logoType } : null,
        name: c.full_name,
        role: [c.designation, c.current_firm].filter(Boolean).join(", ") || null,
        facts,
        practiceAreas: c.practice_areas ?? [],
        highlights: (src.highlights ?? "")
          .split("\n")
          .map((h) => h.replace(/^[-•*·]\s*/, "").trim())
          .filter(Boolean),
        sharedLine: `Shared in confidence with ${src.mandate.client} for ${src.mandate.title}${src.mandate.city ? `, ${src.mandate.city}` : ""}`,
        byLine: [formatDate(new Date()), [src.sharer, firm].filter(Boolean).join(", ")].join(" · "),
      },
      font,
      file ? { bytes: cv?.data ? await cv.data.arrayBuffer() : new Uint8Array(), isPdf: isPdfFile(file) } : null,
    );
    const name = safeName(c.full_name);
    return {
      blob: new Blob([result.bytes as BlobPart], { type: "application/pdf" }),
      fileName: result.joined ? `${name} - ${safeName(firm)}.pdf` : `${name} - cover.pdf`,
      joined: result.joined,
      reason: result.reason,
    };
  } catch {
    return { error: "Couldn't make the cover page. Try again." };
  }
}

/** Downloads a file made in the browser. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const coverNote: Record<NonNullable<CoverResult["reason"]>, string> = {
  no_cv: "There's no CV on file, so the cover downloaded on its own.",
  not_pdf: "The CV is a Word file, so the cover downloaded on its own. Attach both.",
  locked: "The CV is a locked PDF, so the cover downloaded on its own. Attach both.",
  unreadable: "The CV couldn't be opened as a PDF, so the cover downloaded on its own. Attach both.",
};
