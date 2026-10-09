// Inmobiliarias colaboradoras y distribución de leads.
import { prisma } from "@/db/client";
import { LOCATION_LABELS, PROPERTY_LABELS } from "@/lib/labels";
import { csv } from "@/lib/utils";
import type { AgencyInput } from "@/lib/validation";
import { emitBusinessEvent } from "./notificationService";

/** Comodín de zona: la agencia cubre toda la Costa Brava. */
export const ZONE_ALL = "COSTA_BRAVA";

export interface AgencyLike {
  id: string;
  name: string;
  zones: string;
  languages: string;
  propertyTypes: string;
  status: string;
  leadCount?: number;
}

export interface LeadMatchInput {
  location: string;
  propertyType: string;
  language: string;
}

export interface AgencyMatch {
  agency: AgencyLike;
  score: number;
  reasons: string[];
}

/**
 * Ranking puro (testeable). Criterios: zona (+4, o +1 si cubre toda la Costa Brava),
 * tipo de propiedad (+2), idioma (+2). Se excluyen las agencias PAUSED.
 * Desempate: la agencia con menos leads recibidos (reparto equilibrado).
 */
export function rankAgencies(lead: LeadMatchInput, agencies: AgencyLike[]): AgencyMatch[] {
  return agencies
    .filter((a) => a.status === "ACTIVE")
    .map((agency) => {
      const reasons: string[] = [];
      let score = 0;
      const zones = csv(agency.zones);
      if (zones.includes(lead.location)) {
        score += 4;
        reasons.push(`Zona: ${LOCATION_LABELS[lead.location as keyof typeof LOCATION_LABELS] ?? lead.location}`);
      } else if (zones.includes(ZONE_ALL)) {
        score += 1;
        reasons.push("Cubre toda la Costa Brava");
      }
      if (csv(agency.propertyTypes).includes(lead.propertyType)) {
        score += 2;
        reasons.push(`Trabaja ${PROPERTY_LABELS[lead.propertyType as keyof typeof PROPERTY_LABELS]?.toLowerCase() ?? lead.propertyType}`);
      }
      if (csv(agency.languages).includes(lead.language)) {
        score += 2;
        reasons.push(`Habla ${lead.language.toUpperCase()}`);
      }
      return { agency, score, reasons };
    })
    .sort((a, b) => b.score - a.score || (a.agency.leadCount ?? 0) - (b.agency.leadCount ?? 0));
}

/**
 * Asigna el lead a la inmobiliaria más adecuada (o a la indicada manualmente),
 * registra el evento LEAD_ASSIGNED y "notifica" a la agencia (demo).
 */
export async function assignLeadToAgency(leadId: string, agencyId?: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { property: true } });
  if (!lead || !lead.property) throw new Error("Lead no encontrado");

  let chosen: AgencyLike | null = null;
  let reasons: string[] = [];

  if (agencyId) {
    chosen = await prisma.agency.findUnique({ where: { id: agencyId } });
    reasons = ["Asignación manual"];
  } else {
    const agencies = await prisma.agency.findMany({ include: { _count: { select: { leads: true } } } });
    const ranked = rankAgencies(
      { location: lead.property.location, propertyType: lead.property.type, language: lead.language },
      agencies.map((a) => ({ ...a, leadCount: a._count.leads })),
    );
    if (ranked[0]) {
      chosen = ranked[0].agency;
      reasons = ranked[0].reasons;
    }
  }

  if (!chosen) return null;
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: chosen.id } });
  if (lead.agencyId === agency.id) return agency;

  await prisma.lead.update({ where: { id: leadId }, data: { agencyId: agency.id, assignedAt: new Date() } });
  await emitBusinessEvent("LEAD_ASSIGNED", {
    leadId,
    payload: { agencyId: agency.id, agencyName: agency.name, reasons },
    notification: {
      audience: "agency",
      to: agency.email,
      subject: `Nueva oportunidad: ${lead.name} (${LOCATION_LABELS[lead.property.location as keyof typeof LOCATION_LABELS] ?? lead.property.location})`,
      body: `Lead ${lead.name}, score ${lead.score} (${lead.scoreTier}). Motivos de asignación: ${reasons.join(", ")}.`,
    },
  });
  return agency;
}

export async function listAgencies() {
  return prisma.agency.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { leads: true, appointments: true, assignments: true } } },
  });
}

export async function getAgency(id: string) {
  return prisma.agency.findUnique({
    where: { id },
    include: {
      leads: { orderBy: { createdAt: "desc" }, take: 20, include: { property: true } },
      _count: { select: { leads: true, appointments: true } },
    },
  });
}

function toData(input: AgencyInput) {
  return {
    ...input,
    zones: input.zones.join(","),
    languages: input.languages.join(","),
    propertyTypes: input.propertyTypes.join(","),
    services: input.services.join(","),
    provinces: input.provinces.join(","),
    contactName: input.contactName || null,
    agreementTerms: input.agreementTerms || null,
    notes: input.notes || null,
  };
}

export async function createAgency(input: AgencyInput) {
  return prisma.agency.create({ data: toData(input) });
}

export async function updateAgency(id: string, input: AgencyInput) {
  return prisma.agency.update({ where: { id }, data: toData(input) });
}

export async function setAgencyStatus(id: string, status: (typeof import("@/types").AGENCY_STATUSES)[number]) {
  return prisma.agency.update({ where: { id }, data: { status } });
}

export async function deleteAgency(id: string) {
  return prisma.agency.delete({ where: { id } });
}
