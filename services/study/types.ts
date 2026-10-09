import { z } from "zod";

// ---------------------------------------------------------------------------
// Procedencia de cada dato: se muestra en la interfaz y en el PDF.
// ---------------------------------------------------------------------------
export const DATA_ORIGINS = ["OFFICIAL", "OWNER", "MARKET_OBSERVED", "MODEL", "ASSUMPTION", "EXAMPLE"] as const;
export type DataOrigin = (typeof DATA_ORIGINS)[number];

export const ORIGIN_LABELS: Record<DataOrigin, string> = {
  OFFICIAL: "Dato oficial",
  OWNER: "Aportado por el propietario",
  MARKET_OBSERVED: "Precio observado en el mercado",
  MODEL: "Estimación del modelo",
  ASSUMPTION: "Hipótesis modificable",
  EXAMPLE: "Dato de EJEMPLO (no real)",
};

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW" | "NONE";
export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
  VERY_LOW: "Muy baja",
  NONE: "Sin estimación",
};

// ---------------------------------------------------------------------------
// Datos de entrada (formulario por pasos)
// ---------------------------------------------------------------------------
export const PROPERTY_KINDS = ["PISO", "ATICO", "DUPLEX", "ESTUDIO", "CASA_ADOSADA", "CASA_INDEPENDIENTE", "VILLA"] as const;
export type PropertyKind = (typeof PROPERTY_KINDS)[number];
export const PROPERTY_KIND_LABELS: Record<PropertyKind, string> = {
  PISO: "Piso / apartamento",
  ATICO: "Ático",
  DUPLEX: "Dúplex",
  ESTUDIO: "Estudio",
  CASA_ADOSADA: "Casa adosada",
  CASA_INDEPENDIENTE: "Casa independiente",
  VILLA: "Villa / chalet",
};
/** Tipología SERPAVI: VC (vivienda colectiva) o VU (unifamiliar). */
export function serpaviTypology(kind: PropertyKind): "VC" | "VU" {
  return kind === "CASA_ADOSADA" || kind === "CASA_INDEPENDIENTE" || kind === "VILLA" ? "VU" : "VC";
}

export const OUTDOOR = ["NONE", "BALCONY", "TERRACE", "GARDEN"] as const;
export const OUTDOOR_LABELS: Record<(typeof OUTDOOR)[number], string> = {
  NONE: "Ninguno",
  BALCONY: "Balcón",
  TERRACE: "Terraza",
  GARDEN: "Jardín",
};
export const CONDITIONS = ["NEW", "GOOD", "TO_REFORM"] as const;
export const CONDITION_LABELS: Record<(typeof CONDITIONS)[number], string> = {
  NEW: "Nueva o reformada",
  GOOD: "Buen estado",
  TO_REFORM: "Necesita reforma",
};
export const CURRENT_USES = ["EMPTY", "OWNER_PRIMARY", "SECOND_HOME", "RENTED", "TOURIST", "OTHER"] as const;
export type CurrentUse = (typeof CURRENT_USES)[number];
export const CURRENT_USE_LABELS: Record<CurrentUse, string> = {
  EMPTY: "Vacía",
  OWNER_PRIMARY: "Vivienda habitual del propietario",
  SECOND_HOME: "Segunda residencia",
  RENTED: "Alquilada (larga duración)",
  TOURIST: "Alquiler turístico",
  OTHER: "Otra situación",
};
export const GOALS = ["SELL_SOON", "INCOME", "KEEP_WEALTH", "UNSURE"] as const;
export const GOAL_LABELS: Record<(typeof GOALS)[number], string> = {
  SELL_SOON: "Vender próximamente",
  INCOME: "Obtener ingresos periódicos",
  KEEP_WEALTH: "Mantener mi patrimonio",
  UNSURE: "Aún no lo sé",
};
export const HORIZONS = [1, 3, 5, 10] as const;
export type Horizon = (typeof HORIZONS)[number];
export const TENANCY_ISSUES = ["NONE", "ARREARS", "LITIGATION", "POSSESSION_RECOVERY", "UNDISCLOSED"] as const;
export const TENANCY_ISSUE_LABELS: Record<(typeof TENANCY_ISSUES)[number], string> = {
  NONE: "Ninguno",
  ARREARS: "Impago actual del inquilino",
  LITIGATION: "Litigio en curso",
  POSSESSION_RECOVERY: "Recuperación de la posesión pendiente",
  UNDISCLOSED: "Prefiero no indicarlo",
};
export const TAX_RESIDENCES = ["ES", "EU_EEA", "OTHER"] as const;
export type TaxResidence = (typeof TAX_RESIDENCES)[number];
export const TAX_RESIDENCE_LABELS: Record<TaxResidence, string> = {
  ES: "Residente fiscal en España",
  EU_EEA: "No residente (UE / EEE)",
  OTHER: "No residente (otro país)",
};
export const OWNER_VALUATION_KINDS = ["APPRAISAL", "CADASTRAL_REFERENCE_VALUE", "OFFER"] as const;
export const OWNER_VALUATION_LABELS: Record<(typeof OWNER_VALUATION_KINDS)[number], string> = {
  APPRAISAL: "Tasación oficial reciente",
  CADASTRAL_REFERENCE_VALUE: "Valor de referencia del Catastro",
  OFFER: "Oferta firme recibida",
};

