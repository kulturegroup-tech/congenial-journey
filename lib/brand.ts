// The name on the product. Each deployment sets its own in Vercel's environment variables, so the same
// code can run as Paradigm Shifters' app and as a demo under another name. Change it there, not here.
// NEXT_PUBLIC_ values are fixed at build time: after changing one, redeploy.
// For now the app runs as Covaro (Priyanshi's demo to another firm, 16 Nov 2026). Back to
// "Paradigm Shifters" when Khyati's team uses it again.
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "Covaro";

/** The letters in the square badge: "PS" for Paradigm Shifters, "P" for a one-word name, unless set. */
export const BRAND_SHORT =
  process.env.NEXT_PUBLIC_BRAND_SHORT?.trim() ||
  BRAND_NAME.split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/** The small line at the bottom of the sign-in page. "-" hides it. */
const place = process.env.NEXT_PUBLIC_BRAND_PLACE?.trim();
export const BRAND_PLACE = place === "-" ? "" : place || "Navi Mumbai";
