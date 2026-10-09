// Métricas del dashboard. Todo se calcula desde la base de datos.
import { prisma } from "@/db/client";
import { bucketByDay } from "./analyticsService";
import { listBusinessEvents } from "./notificationService";

const ACTIVE_APPOINTMENT = ["BOOKED", "COMPLETED"];

export async function getDashboardData() {
  const since14 = new Date();
  since14.setDate(since14.getDate() - 13);
  since14.setHours(0, 0, 0, 0);

  const [
    total,
    fresh,
    qualified,
    hot,
    appointments,
    leadsWithAppointment,
    visitors,
    opportunities,
    opportunityValue,
    pipelineValue,
    recentLeadDates,
    tiers,
    recentLeads,
    upcoming,
    activity,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: "NEW" } }),
    prisma.lead.count({ where: { OR: [{ qualifiedAt: { not: null } }, { status: { in: ["QUALIFIED", "APPOINTMENT", "CONVERTED"] } }] } }),
    prisma.lead.count({ where: { scoreTier: "HOT", status: { not: "LOST" } } }),
    prisma.appointment.count({ where: { status: { in: ACTIVE_APPOINTMENT } } }),
    prisma.lead.count({ where: { appointments: { some: { status: { in: ACTIVE_APPOINTMENT } } } } }),
    prisma.event.count({ where: { category: "ANALYTICS", type: "landing_view" } }),
    prisma.lead.count({ where: { agencyId: { not: null }, status: { not: "LOST" } } }),
    prisma.lead.aggregate({ _sum: { estimatedValue: true }, where: { agencyId: { not: null }, status: { not: "LOST" } } }),
    prisma.lead.aggregate({ _sum: { estimatedValue: true }, where: { status: { not: "LOST" } } }),
    prisma.lead.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true } }),
    prisma.lead.groupBy({ by: ["scoreTier"], _count: { _all: true } }),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { property: true } }),
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: new Date() }, status: { in: ["BOOKED", "REQUESTED"] } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: { lead: { select: { id: true, name: true } }, agency: { select: { name: true } } },
    }),
    listBusinessEvents(10),
  ]);

  return {
    metrics: {
      total,
      fresh,
      qualified,
      hot,
      appointments,
      conversionRate: total ? leadsWithAppointment / total : 0,
      opportunityValue: opportunityValue._sum.estimatedValue ?? 0,
      pipelineValue: pipelineValue._sum.estimatedValue ?? 0,
    },
    funnel: [
      { label: "Visitantes", value: visitors, hint: "Eventos landing_view" },
      { label: "Leads", value: total, hint: "Formularios con consentimiento" },
      { label: "Cualificados", value: qualified, hint: "Por agente o CRM" },
      { label: "Citas", value: leadsWithAppointment, hint: "Leads con cita reservada" },
      { label: "Oportunidades", value: opportunities, hint: "Entregadas a inmobiliaria" },
    ],
    leadsPerDay: bucketByDay(
      recentLeadDates.map((l) => l.createdAt),
      14,
    ),
    tiers: Object.fromEntries(tiers.map((t) => [t.scoreTier, t._count._all])) as Record<string, number>,
    recentLeads,
    upcoming,
    activity,
  };
}
