import { demoToolsEnabled } from "@/lib/demo";
import Link from "next/link";
import { Flame, Plus } from "lucide-react";
import { createDemoLeadAction, simulateHotLeadAction } from "@/app/admin/actions";
import { BarChart, Funnel } from "@/components/admin/Charts";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Timeline } from "@/components/admin/Timeline";
import { Badge, DemoBadge, STATUS_TONES, TIER_TONES } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { LOCATION_LABELS, PROPERTY_LABELS, STATUS_LABELS, TIER_LABELS, label } from "@/lib/labels";
import { formatDateTime, formatEUR, formatPercent } from "@/lib/utils";
import { getDashboardData } from "@/services/dashboardService";
import { getSettings } from "@/services/settingsService";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const [data, settings, params] = await Promise.all([getDashboardData(), getSettings(), searchParams]);
  const m = data.metrics;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Captación y cualificación de propietarios de toda España. Todas las cifras proceden de la base de datos local."
        actions={
          demoToolsEnabled() && (
          <>
            <form action={createDemoLeadAction}>
              <SubmitButton variant="outline" size="md" pendingLabel="Creando…">
                <Plus className="h-4 w-4" /> Crear lead demo
              </SubmitButton>
            </form>
            <form action={simulateHotLeadAction}>
              <SubmitButton variant="accent" size="md" pendingLabel="Simulando…">
                <Flame className="h-4 w-4" /> Simular lead caliente
              </SubmitButton>
            </form>
          </>
          )
        }
      />

      {params.reset && (
        <p className="mb-5 rounded-xl border border-pine-100 bg-pine-50 px-4 py-3 text-sm text-pine-600">Datos demo restablecidos.</p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Leads totales" value={m.total} hint={`${m.fresh} sin contactar`} />
        <StatCard label="Leads nuevos" value={m.fresh} hint="Estado NEW" />
        <StatCard label="Cualificados" value={m.qualified} hint="Por agente o CRM" />
        <StatCard label="Leads calientes" value={m.hot} hint="Score ≥ 80" accent />
        <StatCard label="Citas" value={m.appointments} hint="Reservadas o realizadas" />
        <StatCard label="Conversión lead → cita" value={formatPercent(m.conversionRate)} hint={`Hipótesis: ${formatPercent(settings.leadToAppointment, 0)}`} />
        <StatCard label="Valor oportunidades" value={formatEUR(m.opportunityValue)} hint="Leads entregados a inmobiliaria" />
        <StatCard label="Pipeline total" value={formatEUR(m.pipelineValue)} hint="Valor estimado leads activos" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Leads por día" description="Últimos 14 días" />
          <CardBody>
            <BarChart
              data={data.leadsPerDay.map((d) => ({
                label: d.date.toLocaleDateString("es-ES", { day: "2-digit" }),
                title: d.date.toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
                value: d.count,
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Embudo" description="Visitantes → oportunidades" action={<DemoBadge>Visitas simuladas</DemoBadge>} />
          <CardBody>
            <Funnel steps={data.funnel} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Últimos leads" action={<Link href="/admin/leads" className="text-sm font-medium text-terracotta-600 hover:underline">Ver todos</Link>} />
          <ul className="divide-y divide-sand-100">
            {data.recentLeads.map((lead) => (
              <li key={lead.id}>
                <Link href={`/admin/leads/${lead.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-sand-50">
                  <span className="w-10 shrink-0 font-serif text-2xl tabular-nums text-ink-800">{lead.score}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink-800">{lead.name}</p>
                    <p className="truncate text-[13px] text-ink-400">
                      {label(PROPERTY_LABELS, lead.property?.type)} · {label(LOCATION_LABELS, lead.property?.location)} · {lead.language.toUpperCase()} ·{" "}
                      {formatDateTime(lead.createdAt)}
                    </p>
                  </div>
                  <div className="hidden flex-col items-end gap-1 sm:flex">
                    <Badge tone={TIER_TONES[lead.scoreTier]}>{label(TIER_LABELS, lead.scoreTier)}</Badge>
                    <Badge tone={STATUS_TONES[lead.status]}>{label(STATUS_LABELS, lead.status)}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Próximas citas" action={<Link href="/admin/appointments" className="text-sm font-medium text-terracotta-600 hover:underline">Ver</Link>} />
          <CardBody>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-ink-400">No hay citas próximas.</p>
            ) : (
              <ul className="space-y-3">
                {data.upcoming.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/admin/leads/${a.lead.id}`} className="font-medium text-ink-800 hover:underline">
                        {a.lead.name}
                      </Link>
                      <p className="truncate text-[13px] text-ink-400">{a.agency?.name ?? "Sin inmobiliaria"}</p>
                    </div>
                    <div className="text-right">
                      <p className="whitespace-nowrap tabular-nums text-ink-700">{formatDateTime(a.scheduledAt)}</p>
                      {a.status === "REQUESTED" && <Badge tone="amber">Sugerida</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Actividad reciente" description="Eventos de negocio y notificaciones (simuladas)" />
        <CardBody>
          <Timeline events={data.activity} showLead />
        </CardBody>
      </Card>
    </>
  );
}
