import type { BadgeTone } from "@/components/ui/Badge";

export const STAGE_TONES: Record<string, BadgeTone> = {
  NEW: "blue",
  PENDING_CONTACT: "amber",
  CONTACTED: "violet",
  VISIT_SCHEDULED: "terracotta",
  PROPOSAL_SENT: "violet",
  NEGOTIATION: "terracotta",
  WON: "green",
  LOST: "neutral",
};
