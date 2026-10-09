import Link from "next/link";
import { Plus } from "lucide-react";
import { toggleAgencyStatusAction } from "@/app/admin/actions";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { INTEREST_LABELS, LOCATION_LABELS, label } from "@/lib/labels";
import { csv } from "@/lib/utils";
import { getProvince } from "@/services/study/geo";
import { listAgencies } from "@/services/agencyService";

export const metadata = { title: "Inmobiliarias" };

export default async function AgenciesPage() {
  const agencies = await listAgencies();
  return (
    <>
      <PageHeader
        title="Colaboradores"
        description="Inmobiliarias y profesionales que pueden recibir oportunidades, solo de propietarios que hayan autorizado comunicar sus datos."
        actions={
          <>
            <DemoBadge>Agencias ficticias</DemoBadge>
            <ButtonLink href="/admin/agencies/new">
              <Plus className="h-4 w-4" /> Nuevo colaborador
            </ButtonLink>
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {agencies.map((a) => (
          <Card key={a.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/agencies/${a.id}`} className="font-serif text-2xl text-ink-800 hover:text-terracotta-600">
                  {a.name}
                </Link>
                <p className="mt-0.5 truncate text-[13px] text-ink-400">
                  {a.email} · {a.phone}
                </p>
              </div>
              <Badge tone={a.status === "ACTIVE" ? "green" : a.status === "PROSPECT" ? "amber" : "neutral"}>{{ PROSPECT: "En conversaciones", ACTIVE: "Activa", PAUSED: "Pausada", ENDED: "Finalizada" }[a.status] ?? a.status}</Badge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[12px] text-ink-400">Provincias</dt>
                <dd className="text-ink-700">
                  {csv(a.provinces).length ? csv(a.provinces).map((c) => getProvince(c)?.name ?? c).join(", ") : csv(a.zones).length ? `Costa Brava (${csv(a.zones).map((z) => label(LOCATION_LABELS, z)).join(", ")})` : "Toda España"}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-400">Idiomas</dt>
                <dd className="uppercase text-ink-700">{csv(a.languages).join(" · ")}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-400">Servicios</dt>
                <dd className="text-ink-700">{csv(a.services).map((t) => INTEREST_LABELS[t] ?? t).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-400">Condiciones</dt>
                <dd className="line-clamp-2 text-ink-700">{a.agreementTerms || "Sin condiciones registradas"}</dd>
              </div>
            </dl>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-sand-100 pt-4">
              <p className="text-sm text-ink-500">
                <span className="font-serif text-2xl text-ink-800">{a._count.assignments}</span> oportunidades asignadas
              </p>
              <form action={toggleAgencyStatusAction.bind(null, a.id, a.status === "ACTIVE" ? "PAUSED" : "ACTIVE")}>
                <SubmitButton size="sm" variant="outline">{a.status === "ACTIVE" ? "Pausar" : "Activar"}</SubmitButton>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
