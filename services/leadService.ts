// Ciclo de vida del lead: creación, scoring, estados, notas y preferencias.
import { prisma } from "@/db/client";
import { getDictionary } from "@/lib/i18n";
import { LOCATION_LABELS, PROPERTY_LABELS } from "@/lib/labels";
import type { ValuationFormInput } from "@/lib/validation";
import type { ContactChannel, Language, LeadSource, LeadStatus, ScoreTier, Timeline } from "@/types";
import { trackEvent } from "./analyticsService";
import { emitBusinessEvent } from "./notificationService";
import { calculateScore, intentFromTimeline } from "./scoringService";
import { estimateValue } from "./valuationService";
import type { Prisma } from "@prisma/client";

/** Versión del texto legal aceptado. Cambiarla cuando se revisen los textos. */
export const CONSENT_VERSION = "v0.1-demo-2026-10";

export interface CreateLeadOptions {
  source?: LeadSource;
  sessionId?: string | null;
  isDemo?: boolean;
  createdAt?: Date;
  /** Si es false no se registran eventos de analítica (p. ej. leads de seed). */
  track?: boolean;
  /** Texto de consentimiento mostrado (si el lead no procede del formulario de valoración). */
  consentText?: string;
}

export function computeNextAction(lead: {
  status: string;
  scoreTier: string;
  appointmentInterest?: boolean;
  timeline?: string;
  hasSuggestedAppointment?: boolean;
}): string {
  if (lead.hasSuggestedAppointment && ["NEW", "CONTACTED", "PENDING_CONTACT"].includes(lead.status)) {
    return "Confirmar la cita sugerida con el propietario";
  }
  switch (lead.status as LeadStatus) {
    case "NEW":
      if (lead.scoreTier === "HOT") return "Llamar en menos de 15 min";
      if (lead.appointmentInterest) return "Llamar y proponer cita";
      if (lead.timeline === "INFO_ONLY") return "Nurturing: enviar informe de mercado";
      return "Iniciar conversación con el agente";
    case "STUDY_DONE":
      return "Sin acción comercial: solo ha pedido su informe";
    case "PENDING_CONTACT":
      return "Contactar con el propietario";
    case "CONTACTED":
      return "Concertar una consulta";
    case "APPOINTMENT":
      return "Preparar la consulta";
    case "PROPOSAL_SENT":
      return "Hacer seguimiento de la propuesta";
    case "CONVERTED":
      return "Seguimiento del servicio";
    case "LOST":
      return "—";
    default:
      return "Revisar el contacto";
  }
}

export async function createLead(input: ValuationFormInput, options: CreateLeadOptions = {}) {
  const valuation = estimateValue({
    location: input.location,
    type: input.type,
    sqm: input.sqm,
    bedrooms: input.bedrooms,
    terrace: input.terrace,
    pool: input.pool,
    parking: input.parking,
    condition: input.condition,
  });
  const phone = input.phone?.trim() || null;
  const score = calculateScore({
    timeline: input.timeline,
    estimatedValue: valuation.mid,
    propertyType: input.type,
    situation: input.situation,
    hasPhone: Boolean(phone),
    hasEmail: Boolean(input.email),
  });
  const status: LeadStatus = "NEW";
  const createdAt = options.createdAt ?? new Date();

  // El texto del consentimiento se toma del servidor (no del cliente) en el idioma mostrado.
  const dict = getDictionary(input.language);
  const consentText = options.consentText ?? [dict.form.consentContact, input.consentMarketing ? dict.form.consentMarketing : null].filter(Boolean).join(" | ");

  const lead = await prisma.lead.create({
    data: {
      createdAt,
      name: input.name,
      email: input.email,
      phone,
      language: input.language,
      preferredContact: input.preferredContact ?? (phone ? "PHONE" : "EMAIL"),
      source: options.source ?? input.source ?? "WEB_FORM",
      status,
      timeline: input.timeline,
      situation: input.situation,
      intent: intentFromTimeline(input.timeline),
      motivation: input.situation === "INHERITED" ? "INHERITANCE" : null,
      estimatedValue: valuation.mid,
      estimatedValueMin: valuation.min,
      estimatedValueMax: valuation.max,
      score: score.score,
      scoreTier: score.tier,
      scoreBreakdown: JSON.stringify(score.breakdown),
      nextAction: computeNextAction({ status, scoreTier: score.tier, timeline: input.timeline }),
      isDemo: options.isDemo ?? false,
      property: {
        create: {
          location: input.location,
          locationOther: input.location === "OTHER" ? input.locationOther || null : null,
          type: input.type,
          sqm: input.sqm ?? null,
          bedrooms: input.bedrooms ?? null,
          bathrooms: input.bathrooms ?? null,
          terrace: input.terrace,
          pool: input.pool,
          parking: input.parking,
          condition: input.condition ?? null,
        },
      },
      consent: {
        create: {
          consentContact: input.consentContact,
          consentMarketing: input.consentMarketing,
          consentTimestamp: createdAt,
          consentVersion: CONSENT_VERSION,
          consentText,
          language: input.language,
        },
      },
    },
    include: { property: true },
  });

  await emitBusinessEvent("LEAD_CREATED", {
    leadId: lead.id,
    createdAt,
    payload: { score: score.score, tier: score.tier, source: lead.source },
    notification: {
      audience: "internal",
      to: "equipo@fincalia360.example",
      subject: `Nuevo lead ${score.tier}: ${lead.name} · ${PROPERTY_LABELS[input.type]} en ${LOCATION_LABELS[input.location]}`,
      body: `Score ${score.score}. Plazo: ${input.timeline}. Valor estimado ${valuation.min}-${valuation.max} €.`,
    },
  });

  if (options.track !== false) {
    await trackEvent("valuation_completed", { leadId: lead.id, sessionId: options.sessionId, createdAt });
    await trackEvent("lead_created", { leadId: lead.id, sessionId: options.sessionId, createdAt });
  }

  return lead;
}

