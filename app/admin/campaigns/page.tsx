import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { DemoBadge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatEUR, formatNumber, formatPercent } from "@/lib/utils";
import { getCampaignReport } from "@/services/campaignService";
import { getSettings } from "@/services/settingsService";

export const metadata = { title: "Campañas" };

export default async function CampaignsPage() {
  const [{ rows, totals }, settings] = await Promise.all([getCampaignReport(), getSettings()]);

  return (
    <>
      <PageHeader
        title="Campañas"
        description="Simulador de canales de captación. No hay conexión con Google Ads ni Meta Ads: estas cifras son DATOS DE SIMULACIÓN para la presentación, no resultados reales."
        actions={<DemoBadge>DEMO / SIMULACIÓN</DemoBadge>}
      />

      <div className="mb-6 rounded-2xl border border-dashed border-terracotta-400 bg-terracotta-50 px-5 py-4 text-sm leading-relaxed text-terracotta-700">
        <strong>Datos simulados.</strong> Las métricas de esta página se generan en el seed para ilustrar el cuadro de mando. La hipótesis
        de partida configurada es CPL {formatEUR(settings.cpl)} y conversión lead → cita {formatPercent(settings.leadToAppointment, 0)}
        ; ambas deben validarse en el piloto.
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Inversión (sim.)" value={formatEUR(totals.spend)} />
        <StatCard label="Leads (sim.)" value={formatNumber(totals.leads)} hint={`${totals.crmLeads} leads en CRM con origen de campaña`} />
        <StatCard label="CPL (sim.)" value={formatEUR(totals.cpl)} hint={`Hipótesis: ${formatEUR(settings.cpl)}`} />
        <StatCard label="Coste por cita (sim.)" value={formatEUR(totals.costPerAppointment)} hint={`${totals.appointments} citas`} />
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Rendimiento por canal" description="Simulación · últimos 30 días" action={<DemoBadge />} />
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Canal</th>
                <th>Campaña</th>
                <th className="text-right">Impresiones</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">CTR</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Inversión</th>
                <th className="text-right">CPL</th>
                <th className="text-right">Citas</th>
                <th className="text-right">Lead → cita</th>
                <th className="text-right">Coste por cita</th>
                <th className="text-right">Leads en CRM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.label}</td>
                  <td className="max-w-[240px] truncate text-ink-500" title={r.name}>{r.name}</td>
                  <td className="text-right tabular-nums">{formatNumber(r.impressions)}</td>
                  <td className="text-right tabular-nums">{formatNumber(r.clicks)}</td>
                  <td className="text-right tabular-nums">{r.ctr === null ? "—" : formatPercent(r.ctr)}</td>
                  <td className="text-right tabular-nums">{r.leads}</td>
                  <td className="text-right tabular-nums">{formatEUR(r.spend)}</td>
                  <td className="text-right tabular-nums">{formatEUR(r.cpl)}</td>
                  <td className="text-right tabular-nums">{r.appointments}</td>
                  <td className="text-right tabular-nums">{r.leadToAppointment === null ? "—" : formatPercent(r.leadToAppointment)}</td>
                  <td className="text-right tabular-nums">{formatEUR(r.costPerAppointment)}</td>
                  <td className="text-right tabular-nums text-ink-500">{r.crmLeads}</td>
                </tr>
              ))}
              <tr className="bg-sand-50 font-semibold">
                <td>Total</td>
                <td />
                <td className="text-right tabular-nums">{formatNumber(totals.impressions)}</td>
                <td className="text-right tabular-nums">{formatNumber(totals.clicks)}</td>
                <td className="text-right tabular-nums">{totals.ctr === null ? "—" : formatPercent(totals.ctr)}</td>
                <td className="text-right tabular-nums">{totals.leads}</td>
                <td className="text-right tabular-nums">{formatEUR(totals.spend)}</td>
                <td className="text-right tabular-nums">{formatEUR(totals.cpl)}</td>
                <td className="text-right tabular-nums">{totals.appointments}</td>
                <td className="text-right tabular-nums">{totals.leadToAppointment === null ? "—" : formatPercent(totals.leadToAppointment)}</td>
                <td className="text-right tabular-nums">{formatEUR(totals.costPerAppointment)}</td>
                <td className="text-right tabular-nums">{totals.crmLeads}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-4 text-xs text-ink-400">
        “Leads en CRM” = leads reales de la base de datos local cuyo origen es ese canal. TODO: integrar Google Ads API y Meta Marketing API (ver docs/integrations.md).
      </p>
    </>
  );
}
