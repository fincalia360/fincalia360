import Link from "next/link";
import { AlertTriangle, Flame, Plus } from "lucide-react";
import { createDemoLeadAction, simulateHotLeadAction } from "@/app/admin/actions";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge, STATUS_TONES } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMadrid } from "@/lib/dates";
import { demoToolsEnabled } from "@/lib/demo";
import { INTEREST_LABELS, LOCATION_LABELS, label } from "@/lib/labels";
import { cn, formatDate, formatEUR } from "@/lib/utils";
import { getStages } from "@/services/crm/catalog";
import { countFollowUp, listContacts, type ContactFilters } from "@/services/crm/contacts";

export const metadata = { title: "Contactos" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<ContactFilters> }) {
  const filters = await searchParams;
  const [contacts, stages, followUp] = await Promise.all([listContacts(filters), getStages({ includeInactive: true }), countFollowUp()]);
  const stageLabel = Object.fromEntries(stages.map((s) => [s.code, s.label]));
  const hasFilters = Object.values(filters).some(Boolean);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Contactos"
        description="Propietarios que han pedido ayuda o su informe. Un contacto por persona; cada solicitud queda en su ficha."
        actions={
          demoToolsEnabled() && (
            <>
              <form action={createDemoLeadAction}>
                <SubmitButton variant="outline" pendingLabel="Creando…">
                  <Plus className="h-4 w-4" /> Crear lead demo
                </SubmitButton>
              </form>
              <form action={simulateHotLeadAction}>
                <SubmitButton variant="outline" pendingLabel="Simulando…">
                  <Flame className="h-4 w-4" /> Simular lead caliente
                </SubmitButton>
              </form>
            </>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/leads"
          className={cn("rounded-full border px-3 py-1.5 text-sm", !filters.followUp ? "border-ink-800 bg-ink-800 text-white" : "border-sand-300 text-ink-600 hover:border-ink-300")}
        >
          Todos
        </Link>
        <Link
          href="/admin/leads?followUp=1"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
            filters.followUp ? "border-red-700 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700 hover:border-red-400",
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Requieren seguimiento ({followUp})
        </Link>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        {filters.followUp && <input type="hidden" name="followUp" value="1" />}
        <input name="q" defaultValue={filters.q} placeholder="Nombre, email o teléfono" className="field h-10 w-full py-2 sm:w-56" />
        <input name="municipality" defaultValue={filters.municipality} placeholder="Municipio" className="field h-10 w-full py-2 sm:w-40" />
        <select name="interest" defaultValue={filters.interest ?? ""} className="field h-10 w-auto py-2">
          <option value="">Cualquier interés</option>
          {Object.entries(INTEREST_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status ?? ""} className="field h-10 w-auto py-2">
          <option value="">Todos los estados</option>
          {stages.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
        {demoToolsEnabled() && (
          <label className="flex h-10 items-center gap-1.5 text-sm text-ink-500">
            <input type="checkbox" name="demo" value="1" defaultChecked={filters.demo === "1"} /> Incluir datos demo
          </label>
        )}
        <button className={buttonClasses({ variant: "primary", size: "md", className: "rounded-lg" })}>Filtrar</button>
        {hasFilters && (
          <Link href="/admin/leads" className={buttonClasses({ variant: "ghost", size: "md" })}>
            Limpiar
          </Link>
        )}
        <span className="ml-auto text-sm text-ink-400">{contacts.length} contactos</span>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Municipio</th>
                <th>Interés</th>
                <th>Estado</th>
                <th>Última solicitud</th>
                <th>Último contacto</th>
                <th>Próxima acción</th>
                <th className="text-right">Valor estimado</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const overdue = c.nextActionAt != null && c.nextActionAt <= now && !["CONVERTED", "LOST"].includes(c.status);
                const municipality = c.studies[0]?.municipalityName ?? c.property?.locationOther ?? label(LOCATION_LABELS, c.property?.location);
                return (
                  <tr key={c.id} className="hover:bg-sand-50">
                    <td>
                      <Link href={`/admin/leads/${c.id}`} className="font-medium text-ink-800 hover:text-terracotta-600">
                        {c.name}
                      </Link>
                      <span className="block text-xs text-ink-400">{c.email}</span>
                      {c.isDemo && <span className="text-[10px] font-semibold uppercase text-amber-700">Demo</span>}
                    </td>
                    <td>{municipality}</td>
                    <td>{c.primaryInterest ? INTEREST_LABELS[c.primaryInterest] : "—"}</td>
                    <td>
                      <Badge tone={STATUS_TONES[c.status] ?? "neutral"}>{stageLabel[c.status] ?? c.status}</Badge>
                    </td>
                    <td className="tabular-nums text-ink-500">{formatDate(c.requests[0]?.createdAt ?? c.createdAt)}</td>
                    <td className="tabular-nums text-ink-500">{c.lastContactAt ? formatDate(c.lastContactAt) : "—"}</td>
                    <td className={cn("max-w-[260px] whitespace-normal", overdue ? "font-medium text-red-700" : "text-ink-600")}>
                      {overdue && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}
                      {c.nextAction ?? "—"}
                      {c.nextActionAt && <span className="block text-xs">{formatMadrid(c.nextActionAt)}</span>}
                    </td>
                    <td className="text-right tabular-nums">{formatEUR(c.estimatedValue)}</td>
                  </tr>
                );
              })}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-ink-400">
                    {hasFilters ? "No hay contactos con estos filtros." : "Todavía no hay contactos: aparecerán cuando un propietario pida ayuda o su informe desde su estudio."}
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
