// Shared lists used on both server and client. Labels use the team's own words (from Odoo).

export const CITIES = ["Mumbai", "Delhi", "Gurugram", "Noida", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad"];

export const STAGES = [
  { value: "mapped", label: "Yet to speak" },
  { value: "called", label: "Spoke" },
  { value: "pitched", label: "Pitched" },
  { value: "confirmed", label: "CV received" },
  { value: "cv_shared", label: "CV shared" },
  { value: "interview", label: "Interview" },
  { value: "assignment", label: "Assignment" },
  { value: "final_round", label: "Final round" },
  { value: "offer", label: "Offer" },
  { value: "documents", label: "Documents" },
  { value: "doj_fixed", label: "Joining date fixed" },
  { value: "joined", label: "Joined" },
] as const;

export const stageLabel = (s: string) => STAGES.find((x) => x.value === s)?.label ?? s;

/** The 12 stages read as three phases, so the board fits on one screen. */
export const PHASES = [
  { key: "talking", label: "Talking to them", stages: ["mapped", "called", "pitched", "confirmed"] },
  { key: "client", label: "With the client", stages: ["cv_shared", "interview", "assignment", "final_round"] },
  { key: "closing", label: "Closing", stages: ["offer", "documents", "doj_fixed", "joined"] },
] as const;

export const phaseOf = (stage: string) => PHASES.find((p) => (p.stages as readonly string[]).includes(stage)) ?? PHASES[0];

/** Stages where a date matters: moving a card here asks when. */
export const DATED_STAGES = ["interview", "assignment", "final_round"];
