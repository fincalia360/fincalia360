import Link from "next/link";
import { BarChart } from "@/components/admin/Charts";
import { PageHeader } from "@/components/admin/PageHeader";
import { DemoBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/db/client";
import { EVENT_LABELS, LANGUAGE_NAMES, SOURCE_LABELS } from "@/lib/labels";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { getAnalyticsFunnel, getEventsPerDay } from "@/services/analyticsService";
import type { Language } from "@/types";

export const metadata = { title: "Analytics" };

const RANGES = [
  { key: "7", label: "7 días" },
  { key: "30", label: "30 días" },
  { key: "all", label: "Todo" },
];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = (await searchParams).range ?? "30";
  const since = range === "all" ? undefined : new Date(Date.now() - Number(range) * 24 * 3600 * 1000);

  const [funnel, views, created, byLanguage, bySource] = await Promise.all([
    getAnalyticsFunnel(since),
    getEventsPerDay("landing_view", 30),
    getEventsPerDay("lead_created", 30),
    prisma.lead.groupBy({ by: ["language"], _count: { _all: true }, where: since ? { createdAt: { gte: since } } : {} }),
    prisma.lead.groupBy({ by: ["source"], _count: { _all: true }, where: since ? { createdAt: { gte: since } } : {} }),
  ]);
  const max = Math.max(1, funnel[0]?.count ?? 1);
  const totalLeads = byLanguage.reduce((s, r) => s + r._count._all, 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Analítica propia (tabla Event), sin cookies de terceros. Eventos del navegador + eventos registrados por el servidor."
        actions={
          <div className="flex rounded-full border border-sand-300 bg-white p-0.5">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/admin/analytics?range=${r.key}`}
                className={cn("rounded-full px-3 py-1 text-[13px]", range === r.key ? "bg-ink-800 text-white" : "text-ink-500 hover:text-ink-800")}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      <Card>
        <CardHeader title="Conversión por evento" description="Del primer contacto con la landing a la cita reservada" action={<DemoBadge>Incluye tráfico simulado del seed</DemoBadge>} />
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Evento</th>
                <th className="w-1/3" />
                <th className="text-right">Eventos</th>
                <th className="text-right">vs. paso anterior</th>
                <th className="text-right">vs. visitas</th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((step) => (
                <tr key={step.type}>
                  <td>
                    <p className="font-medium text-ink-800">{EVENT_LABELS[step.type]}</p>
                    <p className="font-mono text-[11px] text-ink-400">{step.type}</p>
                  </td>
                  <td>
                    <div className="h-2 min-w-[120px] overflow-hidden rounded-full bg-sand-100">
                      <div className="h-full rounded-full bg-ink-700" style={{ width: `${Math.max(1, (step.count / max) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="text-right font-semibold tabular-nums">{formatNumber(step.count)}</td>
                  <td className="text-right tabular-nums text-ink-500">{step.stepRate === null ? "—" : formatPercent(step.stepRate)}</td>
                  <td className="text-right tabular-nums text-ink-500">{step.totalRate === null ? "—" : formatPercent(step.totalRate, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Visitas a la landing" description="Últimos 30 días" />
          <CardBody>
            <BarChart data={views.map((d) => ({ label: String(d.date.getDate()), title: d.date.toLocaleDateString("es-ES"), value: d.count }))} height={140} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Leads creados" description="Últimos 30 días" />
          <CardBody>
            <BarChart data={created.map((d) => ({ label: String(d.date.getDate()), title: d.date.toLocaleDateString("es-ES"), value: d.count }))} height={140} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Leads por idioma" />
          <CardBody>
            <ul className="space-y-2.5">
              {byLanguage
                .sort((a, b) => b._count._all - a._count._all)
                .map((r) => (
                  <li key={r.language} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-ink-600">{LANGUAGE_NAMES[r.language as Language] ?? r.language}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand-100">
                      <div className="h-full rounded-full bg-terracotta-500" style={{ width: `${(r._count._all / Math.max(1, totalLeads)) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums">{r._count._all}</span>
                  </li>
                ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Leads por origen" />
          <CardBody>
            <ul className="space-y-2.5">
              {bySource
                .sort((a, b) => b._count._all - a._count._all)
                .map((r) => (
                  <li key={r.source} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-ink-600">{SOURCE_LABELS[r.source] ?? r.source}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand-100">
                      <div className="h-full rounded-full bg-ink-700" style={{ width: `${(r._count._all / Math.max(1, totalLeads)) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums">{r._count._all}</span>
                  </li>
                ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