export const LANDLORD_BRACKETS = ["1_4", "5_10", "OVER_10", "UNDISCLOSED"] as const;
export type LandlordBracket = (typeof LANDLORD_BRACKETS)[number];
export const LANDLORD_LABELS: Record<LandlordBracket, string> = {
  "1_4": "De 1 a 4 viviendas",
  "5_10": "De 5 a 10 viviendas",
  OVER_10: "Más de 10 viviendas",
  UNDISCLOSED: "Prefiero no indicarlo",
};

/** Condiciones del NUEVO contrato que determinan la reducción del IRPF (art. 23.2 LIRPF, Ley 12/2023). */
export const NEW_CONTRACT_CONDITIONS = ["GENERAL", "REHAB", "TENSIONED_YOUNG", "TENSIONED_DECREASE"] as const;
export type NewContractCondition = (typeof NEW_CONTRACT_CONDITIONS)[number];

const money = z
  .preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().min(0).max(100_000_000).nullable())
  .default(null);
const percent = z
  .preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().min(0).max(100).nullable())
  .default(null);
const intOrNull = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(min).max(max).nullable()).default(null);

export const studyInputSchema = z
  .object({
    location: z.object({
      country: z.literal("ES"),
      ccaaCode: z.string().regex(/^\d{2}$/),
      provinceCode: z.string().regex(/^\d{2}$/),
      municipalityName: z.string().trim().min(2).max(120),
      municipalityCode: z.string().regex(/^\d{5}$/).nullable().default(null),
      ineValueId: z.number().int().positive().nullable().default(null),
      postalCode: z.string().regex(/^\d{5}$/),
      address: z.string().trim().max(200).nullable().default(null),
      cadastralRef: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[0-9A-Z]{14}([0-9A-Z]{6})?$/)
        .nullable()
        .default(null),
    }),
    property: z.object({
      kind: z.enum(PROPERTY_KINDS),
      sqm: z.coerce.number().int().min(15).max(5000),
      bedrooms: z.coerce.number().int().min(0).max(20),
      bathrooms: z.coerce.number().int().min(0).max(15),
      floor: intOrNull(-2, 60),
      elevator: z.boolean().nullable().default(null),
      outdoor: z.enum(OUTDOOR),
      parking: z.boolean(),
      storage: z.boolean(),
      condition: z.enum(CONDITIONS),
      yearBuilt: intOrNull(1700, 2030),
      currentUse: z.enum(CURRENT_USES),
    }),
    economics: z.object({
      purchasePrice: money,
      purchaseYear: intOrNull(1950, 2030),
      purchaseCosts: money,
      improvementsCost: money,
      mortgageBalance: money,
      mortgageRate: percent,
      mortgageYearsLeft: intOrNull(0, 50),
      mortgageMonthlyPayment: money,
      communityFeesYear: money,
      ibiYear: money,
      insuranceYear: money,
      maintenanceYear: money,
      otherCostsYear: money,
      cadastralValueTotal: money,
      cadastralValueLand: money,
      ownerValuation: z
        .object({ value: z.coerce.number().min(10_000).max(100_000_000), kind: z.enum(OWNER_VALUATION_KINDS) })
        .nullable()
        .default(null),
    }),
    owner: z.object({
      goal: z.enum(GOALS),
      horizon: z.coerce.number().refine((v): v is Horizon => (HORIZONS as readonly number[]).includes(v), "Horizonte no válido"),
      currentRent: money,
      tenancyIssue: z.enum(TENANCY_ISSUES),
      taxResidence: z.enum(TAX_RESIDENCES),
      /** Solo para la exención del IRPF por venta de vivienda habitual (≥ 65 años). Opcional. */
      over65: z.enum(["YES", "NO", "UNDISCLOSED"]).default("UNDISCLOSED"),
      marginalRate: percent,
      // --- Régimen legal del alquiler (Ley 12/2023) y fiscalidad del contrato ---
      /** Nº de viviendas del arrendador: determina si es «gran tenedor». */
      landlordBracket: z.enum(LANDLORD_BRACKETS).default("UNDISCLOSED"),
      /** ¿Ha estado alquilada como vivienda habitual en los últimos 5 años? */
      rentedLast5Years: z.enum(["YES", "NO", "UNKNOWN"]).default("UNKNOWN"),
      /** Renta mensual del último contrato (si lo hubo en los últimos 5 años). */
      previousRent: money,
      /** Fecha de firma del contrato vigente (AAAA-MM), si está alquilada. */
      rentalContractStart: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .nullable()
        .default(null),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.location.postalCode.slice(0, 2) !== v.location.provinceCode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["location", "postalCode"], message: "El código postal no corresponde a la provincia" });
    }
    if (v.economics.cadastralValueLand != null && v.economics.cadastralValueTotal != null && v.economics.cadastralValueLand > v.economics.cadastralValueTotal) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["economics", "cadastralValueLand"], message: "El valor del suelo no puede superar el valor catastral total" });
    }
  });

