// CRM privado de cada inmobiliaria. REGLA: toda consulta lleva `agencyId: t.agencyId`, que sale de la
// sesión del servidor (nunca del formulario ni de la URL). Un identificador de otra inmobiliaria se
// comporta exactamente igual que uno inexistente («no encontrado»).
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { audit } from "@/services/audit";
import { normalizePhone } from "@/services/crm/requests";

export interface Tenant {
  agencyId: string;
  userId: string;
  userName: string;
}

export class CrmError extends Error {}

import {
  ACTIVITY_TYPES,
  AGENCY_STAGES,
  CONTACT_KINDS,
  IN_PROGRESS,
  STAGE_CODES,
  VISIT_STATUSES,
  type AgencyStage,
} from "./catalog";

export * from "./catalog";

const COMMUNICATION = ["CALL", "EMAIL", "WHATSAPP", "MEETING"];

const optText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());

export const contactSchema = z
  .object({
    kind: z.enum(Object.keys(CONTACT_KINDS) as [keyof typeof CONTACT_KINDS], { errorMap: () => ({ message: "Indica el tipo de contacto" }) }),
    name: z.string().trim().min(2, "Indica el nombre").max(80),
    email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().toLowerCase().email("Email no válido").max(120).nullable().optional()),
    phone: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(30).regex(/^[+()\d\s.-]*$/, "Teléfono no válido").nullable().optional()),
    notes: optText(2000),
  })
  .refine((v) => v.email || v.phone, { message: "Indica al menos un email o un teléfono", path: ["email"] });

async function contactOf(t: Tenant, id: string) {
  const c = await prisma.agencyContact.findFirst({ where: { id, agencyId: t.agencyId } });
  if (!c) throw new CrmError("Contacto no encontrado");
  return c;
}

async function findDuplicate(t: Tenant, email?: string | null, phone?: string | null, exceptId?: string) {
  const p = normalizePhone(phone);
  const or: Prisma.AgencyContactWhereInput[] = [];
  if (email) or.push({ emailNormalized: email.toLowerCase() });
  if (p) or.push({ phoneNormalized: p });
  if (!or.length) return null;
  return prisma.agencyContact.findFirst({ where: { agencyId: t.agencyId, OR: or, ...(exceptId ? { id: { not: exceptId } } : {}) } });
}

export async function createContact(t: Tenant, raw: unknown) {
  const data = contactSchema.parse(raw);
  const dup = await findDuplicate(t, data.email, data.phone);
  if (dup) throw new CrmError(`Ya tienes este contacto (${dup.name}). Ábrelo desde Contactos para no duplicarlo.`);
  const c = await prisma.agencyContact.create({
    data: {
      agencyId: t.agencyId,
      kind: data.kind,
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      emailNormalized: data.email ?? null,
      phoneNormalized: normalizePhone(data.phone),
      notes: data.notes ?? null,
      status: "NEW",
      source: "MANUAL",
      createdById: t.userId,
    },
  });
  await addActivity(t, c.id, "SYSTEM", `Contacto creado por ${t.userName}`);
  return c;
}

export async function updateContact(t: Tenant, id: string, raw: unknown) {
  const c = await contactOf(t, id);
  const data = contactSchema.parse(raw);
  const dup = await findDuplicate(t, data.email, data.phone, c.id);
  if (dup) throw new CrmError(`Ese email o teléfono ya es de otro contacto (${dup.name})`);
  return prisma.agencyContact.update({
    where: { id: c.id },
    data: { kind: data.kind, name: data.name, email: data.email ?? null, phone: data.phone ?? null, emailNormalized: data.email ?? null, phoneNormalized: normalizePhone(data.phone), notes: data.notes ?? null },
  });
}

async function addActivity(t: Tenant, contactId: string, type: keyof typeof ACTIVITY_TYPES, summary: string, at = new Date()) {
  return prisma.agencyActivity.create({ data: { agencyId: t.agencyId, contactId, type, summary: summary.slice(0, 1000), at, userId: t.userId, userName: t.userName } });
}

export async function changeContactStatus(t: Tenant, id: string, status: string) {
  const c = await contactOf(t, id);
  const next = z.enum(STAGE_CODES).parse(status);
  if (next === c.status) return c;
  const updated = await prisma.agencyContact.update({ where: { id: c.id }, data: { status: next } });
  await addActivity(t, c.id, "STATUS", `${AGENCY_STAGES[c.status as AgencyStage]?.label ?? c.status} → ${AGENCY_STAGES[next].label}`);
  return updated;
}

