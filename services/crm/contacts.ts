// Gestión comercial de contactos (CRM): consultas, seguimiento, colaboradores, ingresos y derechos RGPD.
// Todas las funciones se llaman desde server actions o rutas protegidas con requireAdmin().
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { INTEREST_LABELS } from "@/lib/labels";
import { emitBusinessEvent } from "@/services/notificationService";
import { updateLeadStatus } from "@/services/leadService";
import { getStages } from "./catalog";

export const CONTACT_CHANNELS = { CALL: "Llamada", EMAIL: "Email", WHATSAPP: "WhatsApp", MEETING: "Reunión", OTHER: "Otro" } as const;
export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Enviada al colaborador",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  WON: "Operación conseguida",
  LOST: "Sin operación",
};

export interface ContactFilters {
  q?: string;
  municipality?: string;
  interest?: string;
  status?: string;
  followUp?: string;
  demo?: string;
}

/** Requiere seguimiento: próxima acción vencida, o contacto nuevo/pendiente sin ninguna gestión, salvo cerrados. */
export function followUpWhere(now = new Date()): Prisma.LeadWhereInput {
  return {
    status: { notIn: ["CONVERTED", "LOST", "STUDY_DONE"] },
    OR: [{ nextActionAt: { lte: now } }, { status: { in: ["NEW", "PENDING_CONTACT"] }, lastContactAt: null, nextActionAt: null }],
  };
}

export async function listContacts(filters: ContactFilters = {}) {
  const and: Prisma.LeadWhereInput[] = [];
  if (filters.demo !== "1") and.push({ isDemo: false });
  if (filters.q) {
    const q = filters.q.trim();
    const digits = q.replace(/\D/g, "");
    and.push({ OR: [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, ...(digits.length >= 6 ? [{ phoneNormalized: { contains: digits.slice(-9) } }] : [])] });
  }
  if (filters.municipality) {
    const m = filters.municipality.trim();
    and.push({ OR: [{ property: { locationOther: { contains: m } } }, { studies: { some: { municipalityName: { contains: m } } } }] });
  }
  if (filters.interest) and.push({ OR: [{ primaryInterest: filters.interest }, { requests: { some: { interest: filters.interest } } }] });
  if (filters.status) and.push({ status: filters.status });
  if (filters.followUp === "1") and.push(followUpWhere());
  return prisma.lead.findMany({
    where: { AND: and },
    orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: {
      property: true,
      studies: { select: { id: true, municipalityName: true }, orderBy: { createdAt: "desc" }, take: 1 },
      requests: { select: { createdAt: true, interest: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    take: 500,
  });
}

export async function countFollowUp() {
  return prisma.lead.count({ where: { AND: [{ isDemo: false }, followUpWhere()] } });
}

export async function getContactCrm(leadId: string) {
  return prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      requests: { orderBy: { createdAt: "desc" }, include: { study: { select: { id: true, municipalityName: true, postalCode: true, saleEstimate: true, rentEstimate: true } } } },
      studies: { select: { id: true, createdAt: true, municipalityName: true, provinceCode: true }, orderBy: { createdAt: "desc" } },
      assignments: { orderBy: { createdAt: "desc" }, include: { agency: { select: { id: true, name: true } } } },
      revenues: { orderBy: { date: "desc" } },
    },
  });
}

// ---------------------------------------------------------------- Estados
export async function changeStatus(leadId: string, status: string) {
  const stages = await getStages();
  if (!stages.some((s) => s.code === status)) throw new Error("Estado no válido");
  return updateLeadStatus(leadId, status, { by: "admin" });
}

// ---------------------------------------------------------------- Seguimiento
export async function setNextAction(leadId: string, action: string, dueAt: Date | null) {
  await prisma.lead.update({ where: { id: leadId }, data: { nextAction: action || null, nextActionAt: dueAt } });
  await emitBusinessEvent("NEXT_ACTION_SET", {
    leadId,
    payload: { action, dueAt: dueAt?.toISOString() ?? null, dueLabel: dueAt ? dueAt.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }) : "sin fecha" },
  });
}

/** Registra una comunicación hecha a mano (llamada, email, reunión…). */
export async function logContact(leadId: string, channel: keyof typeof CONTACT_CHANNELS, summary: string, at = new Date()) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  // La acción pendiente ya vencida se da por realizada: el contacto sale de «requiere seguimiento»
  const done = lead.nextActionAt != null && lead.nextActionAt <= at;
  await prisma.lead.update({ where: { id: leadId }, data: { lastContactAt: at, ...(done ? { nextActionAt: null } : {}) } });
  await emitBusinessEvent("CONTACT_LOGGED", { leadId, createdAt: at, payload: { channel, channelLabel: CONTACT_CHANNELS[channel], summary: summary.slice(0, 500) } });
  // Primera gestión realizada: el contacto pasa a «Contactado» si aún estaba por contactar
  if (["NEW", "PENDING_CONTACT", "STUDY_DONE"].includes(lead.status)) await updateLeadStatus(leadId, "CONTACTED", { by: "admin" });
}

export async function updatePreferences(leadId: string, data: { preferredContact: string; contactWindow: string | null; revokeMarketing: boolean; revokePartnerShare: boolean }) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { consent: true } });
  await prisma.lead.update({
    where: { id: leadId },
    data: { preferredContact: data.preferredContact, contactWindow: data.contactWindow, ...(data.revokePartnerShare ? { partnerShareConsent: false } : {}) },
  });
  // El equipo solo puede retirar consentimientos (a petición del propietario), nunca otorgarlos.
  if (data.revokeMarketing && lead.consent?.consentMarketing) {
    await prisma.consent.update({ where: { leadId }, data: { consentMarketing: false, consentTimestamp: new Date() } });
  }
  await emitBusinessEvent("CONTACT_DETAILS_UPDATED", {
    leadId,
    payload: { preferredContact: data.preferredContact, contactWindow: data.contactWindow, revokedMarketing: data.revokeMarketing, revokedPartnerShare: data.revokePartnerShare },
  });
}

