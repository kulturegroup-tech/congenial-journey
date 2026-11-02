// Shared lists used on both server and client.

export const CITIES = ["Mumbai", "Delhi", "Gurugram", "Noida", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad"];

export const STAGES = [
  { value: "mapped", label: "Mapped" },
  { value: "called", label: "Called" },
  { value: "pitched", label: "Pitched" },
  { value: "confirmed", label: "Confirmed, CV received" },
  { value: "cv_shared", label: "CV shared" },
  { value: "interview", label: "Interview" },
  { value: "assignment", label: "Assignment" },
  { value: "final_round", label: "Final round" },
  { value: "offer", label: "Offer / negotiation" },
  { value: "documents", label: "Documents" },
  { value: "doj_fixed", label: "DOJ fixed" },
  { value: "joined", label: "Joined" },
] as const;

export const stageLabel = (s: string) => STAGES.find((x) => x.value === s)?.label ?? s;
