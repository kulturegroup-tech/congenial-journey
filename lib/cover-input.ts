// What goes on a CV cover page, worked out the same way in the browser (Download, Preview) and on the
// server (sending from Gmail). The page itself is drawn by lib/cover-pdf.ts.
import { formatDate, formatLakhs, formatPqe } from "@/lib/format";
import type { CoverData } from "@/lib/cover-pdf";

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

export const isPdfFile = (f: { file_name: string; mime_type: string | null } | undefined | null) =>
  !!f && (f.mime_type === "application/pdf" || /\.pdf$/i.test(f.file_name));

export const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

export const logoTypeOf = (path: string | null) => (path && /\.png$/i.test(path) ? "png" : "jpg");

/** Everything on the cover except the logo's bytes. Null when the candidate couldn't be loaded. */
export function coverInput(src: CoverSource, withMoney: boolean): Omit<CoverData, "logo"> | null {
  const c = src.candidate;
  if (!c?.full_name) return null;
  const firm = src.firm || "Our firm";
  return {
    firmName: firm,
    name: c.full_name,
    role: [c.designation, c.current_firm].filter(Boolean).join(", ") || null,
    facts: [
      { label: "Experience", value: c.pqe_today != null ? `${formatPqe(c.pqe_today)} PQE` : "" },
      { label: "Based in", value: c.current_city ?? "" },
      ...(withMoney
        ? [
            { label: "Notice period", value: c.notice_period_days != null ? `${c.notice_period_days} days` : "" },
            { label: "Current CTC", value: c.current_ctc != null ? formatLakhs(c.current_ctc) : "" },
            { label: "Expected CTC", value: c.expected_ctc != null ? formatLakhs(c.expected_ctc) : "" },
          ]
        : []),
    ],
    practiceAreas: c.practice_areas ?? [],
    highlights: (src.highlights ?? "")
      .split("\n")
      .map((h) => h.replace(/^[-•*·]\s*/, "").trim())
      .filter(Boolean),
    sharedLine: `Shared in confidence with ${src.mandate.client} for ${src.mandate.title}${src.mandate.city ? `, ${src.mandate.city}` : ""}`,
    byLine: [formatDate(new Date()), [src.sharer, firm].filter(Boolean).join(", ")].join(" · "),
  };
}

/** "Asha Rao - Paradigm Shifters.pdf" when the CV is joined behind the cover, else "Asha Rao - cover.pdf". */
export const coverFileName = (name: string, firm: string | null, joined: boolean) =>
  joined ? `${safeName(name)} - ${safeName(firm || "Our firm")}.pdf` : `${safeName(name)} - cover.pdf`;