export async function setContactNextAction(t: Tenant, id: string, action: string | null, at: Date | null) {
  const c = await contactOf(t, id);
  return prisma.agencyContact.update({ where: { id: c.id }, data: { nextAction: action?.trim() || null, nextActionAt: action?.trim() ? at : null } });
}

export async function logActivity(t: Tenant, id: string, type: string, summary: string, at: Date) {
  const c = await contactOf(t, id);
  const kind = z.enum(["NOTE", "CALL", "EMAIL", "WHATSAPP", "MEETING"]).parse(type);
  const text = z.string().trim().min(2, "Escribe un resumen").max(1000).parse(summary);
  if (at > new Date(Date.now() + 5 * 60_000)) throw new CrmError("La fecha no puede ser futura: para planificar usa «Próxima acción»");
  await addActivity(t, c.id, kind, text, at);
  if (COMMUNICATION.includes(kind)) {
    const data: Prisma.AgencyContactUpdateInput = { lastContactAt: c.lastContactAt && c.lastContactAt > at ? c.lastContactAt : at };
    if (c.status === "NEW" || c.status === "PENDING_CONTACT") data.status = "CONTACTED";
    // La próxima acción vencida se da por hecha al registrar la comunicación
    if (c.nextActionAt && c.nextActionAt <= new Date()) {
      data.nextAction = null;
      data.nextActionAt = null;
    }
    await prisma.agencyContact.update({ where: { id: c.id }, data });
    if (data.status) await addActivity(t, c.id, "STATUS", `${AGENCY_STAGES[c.status as AgencyStage].label} → ${AGENCY_STAGES.CONTACTED.label}`);
  }
}

export async function getContact(t: Tenant, id: string) {
  const c = await prisma.agencyContact.findFirst({
    where: { id, agencyId: t.agencyId },
    include: {
      activities: { orderBy: { at: "desc" }, take: 200 },
      visits: { orderBy: { at: "desc" }, include: { listing: { select: { id: true, reference: true, title: true } } } },
      inquiries: { orderBy: { createdAt: "desc" }, include: { listing: { select: { id: true, reference: true, title: true } } } },
      listings: { select: { id: true, reference: true, title: true, status: true } },
    },
  });
  if (!c) throw new CrmError("Contacto no encontrado");
  return c;
}

export type ContactView = "all" | "pending" | "overdue" | "today" | "in_progress" | "won" | "lost";

export async function listContacts(t: Tenant, f: { view?: ContactView; kind?: string; status?: string; q?: string } = {}) {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const where: Prisma.AgencyContactWhereInput = { agencyId: t.agencyId };
  if (f.view === "pending") where.status = { in: ["NEW", "PENDING_CONTACT"] };
  if (f.view === "overdue") where.nextActionAt = { lt: now };
  if (f.view === "today") where.nextActionAt = { lte: endOfDay };
  if (f.view === "in_progress") where.status = { in: IN_PROGRESS };
  if (f.view === "won") where.status = "WON";
  if (f.view === "lost") where.status = "LOST";
  if (f.status && STAGE_CODES.includes(f.status as AgencyStage)) where.status = f.status;
  if (f.kind && f.kind in CONTACT_KINDS) where.kind = f.kind;
  if (f.q?.trim()) {
    const q = f.q.trim();
    where.OR = [{ name: { contains: q } }, { emailNormalized: { contains: q.toLowerCase() } }, { phoneNormalized: { contains: q.replace(/\D/g, "") || "—" } }];
  }
  return prisma.agencyContact.findMany({
    where,
    orderBy: f.view === "overdue" || f.view === "today" ? { nextActionAt: "asc" } : { updatedAt: "desc" },
    take: 500,
  });
}

export async function deleteContact(t: Tenant, id: string) {
  const c = await contactOf(t, id);
  // Derecho de supresión: se borran también sus solicitudes del portal (contienen sus datos)
  await prisma.listingInquiry.deleteMany({ where: { contactId: c.id, agencyId: t.agencyId } });
  await prisma.agencyContact.delete({ where: { id: c.id } });
  await audit({ type: "AGENCY_USER", id: t.userId, agencyId: t.agencyId }, "agency_contact.erase", "AgencyContact", c.id);
}

