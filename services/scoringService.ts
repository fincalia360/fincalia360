// Scoring transparente de leads. Funciones puras: fáciles de testear y explicar.
import type { Intent, PropertyType, ScoreItem, ScoreResult, ScoreTier, Situation, Timeline } from "@/types";
import { PROPERTY_LABELS, SITUATION_LABELS, TIMELINE_LABELS } from "@/lib/labels";

export const TIMELINE_POINTS: Record<Timeline, number> = {
  NOW: 40,
  M1_3: 35,
  M3_6: 25,
  M6_12: 15,
  LATER: 5,
  INFO_ONLY: 0,
};

export const PROPERTY_POINTS: Partial<Record<PropertyType, number>> = {
  VILLA: 10,
  HOUSE: 8,
  APARTMENT: 5,
};

export const SITUATION_POINTS: Partial<Record<Situation, number>> = {
  TOURIST: 10,
  INHERITED: 10,
  EMPTY: 8,
  SECOND_HOME: 5,
};

export const VALUE_BANDS: Array<{ min: number; points: number; label: string }> = [
  { min: 500_000, points: 20, label: "≥ 500.000 €" },
  { min: 300_000, points: 15, label: "300.000 – 500.000 €" },
  { min: 150_000, points: 10, label: "150.000 – 300.000 €" },
  { min: 0, points: 5, label: "< 150.000 €" },
];

export const CONTACT_POINTS = { phone: 5, email: 3 };
export const APPOINTMENT_INTEREST_POINTS = 5;

export const TIER_THRESHOLDS: Array<{ tier: ScoreTier; min: number }> = [
  { tier: "HOT", min: 80 },
  { tier: "HIGH", min: 60 },
  { tier: "MEDIUM", min: 30 },
  { tier: "LOW", min: 0 },
];

export interface ScoreInput {
  timeline: Timeline;
  estimatedValue?: number | null;
  propertyType: PropertyType;
  situation: Situation;
  hasPhone: boolean;
  hasEmail: boolean;
  /** Interés explícito en hablar con un especialista (detectado por el agente o el formulario). */
  appointmentInterest?: boolean;
}

export function tierFor(score: number): ScoreTier {
  return TIER_THRESHOLDS.find((t) => score >= t.min)?.tier ?? "LOW";
}

export function intentFromTimeline(timeline: Timeline): Intent {
  if (timeline === "NOW" || timeline === "M1_3") return "HIGH";
  if (timeline === "M3_6" || timeline === "M6_12") return "MEDIUM";
  return "LOW";
}

export function calculateScore(input: ScoreInput): ScoreResult {
  const breakdown: ScoreItem[] = [];

  breakdown.push({
    category: "intent",
    label: `Plazo de venta: ${TIMELINE_LABELS[input.timeline]}`,
    points: TIMELINE_POINTS[input.timeline],
  });

  if (input.estimatedValue != null) {
    const band = VALUE_BANDS.find((b) => input.estimatedValue! >= b.min)!;
    breakdown.push({ category: "value", label: `Valor estimado ${band.label}`, points: band.points });
  }

  const propertyPoints = PROPERTY_POINTS[input.propertyType] ?? 0;
  breakdown.push({ category: "property", label: `Tipo: ${PROPERTY_LABELS[input.propertyType]}`, points: propertyPoints });

  const situationPoints = SITUATION_POINTS[input.situation] ?? 0;
  breakdown.push({
    category: "situation",
    label: `Situación: ${SITUATION_LABELS[input.situation]}`,
    points: situationPoints,
  });

  if (input.hasPhone) breakdown.push({ category: "contact", label: "Ha dejado teléfono", points: CONTACT_POINTS.phone });
  if (input.hasEmail) breakdown.push({ category: "contact", label: "Ha dejado email", points: CONTACT_POINTS.email });

  if (input.appointmentInterest) {
    breakdown.push({
      category: "engagement",
      label: "Quiere hablar con un especialista",
      points: APPOINTMENT_INTEREST_POINTS,
    });
  }

  const score = breakdown.reduce((sum, item) => sum + item.points, 0);
  return { score, tier: tierFor(score), breakdown };
}
