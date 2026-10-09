// Estados comerciales y servicios configurables (valores iniciales sin precios inventados).
import { prisma } from "@/db/client";
import { STATUS_LABELS } from "@/lib/labels";
import { LEAD_STATUSES } from "@/types";

export const DEFAULT_STAGES = LEAD_STATUSES.map((code, i) => ({
  code,
  label: STATUS_LABELS[code],
  order: (i + 1) * 10,
  kind: code === "CONVERTED" ? "WON" : code === "LOST" ? "LOST" : "OPEN",
  system: true,
}));

/** FINCALIA360 no intermedia: estudia el caso y pone en contacto con profesionales colaboradores. */
export const DEFAULT_SERVICES = [
  {
    code: "SELL",
    name: "Vender tu vivienda",
    summary: "Revisamos tu estudio contigo y te ponemos en contacto con una inmobiliaria colaboradora de tu zona para preparar la venta.",
    scope:
      "Análisis de tu caso y de la valoración estimada; selección de un profesional colaborador de tu zona y seguimiento de tu solicitud. La valoración comercial y la intermediación las realiza la inmobiliaria colaboradora.",
    order: 10,
  },
  {
    code: "RENT",
    name: "Alquilar tu vivienda",
    summary: "Partimos de los cálculos de tu estudio (renta de mercado y régimen legal) y te ponemos en contacto con profesionales para preparar el alquiler.",
    scope:
      "Revisión de la renta estimada y de las reglas de la zona; contacto con un profesional colaborador. La renta aplicable y el contrato deben verificarse para tu caso concreto.",
    order: 20,
  },
  {
    code: "ADVICE",
    name: "Asesoramiento personalizado",
    summary: "Revisión de los escenarios de venta, alquiler y mantenimiento de tu estudio con un profesional.",
    scope: "Revisión de tus datos, de las hipótesis del estudio y de las alternativas, con las dudas que quieras plantear.",
    order: 30,
  },
] as const;

export const PRICE_TYPE_LABELS: Record<string, string> = {
  TBD: "Por definir",
  FREE: "Gratuito",
  FIXED: "Precio fijo",
  QUOTE: "Presupuesto previo",
  COMMISSION: "Comisión",
};

let ensured = false;
/** Crea los estados y servicios iniciales si no existen (no modifica los ya configurados). */
export async function ensureCrmDefaults() {
  if (ensured) return;
  for (const s of DEFAULT_STAGES) await prisma.pipelineStage.upsert({ where: { code: s.code }, update: {}, create: s });
  for (const s of DEFAULT_SERVICES) await prisma.service.upsert({ where: { code: s.code }, update: {}, create: { ...s, priceType: "TBD" } });
  ensured = true;
}

export async function getStages(options: { includeInactive?: boolean } = {}) {
  await ensureCrmDefaults();
  return prisma.pipelineStage.findMany({ where: options.includeInactive ? {} : { active: true }, orderBy: { order: "asc" } });
}

export async function getStageLabels(): Promise<Record<string, string>> {
  const stages = await getStages({ includeInactive: true });
  return Object.fromEntries(stages.map((s) => [s.code, s.label]));
}

export async function getServices(options: { onlyActive?: boolean } = {}) {
  await ensureCrmDefaults();
  return prisma.service.findMany({ where: options.onlyActive ? { active: true } : {}, orderBy: { order: "asc" } });
}

/** Texto de precio para mostrar al propietario: nunca una cifra que no esté configurada. */
export function priceText(s: { priceType: string; priceAmount: number | null; priceNote: string | null }) {
  const note = s.priceNote ? ` ${s.priceNote}` : "";
  switch (s.priceType) {
    case "FREE":
      return `Gratuito.${note}`;
    case "FIXED":
      return s.priceAmount != null ? `${s.priceAmount.toLocaleString("es-ES")} €.${note}` : "El precio se informa antes de contratar.";
    case "COMMISSION":
      return s.priceAmount != null ? `Comisión del ${(s.priceAmount / 100).toLocaleString("es-ES")} %.${note}` : "Las condiciones se informan antes de contratar.";
    case "QUOTE":
      return `Presupuesto sin compromiso antes de contratar.${note}`;
    default:
      return "El alcance y, en su caso, el precio se explican antes de contratar. Pedir información es gratis y sin compromiso.";
  }
}
