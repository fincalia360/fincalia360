import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatMadrid } from "@/lib/dates";
import { requireAgency } from "@/services/agency/auth";
import { VISIT_STATUSES, listVisits } from "@/services/agency/crm";
import { visitStatusAction } from "../actions";

export const metadata = { title: "Visitas" };

const P = "/zona-inmobiliarias/panel";

export default async function VisitsPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const s = await requireAgency();
  const past = (await searchParams).ver === "pasadas";
  const visits = await listVisits(s, past ? "past" : "upcoming");
  const pill = (on: boolean) => (on ? "rounded-full bg-ink-800 px-3 py-1.5 text-[13px] text-white" : "rounded-full bg-white px-3 py-1.5 text-[13px] text-ink-600 ring-1 ring-sand-200");
  return (
    <>
      <PageHeader title="Visitas" description="Las visitas se programan desde la ficha de cada contacto." />
      <nav className="mb-4 flex gap-1.5">
        <Link href={`${P}/visitas`} className={pill(!past)}>
          Próximas
        </Link>
        <Link href={`${P}/visitas?ver=pasadas`} className={pill(past)}>
          Pasadas y canceladas
        </Link>
      </nav>
      <Card className="overflow-x-auto">
        {visits.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-ink-400">{past ? "Sin visitas anteriores." : "No hay visitas programadas."}</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Contacto</th>
                <th>Inmueble</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium text-ink-800">{formatMadrid(v.at)}</td>
                  <td>
                    <Link href={`${P}/contactos/${v.contact.id}`} className="text-ink-800 hover:underline">
                      {v.contact.name}
                    </Link>
                  </td>
                  <td className="text-ink-600">{v.listing ? `${v.listing.reference} · ${v.listing.title}` : "—"}</td>
                  <td>
                    <Badge tone={v.status === "DONE" ? "green" : v.status === "CANCELLED" ? "neutral" : "terracotta"}>{VISIT_STATUSES[v.status as keyof typeof VISIT_STATUSES]}</Badge>
                  </td>
                  <td>
                    {v.status === "SCHEDULED" && (
                      <div className="flex gap-3 text-[13px]">
                        <form action={visitStatusAction.bind(null, v.id, "DONE")}>
                          <button className="font-medium text-pine-600 hover:underline">Realizada</button>
                        </form>
                        <form action={visitStatusAction.bind(null, v.id, "CANCELLED")}>
                          <button className="font-medium text-ink-500 hover:underline">Cancelar</button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
