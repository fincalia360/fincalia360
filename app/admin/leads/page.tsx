import Link from "next/link";
import { Flame, Plus } from "lucide-react";
import { createDemoLeadAction, simulateHotLeadAction } from "@/app/admin/actions";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge, STATUS_TONES, TIER_TONES } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  INTENT_LABELS,
  LANGUAGE_NAMES,
  LOCATION_LABELS,
  PROPERTY_LABELS,
  STATUS_LABELS,
  TIER_LABELS,
  TIMELINE_LABELS,
  label,
} from "@/lib/labels";
import { formatDate, formatEUR } from "@/lib/utils";
import { listLeads } from "@/services/leadService";
import { LANGUAGES, LEAD_STATUSES, SCORE_TIERS } from "@/types";

export const metadata = { title: "Leads" };

type Search = { status?: string; tier?: string; language?: string; q?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const filters = await searchParams;
  const leads = await listLeads(filters);
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Propietarios que han solicitado valoración con consentimiento de contacto."
        actions={
          <>
            <form action={createDemoLeadAction}>
              <SubmitButton variant="outline" pendingLabel="Creando…">
                <Plus className="h-4 w-4" /> Crear lead demo
              </SubmitButton>
            </form>
            <form action={simulateHotLeadAction}>
              <SubmitButton variant="accent" pendingLabel="Simulando…">
                <Flame className="h-4 w-4" /> Simular lead caliente
              </SubmitButton>
            </form>
          </>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        <input name="q" defaultValue={filters.q} placeholder="Buscar nombre o email" className="field h-10 w-full py-2 sm:w-56" />
        <select name="status" defaultValue={filters.status ?? ""} className="field h-10 w-auto py-2">
          <option value="">Todos los estados</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select name="tier" defaultValue={filters.tier ?? ""} className="field h-10 w-auto py-2">
          <option value="">Todos los scores</option>
          {SCORE_TIERS.map((s) => (
            <option key={s} value={s}>{TIER_LABELS[s]}</option>
          ))}
        </select>
        <select name="language" defaultValue={filters.language ?? ""} className="field h-10 w-auto py-2">
          <option value="">Todos los idiomas</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{LANGUAGE_NAMES[l]}</option>
          ))}
        </select>
        <button className={buttonClasses({ variant: "primary", size: "md", className: "rounded-lg" })}>Filtrar</button>
        {hasFilters && (
          <Link href="/admin/leads" className={buttonClasses({ variant: "ghost", size: "md" })}>
            Limpiar
          </Link>
        )}
        <span className="ml-auto text-sm text-ink-400">{leads.length} leads</span>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ubicación</th>
                <th>Idioma</th>
                <th>Propiedad</th>
                <th>Intención</th>
                <th>Plazo</th>
                <th className="text-right">Valor estimado</th>
                <th className="text-right">Score</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Próxima acción</th>
                <th>Inmobiliaria</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-sand-50">
                  <td>
                    <Link href={`/admin/leads/${lead.id}`} className="font-medium text-ink-800 hover:text-terracotta-600">
                      {lead.name}
                    </Link>
                  </td>
                  <td>{label(LOCATION_LABELS, lead.property?.location)}</td>
                  <td className="uppercase text-ink-500">{lead.language}</td>
                  <td>{label(PROPERTY_LABELS, lead.property?.type)}</td>
                  <td>{label(INTENT_LABELS, lead.intent)}</td>
                  <td className="text-ink-500">{label(TIMELINE_LABELS, lead.timeline)}</td>
                  <td className="text-right tabular-nums">{formatEUR(lead.estimatedValue)}</td>
                  <td className="text-right">
                    <span className="mr-2 font-semibold tabular-nums">{lead.score}</span>
                    <Badge tone={TIER_TONES[lead.scoreTier]}>{label(TIER_LABELS, lead.scoreTier)}</Badge>
                  </td>
                  <td>
                    <Badge tone={STATUS_TONES[lead.status]}>{label(STATUS_LABELS, lead.status)}</Badge>
                  </td>
                  <td className="tabular-nums text-ink-500">{formatDate(lead.createdAt)}</td>
                  <td className="max-w-[220px] truncate text-ink-600" title={lead.nextAction ?? ""}>
                    {lead.nextAction ?? "—"}
                  </td>
                  <td className="text-ink-500">{lead.agency?.name ?? "—"}</td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-ink-400">
                    No hay leads con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
