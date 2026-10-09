// Campañas: métricas de SIMULACIÓN. No hay conexión con Google Ads ni Meta Ads.
// TODO: integrate Google Ads API / Meta Marketing API (ver docs/integrations.md)
import { prisma } from "@/db/client";

export const CHANNEL_LABELS: Record<string, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  SEO: "SEO",
  PARTNERS: "Partners",
};

export async function getCampaignReport() {
  const [campaigns, attributed] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { spend: "desc" } }),
    prisma.lead.groupBy({ by: ["source"], _count: { _all: true } }),
  ]);
  const attributedBySource = Object.fromEntries(attributed.map((a) => [a.source, a._count._all])) as Record<string, number>;

  const rows = campaigns.map((c) => ({
    ...c,
    label: CHANNEL_LABELS[c.channel] ?? c.channel,
    ctr: c.impressions ? c.clicks / c.impressions : null,
    cpl: c.leads ? c.spend / c.leads : null,
    leadToAppointment: c.leads ? c.appointments / c.leads : null,
    costPerAppointment: c.appointments ? c.spend / c.appointments : null,
    crmLeads: attributedBySource[c.channel] ?? 0,
  }));

  const totals = rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      leads: acc.leads + r.leads,
      spend: acc.spend + r.spend,
      appointments: acc.appointments + r.appointments,
      crmLeads: acc.crmLeads + r.crmLeads,
    }),
    { impressions: 0, clicks: 0, leads: 0, spend: 0, appointments: 0, crmLeads: 0 },
  );

  return {
    rows,
    totals: {
      ...totals,
      ctr: totals.impressions ? totals.clicks / totals.impressions : null,
      cpl: totals.leads ? totals.spend / totals.leads : null,
      leadToAppointment: totals.leads ? totals.appointments / totals.leads : null,
      costPerAppointment: totals.appointments ? totals.spend / totals.appointments : null,
    },
  };
}