// ---------------------------------------------------------------- Colaboradores
export async function assignPartner(leadId: string, agencyId: string, serviceCode: string | null) {
  const [lead, agency] = await Promise.all([prisma.lead.findUniqueOrThrow({ where: { id: leadId } }), prisma.agency.findUniqueOrThrow({ where: { id: agencyId } })]);
  if (!lead.partnerShareConsent) throw new Error("El propietario no ha autorizado comunicar sus datos a colaboradores.");
  if (agency.status !== "ACTIVE") throw new Error("El colaborador no está activo.");
  const a = await prisma.partnerAssignment.create({ data: { leadId, agencyId, serviceCode } });
  await prisma.lead.update({ where: { id: leadId }, data: { agencyId, assignedAt: new Date() } });
  await emitBusinessEvent("PARTNER_ASSIGNED", {
    leadId,
    payload: { assignmentId: a.id, partnerName: agency.name, service: serviceCode ? INTEREST_LABELS[serviceCode] : null, statusLabel: ASSIGNMENT_STATUS_LABELS.ASSIGNED },
  });
  return a;
}

export async function updateAssignment(id: string, status: string, result: string) {
  if (!ASSIGNMENT_STATUS_LABELS[status]) throw new Error("Estado no válido");
  const a = await prisma.partnerAssignment.update({
    where: { id },
    data: { status, result: result || null, closedAt: ["WON", "LOST", "REJECTED"].includes(status) ? new Date() : null },
    include: { agency: true },
  });
  await emitBusinessEvent("PARTNER_UPDATED", { leadId: a.leadId, payload: { assignmentId: id, partnerName: a.agency.name, statusLabel: ASSIGNMENT_STATUS_LABELS[status], result } });
  return a;
}

// ---------------------------------------------------------------- Ingresos (reales, introducidos a mano)
export async function addRevenue(data: { leadId: string | null; agencyId: string | null; serviceCode: string | null; amount: number; date: Date; description: string }) {
  if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error("Importe no válido");
  const r = await prisma.revenue.create({ data });
  if (data.leadId) await emitBusinessEvent("REVENUE_RECORDED", { leadId: data.leadId, payload: { revenueId: r.id, amount: data.amount, description: data.description } });
  return r;
}

// ---------------------------------------------------------------- Derechos de los propietarios (RGPD)
/** Todos los datos personales de un contacto (derecho de acceso y portabilidad). */
export async function exportContactData(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      property: true,
      consent: true,
      notes: true,
      appointments: true,
      requests: true,
      assignments: { include: { agency: { select: { name: true } } } },
      revenues: true,
      events: { where: { category: "BUSINESS" }, select: { createdAt: true, type: true } },
      studies: { select: { id: true, createdAt: true, input: true, contactName: true, contactEmail: true, contactPhone: true } },
      conversations: { include: { messages: { select: { createdAt: true, role: true, content: true } } } },
    },
  });
  if (!lead) return null;
  await emitBusinessEvent("DATA_EXPORTED", { leadId, payload: {} });
  return { exportedAt: new Date().toISOString(), controller: "FINCALIA360", contact: lead };
}

/**
 * Supresión (derecho al olvido): se eliminan los datos personales y el contenido libre, y se
 * conservan solo registros anónimos (fechas, estados, importes) para la contabilidad y las estadísticas.
 */
export async function eraseContact(leadId: string) {
  const anon = `suprimido-${leadId}@anonimo.invalid`;
  await prisma.$transaction([
    prisma.note.deleteMany({ where: { leadId } }),
    prisma.conversation.deleteMany({ where: { leadId } }),
    prisma.serviceRequest.updateMany({ where: { leadId }, data: { comments: null, consentText: "[suprimido a petición del interesado]" } }),
    prisma.consent.deleteMany({ where: { leadId } }),
    prisma.appointment.updateMany({ where: { leadId }, data: { notes: null } }),
    prisma.partnerAssignment.updateMany({ where: { leadId }, data: { result: null } }),
    prisma.study.updateMany({
      where: { leadId },
      data: { contactName: null, contactEmail: null, contactPhone: null, comments: null, preferredContact: null },
    }),
    prisma.event.deleteMany({ where: { leadId, category: "ANALYTICS" } }),
    prisma.lead.update({
      where: { id: leadId },
      data: {
        name: "Contacto suprimido",
        email: anon,
        emailNormalized: anon,
        phone: null,
        phoneNormalized: null,
        motivationText: null,
        nextAction: null,
        nextActionAt: null,
        status: "LOST",
        lostReason: "Datos suprimidos a petición del interesado",
        partnerShareConsent: false,
      },
    }),
  ]);
  // Las direcciones exactas de los estudios asociados también se eliminan
  const studies = await prisma.study.findMany({ where: { leadId }, select: { id: true, input: true } });
  for (const s of studies) {
    const input = JSON.parse(s.input);
    if (input?.location) {
      input.location.address = null;
      input.location.cadastralRef = null;
    }
    await prisma.study.update({ where: { id: s.id }, data: { input: JSON.stringify(input) } });
  }
  await emitBusinessEvent("DATA_ERASED", { leadId, payload: {} });
}
