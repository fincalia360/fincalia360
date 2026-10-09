import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "ink" | "green" | "amber" | "red" | "terracotta" | "blue" | "violet";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-sand-100 text-ink-500 ring-sand-200",
  ink: "bg-ink-50 text-ink-700 ring-ink-100",
  green: "bg-pine-50 text-pine-600 ring-pine-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  terracotta: "bg-terracotta-50 text-terracotta-700 ring-terracotta-100",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset", TONES[tone], className)}>
      {children}
    </span>
  );
}

export const STATUS_TONES: Record<string, BadgeTone> = {
  NEW: "blue",
  STUDY_DONE: "ink",
  PENDING_CONTACT: "amber",
  QUALIFIED: "amber",
  CONTACTED: "violet",
  APPOINTMENT: "terracotta",
  PROPOSAL_SENT: "violet",
  CONVERTED: "green",
  LOST: "neutral",
};

export const TIER_TONES: Record<string, BadgeTone> = {
  LOW: "neutral",
  MEDIUM: "ink",
  HIGH: "amber",
  HOT: "red",
};

export function DemoBadge({ children = "DEMO" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-terracotta-400 bg-terracotta-50 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-terracotta-700">
      {children}
    </span>
  );
}
