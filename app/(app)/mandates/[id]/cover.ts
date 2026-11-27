// Builds the cover page (and the CV joined behind it) in the browser, from what the share dialog
// already loaded. The logo and the CV come straight from private storage; nothing leaves the computer.
// (Sending from Gmail builds the same cover on the server instead: lib/share-email.ts.)
import { createClient } from "@/lib/supabase/client";
import type { CoverResult } from "@/lib/cover-pdf";
import { coverFileName, coverInput, isPdfFile, logoTypeOf, type CoverSource } from "@/lib/cover-input";

export { isPdfFile, type CoverSource };

let serifFont: Promise<ArrayBuffer> | null = null;
const serif = () =>
  (serifFont ??= fetch("/fonts/InstrumentSerif-Regular.ttf").then((r) => {
    if (!r.ok) throw new Error("font");
    return r.arrayBuffer();
  }));

export type CoverFile = { blob: Blob; fileName: string; joined: boolean; reason?: CoverResult["reason"] };

export async function makeCoverFile(src: CoverSource, fileId: string, withMoney: boolean): Promise<CoverFile | { error: string }> {
  const input = coverInput(src, withMoney);
  if (!input) return { error: "Couldn't load the candidate." };
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

    const result = await buildCover(
      { ...input, logo: logo?.data ? { bytes: await logo.data.arrayBuffer(), type: logoTypeOf(src.logoPath) } : null },
      font,
      file ? { bytes: cv?.data ? await cv.data.arrayBuffer() : new Uint8Array(), isPdf: isPdfFile(file) } : null,
    );
    return {
      blob: new Blob([result.bytes as BlobPart], { type: "application/pdf" }),
      fileName: coverFileName(input.name, src.firm, result.joined),
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
