// Citas: huecos DEMO, reserva y asignación a inmobiliaria.
// TODO: integrar calendario real (Google Calendar / Cal.com / Calendly) — ver docs/integrations.md
import { prisma } from "@/db/client";
import { LOCATION_LABELS } from "@/lib/labels";
import type { AppointmentStatus, Slot } from "@/types";
import { assignLeadToAgency } from "./agencyService";
import { trackEvent } from "./analyticsService";
import { refreshScore, computeNextAction } from "./leadService";
import { emitBusinessEvent } from "./notificationService";

/** Horarios ficticios de demo: hoy por la tarde, mañana y pasado mañana. */
const SLOT_TEMPLATE: Array<{ offset: number; times: string[] }> = [
  { offset: 0, times: ["18:30", "19:00", "19:30"] },
  { offset: 1, times: ["09:30", "10:00", "11:00", "17:30"] },
  { offset: 2, times: ["10:00", "12:00", "18:00"] },
];

export async function getAvailableSlots(now = new Date()): Promise<Slot[]> {
  const minStart = new Date(now.getTime() + 20 * 60 * 1000);
  const candidates: Slot[] = [];
  for (const day of SLOT_TEMPLATE) {
    for (const time of day.times) {
      const [h, m] = time.split(":").map(Number);
      const date = new Date(now);
      date.setDate(date.getDate() + day.offset);
      date.setHours(h, m, 0, 0);
      if (date < minStart) continue;
      candidates.push({ iso: date.toISOString(), dayKey: day.offset === 0 ? "today" : day.offset === 1 ? "tomorrow" : "later", label: time });
    }
  }
  if (!candidates.length) return [];
  const taken = await prisma.appointment.findMany({
    where: {
      status: { in: ["BOOKED", "REQUESTED"] },
      scheduledAt: { gte: new Date(candidates[0].iso), lte: new Date(candidates[candidates.length - 1].iso) },
    },
    select: { scheduledAt: true },
  });
  // En la demo, un hueco admite hasta 2 llamadas simultáneas (2 especialistas).
  const counts = new Map<string, number>();
  for (const a of taken) counts.set(a.scheduledAt.toISOString(), (counts.get(a.scheduledAt.toISOString()) ?? 0) + 1);
  return candidates.filter((s) => (counts.get(s.iso) ?? 0) < 2);
}

export interface BookOptions {
  source?: "WEB_FORM" | "AGENT" | "ADMIN" | "SIMULATION";
  status?: AppointmentStatus;
  notes?: string;
  createdAt?: Date;
  track?: boolean;
}

export async function bookAppointment(leadId: string, scheduledAt: Date, options: BookOptions = {}) {
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Fecha de cita no válida");
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { property: true } });

  // 1) Asignación a la inmobiliaria más adecuada (si aún no tiene).
  const agency = lead.agencyId
    ? await prisma.agency.findUnique({ where: { id: lead.agencyId } })
    : await assignLeadToAgency(leadId).catch(() => null);

  const status = options.status ?? "BOOKED";
  const appointment = await prisma.appointment.create({
    data: {
      leadId,
      agencyId: agency?.id ?? null,
      scheduledAt,
      status,
      channel: "PHONE",
      source: options.source ?? "WEB_FORM",
      notes: options.notes,
      createdAt: options.createdAt,
    },
  });

  // 2) Estado del lead.
  const newStatus = ["CONVERTED"].includes(lead.status) ? lead.status : status === "BOOKED" ? "APPOINTMENT" : lead.status;
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: newStatus,
      appointmentInterest: true,
      qualifiedAt: lead.qualifiedAt ?? new Date(),
      nextAction:
        status === "REQUESTED"
          ? "Confirmar la cita sugerida con el propietario"
          : computeNextAction({ status: newStatus, scoreTier: lead.scoreTier }),
    },
  });

  // 3) Eventos y notificaciones (demo).
  const when = scheduledAt.toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  if (status === "BOOKED") {
    await emitBusinessEvent("APPOINTMENT_BOOKED", {
      leadId,
      createdAt: options.createdAt,
      payload: { appointmentId: appointment.id, scheduledAt: scheduledAt.toISOString(), source: appointment.source, agencyName: agency?.name },
      notification: {
        audience: "agency",
        to: agency?.email,
        subject: `Cita reservada con ${lead.name} — ${when}`,
        body: `Propiedad en ${LOCATION_LABELS[lead.property?.location as keyof typeof LOCATION_LABELS] ?? "—"}. Score ${lead.score}.`,
      },
    });
    if (options.track !== false) await trackEvent("appointment_booked", { leadId, createdAt: options.createdAt });
  }

  await refreshScore(leadId);
  return { appointment, agency };
}

/** Crea una cita desde el CRM en el primer hueco libre. */
export async function createAppointmentFromAdmin(leadId: string) {
  const [slot] = await getAvailableSlots();
  const date = slot ? new Date(slot.iso) : new Date(Date.now() + 24 * 3600 * 1000);
  return bookAppointment(leadId, date, { source: "ADMIN" });
}

export async function listAppointments(scope: "upcoming" | "past" | "all" = "all") {
  const now = new Date();
  return prisma.appointment.findMany({
    where: scope === "upcoming" ? { scheduledAt: { gte: now } } : scope === "past" ? { scheduledAt: { lt: now } } : {},
    orderBy: { scheduledAt: scope === "past" ? "desc" : "asc" },
    include: {
      lead: { select: { id: true, name: true, phone: true, language: true, scoreTier: true, score: true, property: true } },
      agency: { select: { id: true, name: true } },
    },
  });
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  let appointment = await prisma.appointment.update({ where: { id }, data: { status } });
  if (status === "BOOKED") {
    if (!appointment.agencyId) {
      const agency = await assignLeadToAgency(appointment.leadId).catch(() => null);
      if (agency) appointment = await prisma.appointment.update({ where: { id }, data: { agencyId: agency.id } });
    }
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: appointment.leadId } });
    if (!["APPOINTMENT", "CONVERTED"].includes(lead.status)) {
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "APPOINTMENT" } });
    }
    await emitBusinessEvent("APPOINTMENT_BOOKED", {
      leadId: appointment.leadId,
      payload: { appointmentId: id, confirmedFromCrm: true },
    });
    await trackEvent("appointment_booked", { leadId: appointment.leadId });
  }
  return appointment;
}
