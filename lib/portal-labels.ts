// Words for the client portal, shared by the portal pages and the team's screens.

export type PortalShare = {
  id: string;
  shared_at: string;
  name: string;
  designation: string | null;
  current_firm: string | null;
  pqe: number | null;
  city: string | null;
  practice_areas: string[] | null;
  mandate: string;
  mandate_city: string | null;
  status: string;
  feedback: { verdict: string; note: string | null; at: string } | null;
};

export type PortalView = { firm: string | null; client: string | null; contact: string | null; shares: PortalShare[] };

/** Where a shared CV stands, as the client sees it (portal_status in the database). */
export const PORTAL_STATUS: Record<string, string> = {
  with_you: "With you",
  interviewing: "Interviewing",
  offer: "Offer",
  joined: "Joined",
  closed: "Closed",
};

export const VERDICTS = [
  { value: "shortlist", label: "Shortlist" },
  { value: "interview", label: "Interview" },
  { value: "hold", label: "Hold" },
  { value: "not_a_fit", label: "Not a fit" },
] as const;

/** What the client said, for the team. */
export const VERDICT_SAID: Record<string, string> = {
  shortlist: "Shortlisted",
  interview: "Wants to interview",
  hold: "On hold",
  not_a_fit: "Not a fit",
};

export const verdictTone = (v: string) => (v === "not_a_fit" ? "danger" : v === "hold" ? "warn" : "ok");