export type StudyInput = z.infer<typeof studyInputSchema>;

// ---------------------------------------------------------------------------
// Hipótesis del simulador (modificables por el usuario)
// ---------------------------------------------------------------------------
export const SALE_CHOICES = ["AUTO", "MANUAL"] as const;
/** AUTO = renta actual del contrato → estimación de mercado → referencia estadística (con aviso). */
export const RENT_CHOICES = ["AUTO", "OWNER_CURRENT", "MARKET", "STATISTICAL", "LEGAL_CAP", "MANUAL"] as const;
export type RentChoice = (typeof RENT_CHOICES)[number];

export interface StudyAssumptions {
  /** Valor de venta: AUTO usa la estimación del estudio; MANUAL usa `saleValue`. Nunca 0 como desconocido. */
  saleChoice: (typeof SALE_CHOICES)[number];
  saleValue: number | null;
  /** Renta usada en la simulación (ver RENT_CHOICES); MANUAL usa `monthlyRent`. */
  rentChoice: RentChoice;
  monthlyRent: number | null;
  /** Condiciones del nuevo contrato (reducción IRPF). Solo se usa si se simula un contrato nuevo. */
  newContractCondition: NewContractCondition;
  appreciationPct: number; // revalorización anual de la vivienda
  rentGrowthPct: number; // subida anual del alquiler
  costInflationPct: number; // subida anual de gastos fijos
  vacancyMonths: number; // meses sin inquilino al año
  managementPct: number; // % de la renta por gestión (0 si la gestiona el propietario)
  maintenancePctRent: number; // % de la renta para mantenimiento (si no se indica importe)
  opportunityRatePct: number; // rentabilidad neta alternativa del capital
  agencyFeePct: number; // honorarios de agencia en la venta (sin IVA)
  vatPct: number; // IVA sobre honorarios
  notaryAndOtherSaleCosts: number; // notaría, gestoría, certificados, cédula…
  mortgageCancellationCosts: number; // cancelación registral + gestoría (si hay hipoteca)
  earlyRepaymentFeePct: number; // comisión por amortización anticipada
  plusvaliaRatePct: number; // tipo municipal IIVTNU (máx. legal 30 %)
  marginalRatePct: number; // tipo marginal IRPF del propietario (residentes)
  communityFeesYear: number | null; // null = desconocido (no se incluye y se avisa)
  ibiYear: number | null;
  insuranceYear: number | null;
  otherCostsYear: number;
  extraordinaryCosts: number; // derramas, reformas… en todo el horizonte
  // --- Escenarios adversos (hipótesis manuales, modificables) ---
  riskLegalArrears: number;
  riskLegalEviction: number;
  riskLegalRecovery: number;
  riskLegalSquatting: number;
  riskRepairsArrears: number;
  riskRepairsEviction: number;
  riskRepairsRecovery: number;
  riskRepairsSquatting: number;
  riskReletMonths: number;
  riskDepositMonths: number;
}

