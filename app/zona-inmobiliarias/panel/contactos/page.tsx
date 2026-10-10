import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMadrid } from "@/lib/dates";
import { requireAgency } from "@/services/agency/auth";
import { AGENCY_STAGES, CONTACT_KINDS, CONTACT_SOURCES, listContacts, type ContactView } from "@/services/agency/crm";
import { STAGE_TONES } from "@/components/agency/tones";

export const metadata = { title: "Contactos" };

const P = "/zona-inmobiliarias/panel";
const VIEWS: [ContactView, string][] = [
  ["all", "Todos"],
  ["pending", "Pendientes"],
  ["today", "Tareas para hoy"],
  ["overdue", "Vencidos"],
  ["in_progress", "En curso"],
  ["won", "Cerrados"],
  ["lost", "Perdidos"],
];

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ vista?: string; tipo?: string; q?: string }> }) {
  const s = await requireAgency();
  const sp = await searchParams;
  const view = (VIEWS.find(([k]) => k === sp.vista)?.[0] ?? "all") as ContactView;
  const contacts = await listContacts(s, { view, kind: sp.tipo, q: sp.q });
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Contactos"
        description="Propietarios, compradores e inquilinos de tu inmobiliaria."
        actions={
          <ButtonLink href={`${P}/contactos/nuevo`} variant="accent">
            <Plus className="h-4 w-4" /> Nuevo contacto
          </ButtonLink>
        }
      />
      <nav className="mb-4 flex flex-wrap gap-1.5">
        {VIEWS.map(([k, label]) => (
          <Link
            key={k}
            href={`${P}/contactos${k === "all" ? "" : `?vista=${k}`}`}
            className={view === k ? "rounded-full bg-ink-800 px-3 py-1.5 text-[13px] text-white" : "rounded-full bg-white px-3 py-1.5 text-[13px] text-ink-600 ring-1 ring-sand-200 hover:bg-sand-50"}
          >
            {label}
          </Link>
        ))}
      </nav>
      <form className="mb-4 flex flex-wrap gap-2">
        {view !== "all" && <input type="hidden" name="vista" value={view} />}
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Nombre, email o teléfono" className="field h-10 max-w-xs py-0" />
        <select name="tipo" defaultValue={sp.tipo ?? ""} className="field h-10 w-auto py-0">
          <option value="">Todos los tipos</option>
          {Object.entries(CONTACT_KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-full bg-ink-800 px-4 text-sm text-white">Buscar</button>
      </form>

      <Card className="overflow-x-auto">
        {contacts.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-500">
            {view === "all" && !sp.q && !sp.tipo ? "Todavía no tienes contactos." : "No hay contactos con estos filtros."}
            {view === "all" && !sp.q && !sp.tipo && (
              <div className="mt-4">
                <ButtonLink href={`${P}/contactos/nuevo`} variant="outline">
                  Añadir el primero
                </ButtonLink>
              </div>
            )}
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Próxima acción</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-sand-50">
                  <td>
                    <Link href={`${P}/contactos/${c.id}`} className="font-medium text-ink-800 hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-ink-400">{[c.phone, c.email].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="text-ink-600">{CONTACT_KINDS[c.kind as keyof typeof CONTACT_KINDS] ?? c.kind}</td>
                  <td>
                    <Badge tone={STAGE_TONES[c.status] ?? "neutral"}>{AGENCY_STAGES[c.status as keyof typeof AGENCY_STAGES]?.label ?? c.status}</Badge>
                  </td>
                  <td className="max-w-xs whitespace-normal">
                    {c.nextAction ? (
                      <>
                        <p className="text-[13px] text-ink-700">{c.nextAction}</p>
                        <p className={c.nextActionAt && c.nextActionAt < now ? "text-[12px] font-medium text-red-600" : "text-[12px] text-ink-400"}>{formatMadrid(c.nextActionAt)}</p>
                      </>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="text-[13px] text-ink-500">{CONTACT_SOURCES[c.source as keyof typeof CONTACT_SOURCES] ?? c.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
