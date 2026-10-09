// Valoración orientativa DEMO.
// Precios €/m² ficticios de referencia por zona — NO son datos de mercado reales.
// TODO: sustituir por un proveedor de valoración (AVM) o por datos de comparables.
import type { Condition, Location, PropertyType, ValuationResult } from "@/types";

export const DEMO_PRICE_PER_SQM: Record<Location, number> = {
  ROSES: 3200,
  EMPURIABRAVA: 3400,
  CADAQUES: 5200,
  LLANCA: 2700,
  CASTELLO: 2300,
  FIGUERES: 1700,
  OTHER: 2500,
};

const TYPE_FACTOR: Record<PropertyType, number> = {
  APARTMENT: 1,
  HOUSE: 1.05,
  VILLA: 1.3,
  LAND: 0.22,
  COMMERCIAL: 0.8,
  OTHER: 0.9,
};

const DEFAULT_SQM: Record<PropertyType, number> = {
  APARTMENT: 75,
  HOUSE: 140,
  VILLA: 220,
  LAND: 600,
  COMMERCIAL: 90,
  OTHER: 90,
};

const CONDITION_FACTOR: Record<Condition, number> = {
  NEW: 1.1,
  GOOD: 1,
  TO_REFORM: 0.85,
};

export interface ValuationInput {
  location: Location;
  type: PropertyType;
  sqm?: number | null;
  bedrooms?: number | null;
  terrace?: boolean;
  pool?: boolean;
  parking?: boolean;
  condition?: Condition | null;
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

export function estimateValue(input: ValuationInput): ValuationResult {
  const assumptions: string[] = [];
  const sqm = input.sqm && input.sqm > 0 ? input.sqm : DEFAULT_SQM[input.type];
  if (!input.sqm) assumptions.push(`Superficie estimada por defecto: ${sqm} m²`);

  let pricePerSqm = DEMO_PRICE_PER_SQM[input.location] * TYPE_FACTOR[input.type];
  let factor = 1;
  if (input.pool) factor += 0.08;
  if (input.terrace) factor += 0.04;
  if (input.parking) factor += 0.03;
  factor *= CONDITION_FACTOR[input.condition ?? "GOOD"];
  pricePerSqm = pricePerSqm * factor;

  const mid = sqm * pricePerSqm;
  const min = roundTo(mid * 0.94, 5000);
  const max = roundTo(mid * 1.06, 5000);
  assumptions.push("Precios de referencia DEMO por zona (no son datos de mercado)");

  return { min, max, mid: roundTo(mid, 1000), pricePerSqm: Math.round(pricePerSqm), assumptions };
}