export interface AssumptionMeta {
  label: string;
  origin: DataOrigin;
  note?: string;
}

// ---------------------------------------------------------------------------
// Resultado guardado (snapshot) del estudio
// ---------------------------------------------------------------------------
export interface SourceRef {
  name: string;
  url?: string;
  /** Periodo de referencia del dato (p. ej. "2024"). */
  period?: string;
  /** Fecha de consulta / importación. */
  retrievedAt?: string;
  status: "OK" | "STALE" | "ERROR" | "NOT_CONFIGURED" | "NOT_AVAILABLE";
  note?: string;
}

export interface Estimate {
  value: number;
  low: number;
  high: number;
  perM2: number;
  origin: DataOrigin;
  method: string;
  confidence: Confidence;
  source: SourceRef;
  adjustments: Array<{ label: string; pct: number }>;
  limitations: string[];
}

export interface SeriesPoint {
  period: string;
  value: number;
}

export interface Series {
  label: string;
  unit: string;
  points: SeriesPoint[];
  source: SourceRef;
}

export type TensionedStatus = "DECLARED" | "PARTIAL" | "EXPIRED" | "NOT_FOUND" | "UNKNOWN";

export interface TensionedCheck {
  status: TensionedStatus;
  summary: string;
  detail?: string;
  validFrom?: string | null;
  validTo?: string | null;
  resolution?: string;
  bulletin?: string | null;
  source: SourceRef;
}

export interface ZoneData {
  population: Series | null;
  populationBySex: { year: string; men: number; women: number } | null;
  touristDwellingsPct: Series | null;
  rentalStock: Series | null; // nº de viviendas con alquiler declarado (SERPAVI)
  rentM2History: Series | null; // €/m² SERPAVI
  rentIndex: Series | null; // IPVA municipal (INE)
  priceIndexCcaa: Series | null; // IPV comunidad autónoma (INE)
  unavailable: Array<{ indicator: string; reason: string }>;
}

export interface StudySnapshot {
  version: 1;
  createdAt: string;
  sale: Estimate | null;
  saleAlternatives: Estimate[];
  /** @deprecated (estudios antiguos): primera estimación de alquiler. Usar rentStatistical / rentMarket. */
  rent: Estimate | null;
  rentAlternatives: Estimate[];
  /** Renta de referencia ESTADÍSTICA (SERPAVI: contratos vigentes declarados). No es la renta de un contrato nuevo. */
  rentStatistical?: Estimate | null;
  /** Estimación de alquiler de MERCADO (fuentes de mercado autorizadas o referencias del equipo). */
  rentMarket?: Estimate | null;
  /** Estado de la valoración de venta cuando no hay estimación. */
  saleStatus?: { reliable: boolean; reason: string; needed: string[] };
  ownerCurrentRent: number | null;
  comparables: {
    available: boolean;
    note: string;
    serpaviBand?: { year: string; p25: number; median: number; p75: number; medianSqm: number; count: number; typology: "VC" | "VU" };
  };
  tensioned: TensionedCheck;
  zone: ZoneData;
  sources: SourceRef[];
  missingData: string[];
  warnings: string[];
}
