// Consultas del panel de administración para los estudios (solo servidor, tras requireAdmin).
import { prisma } from "@/db/client";
import { parseStudy } from "./studyService";

export const COMMERCIAL_STATUSES = ["NEW", "CONTACTED", "VALUATION_SCHEDULED", "VALUATION_DONE", "NOT_INTERESTED"] as const;
export type CommercialStatus = (typeof COMMERCIAL_STATUSES)[number];
export const COMMERCIAL_STATUS_LABELS: Record<CommercialStatus, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  VALUATION_SCHEDULED: "Valoración agendada",
  VALUATION_DONE: "Valoración realizada",
  NOT_INTERESTED: "No interesado",
};

export async function listStudies(filter: { requested?: boolean; status?: string } = {}) {
  return prisma.study.findMany({
    where: {
      ...(filter.requested ? { valuationRequested: true } : {}),
      ...(filter.status ? { commercialStatus: filter.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      createdAt: true,
      municipalityName: true,
      postalCode: true,
      propertyType: true,
      sqm: true,
      saleEstimate: true,
      rentEstimate: true,
      confidence: true,
      tensionedStatus: true,
      valuationRequested: true,
      commercialStatus: true,
      contactName: true,
      contactEmail: true,
      consentContact: true,
      leadId: true,
    },
  });
}

export async function getStudyAdmin(id: string) {
  const study = await prisma.study.findUnique({ where: { id }, include: { lead: { select: { id: true, name: true, status: true } } } });
  return study ? parseStudy(study) : null;
}

export async function setCommercialStatus(id: string, status: CommercialStatus) {
  return prisma.study.update({ where: { id }, data: { commercialStatus: status } });
}

/** Evita la inyección de fórmulas al abrir el CSV en una hoja de cálculo. */
export function csvCell(value: unknown) {
  if (value == null) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Exportación de datos AUTORIZADOS: datos del inmueble y estimaciones (sin datos financieros
 * personales: ni precio de compra, ni hipoteca, ni impuestos) y contacto solo si hay consentimiento.
 */
export async function exportStudiesCsv() {
  const rows = await prisma.study.findMany({ orderBy: { createdAt: "desc" } });
  const header = [
    "fecha",
    "id",
    "municipio",
    "codigo_postal",
    "tipo",
    "m2",
    "venta_estimada",
    "alquiler_estimado",
    "confianza",
    "zona_tensionada",
    "valoracion_solicitada",
    "estado_comercial",
    "nombre",
    "email",
    "telefono",
    "medio_preferido",
    "consentimiento_contacto",
    "consentimiento_comercial",
    "fecha_consentimiento",
    "version_consentimiento",
  ];
  const lines = rows.map((s) => {
    const contactOk = s.consentContact === true;
    return [
      s.createdAt.toISOString(),
      s.id,
      s.municipalityName,
      s.postalCode,
      s.propertyType,
      s.sqm,
      s.saleEstimate,
      s.rentEstimate,
      s.confidence,
      s.tensionedStatus,
      s.valuationRequested ? "si" : "no",
      s.commercialStatus,
      contactOk ? s.contactName : "",
      contactOk ? s.contactEmail : "",
      contactOk ? s.contactPhone : "",
      contactOk ? s.preferredContact : "",
      s.consentContact ? "si" : "no",
      s.consentMarketing ? "si" : "no",
      s.consentTimestamp?.toISOString() ?? "",
      s.consentVersion ?? "",
    ]
      .map(csvCell)
      .join(",");
  });
  return [header.join(","), ...lines].join("\r\n");
}

export async function getDataSourcesStatus() {
  const [declarations, cache, refs] = await Promise.all([
    prisma.tensionedAreaDeclaration.findMany({ orderBy: { validTo: "desc" } }),
    prisma.officialDataCache.findMany({ select: { key: true, source: true, fetchedAt: true }, orderBy: { fetchedAt: "desc" } }),
    prisma.marketReference.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  return { declarations, cache, refs };
}
