import { EconomicsCalculator } from "@/components/admin/EconomicsCalculator";
import { PageHeader } from "@/components/admin/PageHeader";
import { DemoBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/db/client";
import { formatPercent } from "@/lib/utils";
import { getSettings } from "@/services/settingsService";

export const metadata = { title: "Economía" };

export default async function EconomicsPage() {
  const [settings, leads, withAppointment, opportunities] = await Promise.all([
    getSettings(),
    prisma.lead.count(),
    prisma.lead.count({ where: { appointments: { some: { status: { in: ["BOOKED", "COMPLETED"] } } } } }),
    prisma.lead.count({ where: { appointments: { some: { status: { in: ["BOOKED", "COMPLETED"] } } }, agencyId: { not: null }, status: { not: "LOST" } } }),
  ]);

  return (
    <>
      <PageHeader
        title="Calculadora económica"
        description="Modelo mensual del negocio. Los valores iniciales son hipótesis del plan (1.000 € de publicidad, 300 € de herramientas, CPL 20 €, 15 % lead → cita) y deben validarse con el piloto."
        actions={<DemoBadge>Hipótesis, no resultados</DemoBadge>}
      />
      <EconomicsCalculator
        initial={{
          adBudget: settings.adBudget,
          toolsCost: settings.toolsCost,
          cpl: settings.cpl,
          leadToAppointment: settings.leadToAppointment,
          appointmentToOpportunity: settings.appointmentToOpportunity,
          pricePerAppointment: settings.pricePerAppointment,
          agencies: settings.agencies,
          monthlyFee: settings.monthlyFee,
        }}
      />
      <Card className="mt-6">
        <CardHeader title="Referencia: datos actuales del CRM local" description="Incluye leads ficticios del seed y los que crees durante la demo" />
        <CardBody className="grid gap-4 text-sm sm:grid-cols-3">
          <p>
            Conversión lead → cita: <strong className="tabular-nums">{formatPercent(leads ? withAppointment / leads : 0)}</strong>
            <span className="text-ink-400"> ({withAppointment}/{leads})</span>
          </p>
          <p>
            Conversión cita → oportunidad: <strong className="tabular-nums">{formatPercent(withAppointment ? opportunities / withAppointment : 0)}</strong>
          </p>
          <p className="text-ink-400">Las hipótesis por defecto se cambian en Configuración.</p>
        </CardBody>
      </Card>
    </>
  );
}