/** Recalcula valoración (si cambió la propiedad) y score a partir del estado actual del lead. */
export async function refreshScore(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { property: true, appointments: { where: { status: "REQUESTED" }, select: { id: true } } },
  });
  if (!lead.property) return lead;
  // Los leads del estudio vender/alquilar conservan la valoración del estudio (con sus fuentes).
  const keepStored = lead.valuationSource !== "DEMO_MODEL" && lead.estimatedValue != null;
  const valuation = keepStored
    ? { mid: lead.estimatedValue!, min: lead.estimatedValueMin ?? lead.estimatedValue!, max: lead.estimatedValueMax ?? lead.estimatedValue! }
    : estimateValue({
    location: lead.property.location as never,
    type: lead.property.type as never,
    sqm: lead.property.sqm,
    terrace: lead.property.terrace,
    pool: lead.property.pool,
    parking: lead.property.parking,
    condition: lead.property.condition as never,
  });
  const score = calculateScore({
    timeline: lead.timeline as Timeline,
    estimatedValue: valuation.mid,
    propertyType: lead.property.type as never,
    situation: lead.situation as never,
    hasPhone: Boolean(lead.phone),
    hasEmail: Boolean(lead.email),
    appointmentInterest: lead.appointmentInterest,
  });
  return prisma.lead.update({
    where: { id: leadId },
    data: {
      estimatedValue: valuation.mid,
      estimatedValueMin: valuation.min,
      estimatedValueMax: valuation.max,
      score: score.score,
      scoreTier: score.tier,
      scoreBreakdown: JSON.stringify(score.breakdown),
      intent: intentFromTimeline(lead.timeline as Timeline),
      nextAction: computeNextAction({
        status: lead.status,
        scoreTier: score.tier,
        appointmentInterest: lead.appointmentInterest,
        timeline: lead.timeline,
        hasSuggestedAppointment: lead.appointments.length > 0,
      }),
    },
  });
}

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus | (string & {}),
  options: { by?: "admin" | "agent" | "system"; reason?: string; createdAt?: Date } = {},
) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { agency: true } });
  if (lead.status === status) return lead;

  const now = options.createdAt ?? new Date();
  const data: Prisma.LeadUpdateInput = {
    status,
    nextAction: computeNextAction({ status, scoreTier: lead.scoreTier, appointmentInterest: lead.appointmentInterest }),
  };
  if (status === "PENDING_CONTACT" && !lead.qualifiedAt) data.qualifiedAt = now;
  if (status === "CONVERTED") {
    data.convertedAt = now;
    if (!lead.qualifiedAt) data.qualifiedAt = now;
  }
  if (status === "LOST") data.lostReason = options.reason ?? "Descartado manualmente";
  const updated = await prisma.lead.update({ where: { id: leadId }, data });

  const by = options.by ?? "admin";
  // Registro con códigos (base de los indicadores: cada contacto cuenta una vez por estado alcanzado)
  await emitBusinessEvent("STAGE_ENTERED", { leadId, createdAt: now, payload: { by, from: lead.status, to: status } });
  if (status === "PENDING_CONTACT") {
    await emitBusinessEvent("LEAD_QUALIFIED", {
      leadId,
      createdAt: now,
      payload: { by, score: lead.score },
      notification: { audience: "internal", subject: `Lead cualificado: ${lead.name}`, body: `Cualificado por ${by}.` },
    });
    await trackEvent("lead_qualified", { leadId, createdAt: now });
  } else if (status === "CONVERTED") {
    await emitBusinessEvent("LEAD_CONVERTED", {
      leadId,
      createdAt: now,
      payload: { by, agencyName: lead.agency?.name ?? null },
      notification: {
        audience: "agency",
        to: lead.agency?.email,
        subject: `Oportunidad convertida: ${lead.name}`,
        body: "El propietario ha aceptado avanzar con la inmobiliaria.",
      },
    });
  } else if (status === "LOST") {
    await emitBusinessEvent("LEAD_LOST", { leadId, createdAt: now, payload: { by, reason: data.lostReason } });
  }
  return updated;
}