export async function exportContact(t: Tenant, id: string) {
  const c = await getContact(t, id);
  await audit({ type: "AGENCY_USER", id: t.userId, agencyId: t.agencyId }, "agency_contact.export", "AgencyContact", c.id);
  return {
    exportedAt: new Date().toISOString(),
    contact: { name: c.name, email: c.email, phone: c.phone, kind: c.kind, status: c.status, source: c.source, notes: c.notes, createdAt: c.createdAt },
    activities: c.activities.map((a) => ({ at: a.at, type: a.type, summary: a.summary })),
    visits: c.visits.map((v) => ({ at: v.at, status: v.status, listing: v.listing?.reference ?? null, notes: v.notes })),
    inquiries: c.inquiries.map((i) => ({ at: i.createdAt, listing: i.listing.reference, message: i.message, consent: i.consentText })),
  };
}

// ---------------------------------------------------------------------------
// Visitas
// ---------------------------------------------------------------------------

export async function scheduleVisit(t: Tenant, contactId: string, at: Date, listingId: string | null, notes: string | null) {
  const c = await contactOf(t, contactId);
  if (listingId) {
    const own = await prisma.listing.count({ where: { id: listingId, agencyId: t.agencyId } });
    if (!own) throw new CrmError("Inmueble no encontrado");
  }
  const visit = await prisma.agencyVisit.create({ data: { agencyId: t.agencyId, contactId: c.id, listingId, at, notes: notes?.trim().slice(0, 500) || null } });
  const order: AgencyStage[] = ["NEW", "PENDING_CONTACT", "CONTACTED"];
  if (order.includes(c.status as AgencyStage)) await changeContactStatus(t, c.id, "VISIT_SCHEDULED");
  await addActivity(t, c.id, "NOTE", `Visita programada para ${at.toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" })}`);
  return visit;
}

export async function setVisitStatus(t: Tenant, visitId: string, status: string) {
  const v = await prisma.agencyVisit.findFirst({ where: { id: visitId, agencyId: t.agencyId } });
  if (!v) throw new CrmError("Visita no encontrada");
  const next = z.enum(["SCHEDULED", "DONE", "CANCELLED"]).parse(status);
  await prisma.agencyVisit.update({ where: { id: v.id }, data: { status: next } });
  await addActivity(t, v.contactId, "NOTE", `Visita ${VISIT_STATUSES[next].toLowerCase()}`);
}

export async function listVisits(t: Tenant, scope: "upcoming" | "past" = "upcoming") {
  const now = new Date();
  return prisma.agencyVisit.findMany({
    where: { agencyId: t.agencyId, ...(scope === "upcoming" ? { at: { gte: new Date(now.getTime() - 3 * 3600_000) }, status: "SCHEDULED" } : { OR: [{ at: { lt: now } }, { status: { not: "SCHEDULED" } }] }) },
    orderBy: { at: scope === "upcoming" ? "asc" : "desc" },
    take: 200,
    include: { contact: { select: { id: true, name: true } }, listing: { select: { id: true, reference: true, title: true } } },
  });
}

// ---------------------------------------------------------------------------
// Solicitudes del portal recibidas por la inmobiliaria
// ---------------------------------------------------------------------------

