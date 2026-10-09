// Indicadores del negocio. Reglas comunes:
//  · Nunca se cuentan datos de demostración (leads isDemo, eventos de sesiones «seed-» o marcados como simulados).
//  · Cada indicador cuenta una vez por elemento: estudios, contactos o solicitudes DISTINTOS en el periodo.
//  · Las conversiones son «de periodo» (etapa / etapa anterior en el mismo periodo), no por cohortes.
import { prisma } from "@/db/client";

export interface Period {
  from: Date;
  to: Date;
}

export const METRIC_DEFINITIONS = [
  { key: "studiesStarted", label: "Estudios iniciados", def: "Visitantes distintos (sesión del navegador) que empiezan a rellenar el formulario del estudio." },
  { key: "studiesCompleted", label: "Estudios completados", def: "Estudios creados en la base de datos (el propietario llega a ver sus resultados)." },
  { key: "reportsGenerated", label: "Informes generados", def: "Estudios distintos con al menos un informe PDF descargado o enviado por email." },
  { key: "requestsReceived", label: "Solicitudes recibidas", def: "Solicitudes enviadas desde la pantalla final (incluye «solo mi informe» por email). Un contacto puede enviar varias." },
  { key: "consultationsRequested", label: "Consultas solicitadas", def: "Contactos distintos que piden ayuda para vender, alquilar o asesoramiento." },
  { key: "consultationsScheduled", label: "Consultas concertadas", def: "Contactos distintos que pasan al estado «Consulta concertada»." },
  { key: "proposalsSent", label: "Propuestas enviadas", def: "Contactos distintos que pasan al estado «Propuesta enviada»." },
  { key: "clientsWon", label: "Clientes conseguidos", def: "Contactos distintos que pasan al estado «Cliente conseguido»." },
  { key: "revenue", label: "Ingresos registrados", def: "Suma de los ingresos reales introducidos a mano, por fecha del ingreso." },
] as const;

export type MetricKey = (typeof METRIC_DEFINITIONS)[number]["key"];

const parse = (payload: string | null) => {
  try {
    return payload ? (JSON.parse(payload) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const realEvent = (e: { sessionId: string | null; payload: string | null }) => !e.sessionId?.startsWith("seed-") && parse(e.payload).simulated !== true;

async function demoLeadIds() {
  return new Set((await prisma.lead.findMany({ where: { isDemo: true }, select: { id: true } })).map((l) => l.id));
}

async function distinctStageEntries(stage: string, period: Period, demo: Set<string>) {
  const events = await prisma.event.findMany({
    where: { category: "BUSINESS", type: "STAGE_ENTERED", createdAt: { gte: period.from, lte: period.to }, leadId: { not: null } },
    select: { leadId: true, payload: true },
  });
  return new Set(events.filter((e) => parse(e.payload).to === stage && !demo.has(e.leadId!)).map((e) => e.leadId!)).size;
}

export async function getBusinessMetrics(period: Period) {
  const range = { gte: period.from, lte: period.to };
  const demo = await demoLeadIds();

  const [started, studies, reports, requests, revenues] = await Promise.all([
    prisma.event.findMany({ where: { category: "ANALYTICS", type: "study_started", createdAt: range }, select: { sessionId: true, payload: true } }),
    prisma.study.count({ where: { createdAt: range } }),
    prisma.event.findMany({ where: { category: "ANALYTICS", type: "report_generated", createdAt: range }, select: { sessionId: true, payload: true } }),
    prisma.serviceRequest.findMany({ where: { createdAt: range }, select: { leadId: true, interest: true } }),
    prisma.revenue.findMany({ where: { date: range }, select: { amount: true, leadId: true, serviceCode: true } }),
  ]);

  const realRequests = requests.filter((r) => !demo.has(r.leadId));
  const values: Record<MetricKey, number> = {
    studiesStarted: new Set(started.filter(realEvent).map((e) => e.sessionId ?? "anon")).size,
    studiesCompleted: studies,
    reportsGenerated: new Set(reports.filter(realEvent).map((e) => String(parse(e.payload).studyId ?? ""))).size,
    requestsReceived: realRequests.length,
    consultationsRequested: new Set(realRequests.filter((r) => r.interest !== "REPORT_ONLY").map((r) => r.leadId)).size,
    consultationsScheduled: await distinctStageEntries("APPOINTMENT", period, demo),
    proposalsSent: await distinctStageEntries("PROPOSAL_SENT", period, demo),
    clientsWon: await distinctStageEntries("CONVERTED", period, demo),
    revenue: revenues.filter((r) => !r.leadId || !demo.has(r.leadId)).reduce((s, r) => s + r.amount, 0),
  };

  // Embudo: cada etapa respecto a la anterior
  const funnel: Array<{ key: MetricKey; from: MetricKey }> = [
    { key: "studiesCompleted", from: "studiesStarted" },
    { key: "reportsGenerated", from: "studiesCompleted" },
    { key: "consultationsRequested", from: "studiesCompleted" },
    { key: "consultationsScheduled", from: "consultationsRequested" },
    { key: "proposalsSent", from: "consultationsScheduled" },
    { key: "clientsWon", from: "proposalsSent" },
  ];
  const conversions = funnel.map((f) => ({ ...f, rate: values[f.from] > 0 ? values[f.key] / values[f.from] : null }));

  const byInterest: Record<string, number> = {};
  for (const r of realRequests) byInterest[r.interest] = (byInterest[r.interest] ?? 0) + 1;
  const revenueByService: Record<string, number> = {};
  for (const r of revenues) if (!r.leadId || !demo.has(r.leadId)) revenueByService[r.serviceCode ?? "OTRO"] = (revenueByService[r.serviceCode ?? "OTRO"] ?? 0) + r.amount;

  return { values, conversions, byInterest, revenueByService };
}

export function periodFromPreset(preset: string | undefined, now = new Date()): Period & { preset: string } {
  const days = preset === "7" ? 7 : preset === "90" ? 90 : preset === "365" ? 365 : preset === "all" ? null : 30;
  const from = days == null ? new Date("2000-01-01T00:00:00Z") : new Date(now.getTime() - days * 24 * 3600 * 1000);
  return { from, to: now, preset: days == null ? "all" : String(days) };
}