/** Cualifica (pendiente de contactar) solo si el lead está en una fase anterior (no «baja» de una consulta concertada). */
export async function qualifyLead(leadId: string, by: "admin" | "agent" = "admin") {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (["NEW", "STUDY_DONE", "CONTACTED", "LOST"].includes(lead.status)) return updateLeadStatus(leadId, "PENDING_CONTACT", { by });
  if (!lead.qualifiedAt) await prisma.lead.update({ where: { id: leadId }, data: { qualifiedAt: new Date() } });
  return lead;
}

export async function setContactPreference(leadId: string, choice: "CONTACT_ME" | "KEEP_INFORMED", channel?: ContactChannel) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (choice === "CONTACT_ME") {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        appointmentInterest: true,
        preferredContact: channel ?? lead.preferredContact,
        nextAction: "Llamar al propietario (ha pedido contacto)",
      },
    });
    await emitBusinessEvent("CONTACT_REQUESTED", {
      leadId,
      payload: { channel: channel ?? lead.preferredContact },
      notification: { audience: "internal", subject: `${lead.name} pide que le contacten`, body: "Contactar en < 24 h." },
    });
    return refreshScore(leadId);
  }
  return prisma.lead.update({
    where: { id: leadId },
    data: { nextAction: "Nurturing: enviar informe de mercado y recontactar en 30 días" },
  });
}

export async function addNote(leadId: string, content: string) {
  const note = await prisma.note.create({ data: { leadId, content } });
  await emitBusinessEvent("NOTE_ADDED", { leadId, payload: { preview: content.slice(0, 80) } });
  return note;
}

export interface LeadFilters {
  status?: string;
  tier?: string;
  q?: string;
  language?: string;
}

export async function listLeads(filters: LeadFilters = {}) {
  const where: Prisma.LeadWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.tier) where.scoreTier = filters.tier;
  if (filters.language) where.language = filters.language;
  if (filters.q) where.OR = [{ name: { contains: filters.q } }, { email: { contains: filters.q } }];
  return prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { property: true, agency: { select: { id: true, name: true } } },
  });
}

export async function getLeadDetail(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      property: true,
      consent: true,
      agency: true,
      appointments: { orderBy: { scheduledAt: "asc" }, include: { agency: { select: { name: true } } } },
      conversations: { orderBy: { createdAt: "desc" }, take: 1, include: { messages: { orderBy: { createdAt: "asc" } } } },
      events: { where: { category: "BUSINESS" }, orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
}

/** Datos mínimos para la página pública de resultado (sin exponer datos internos). */
export async function getPublicResult(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      language: true,
      estimatedValueMin: true,
      estimatedValueMax: true,
      score: true,
      scoreTier: true,
      scoreBreakdown: true,
      status: true,
      preferredContact: true,
      property: { select: { location: true, type: true, sqm: true } },
      agency: { select: { name: true } },
      appointments: { where: { status: { in: ["BOOKED", "REQUESTED"] } }, orderBy: { scheduledAt: "asc" }, take: 1 },
    },
  });
}

export type TierCount = Record<ScoreTier, number>;

export function languageOf(lead: { language: string }): Language {
  return lead.language as Language;
}