export async function listInquiries(t: Tenant, status?: string) {
  return prisma.listingInquiry.findMany({
    where: { agencyId: t.agencyId, listing: { agencyId: t.agencyId }, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { listing: { select: { id: true, reference: true, title: true } }, contact: { select: { id: true, name: true } } },
  });
}

export async function setInquiryStatus(t: Tenant, inquiryId: string, status: string) {
  const i = await prisma.listingInquiry.findFirst({ where: { id: inquiryId, agencyId: t.agencyId, listing: { agencyId: t.agencyId } } });
  if (!i) throw new CrmError("Solicitud no encontrada");
  await prisma.listingInquiry.update({ where: { id: i.id }, data: { status: z.enum(["NEW", "HANDLED", "DISCARDED"]).parse(status) } });
}

// ---------------------------------------------------------------------------
// Inicio del CRM
// ---------------------------------------------------------------------------

export async function agencyDashboard(t: Tenant) {
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 3600_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const a = t.agencyId;
  const [pending, overdue, upcomingTasks, visits, inProgress, wonMonth, wonTotal, newInquiries, listingsByStatus] = await Promise.all([
    prisma.agencyContact.count({ where: { agencyId: a, status: { in: ["NEW", "PENDING_CONTACT"] } } }),
    prisma.agencyContact.findMany({ where: { agencyId: a, nextActionAt: { lt: now } }, orderBy: { nextActionAt: "asc" }, take: 8 }),
    prisma.agencyContact.findMany({ where: { agencyId: a, nextActionAt: { gte: now, lte: week } }, orderBy: { nextActionAt: "asc" }, take: 8 }),
    prisma.agencyVisit.findMany({
      where: { agencyId: a, status: "SCHEDULED", at: { gte: new Date(now.getTime() - 3 * 3600_000) } },
      orderBy: { at: "asc" },
      take: 8,
      include: { contact: { select: { id: true, name: true } }, listing: { select: { reference: true } } },
    }),
    prisma.agencyContact.count({ where: { agencyId: a, status: { in: IN_PROGRESS } } }),
    prisma.agencyActivity.count({ where: { agencyId: a, type: "STATUS", summary: { endsWith: AGENCY_STAGES.WON.label }, at: { gte: monthStart } } }),
    prisma.agencyContact.count({ where: { agencyId: a, status: "WON" } }),
    prisma.listingInquiry.count({ where: { agencyId: a, status: "NEW" } }),
    prisma.listing.groupBy({ by: ["status"], where: { agencyId: a }, _count: true }),
  ]);
  return {
    pending,
    overdue,
    upcomingTasks,
    visits,
    inProgress,
    wonMonth,
    wonTotal,
    newInquiries,
    listings: Object.fromEntries(listingsByStatus.map((r) => [r.status, r._count])) as Record<string, number>,
  };
}

// ---------------------------------------------------------------------------
// Oportunidades que FINCALIA360 asigna a la inmobiliaria (con consentimiento del propietario)
// ---------------------------------------------------------------------------

/** Copia el contacto asignado al CRM de la inmobiliaria (si tiene acceso). Idempotente. */
export async function deliverAssignment(assignmentId: string) {
  const a = await prisma.partnerAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      agency: true,
      lead: {
        include: {
          studies: { orderBy: { createdAt: "desc" }, take: 1, select: { municipalityName: true, propertyType: true, sqm: true, postalCode: true } },
          requests: { orderBy: { createdAt: "desc" }, take: 1, select: { comments: true } },
        },
      },
    },
  });
  if (!a || !a.agency.crmAccess || a.agency.status !== "ACTIVE") return null;
  if (!a.lead.partnerShareConsent) return null;
  const existing = await prisma.agencyContact.findFirst({ where: { agencyId: a.agencyId, source: "FINCALIA360", sourceRef: a.id } });
  if (existing) return existing;
  const lead = a.lead;
  const interest = a.serviceCode ?? lead.primaryInterest;
  const kind = interest === "RENT" ? "OWNER_RENT" : interest === "SELL" ? "OWNER_SELL" : "OTHER";
  const study = lead.studies[0];
  const comments = lead.requests[0]?.comments;
  const details = [
    study ? `Vivienda: ${study.propertyType.toLowerCase()} en ${study.municipalityName}${study.postalCode ? ` (${study.postalCode})` : ""}` : null,
    study?.sqm ? `${study.sqm} m²` : null,
    comments ? `Comentarios del propietario: ${comments}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const contact = await prisma.agencyContact.create({
    data: {
      agencyId: a.agencyId,
      kind,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      emailNormalized: lead.email.toLowerCase(),
      phoneNormalized: normalizePhone(lead.phone),
      status: "PENDING_CONTACT",
      source: "FINCALIA360",
      sourceRef: a.id,
      notes: details || null,
      nextAction: "Contactar: oportunidad enviada por FINCALIA360",
      nextActionAt: new Date(),
    },
  });
  await prisma.agencyActivity.create({
    data: { agencyId: a.agencyId, contactId: contact.id, type: "SYSTEM", summary: "Oportunidad enviada por FINCALIA360 con el consentimiento del propietario para comunicar sus datos." },
  });
  await audit({ type: "SYSTEM" }, "assignment.delivered", "PartnerAssignment", a.id, null, a.agencyId);
  return contact;
}
