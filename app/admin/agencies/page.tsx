import Link from "next/link";
import { Plus } from "lucide-react";
import { toggleAgencyStatusAction } from "@/app/admin/actions";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LOCATION_LABELS, PROPERTY_LABELS, label } from "@/lib/labels";
import { csv, formatEUR } from "@/lib/utils";
import { listAgencies } from "@/services/agencyService";

export const metadata = { title: "Inmobiliarias" };

export default async function AgenciesPage() {
  const agencies = await listAgencies();
  return (
    <>
      <PageHeader
        title="Inmobiliarias"
        description="Agencias colaboradoras que reciben las oportunidades. assignLeadToAgency() elige por zona, tipo de propiedad, idioma y estado."
        actions={
          <>
            <DemoBadge>Agencias ficticias</DemoBadge>
            <ButtonLink href="/admin/agencies/new">
              <Plus className="h-4 w-4" /> Nueva inmobiliaria
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
              <Badge tone={a.status === "ACTIVE" ? "green" : "neutral"}>{a.status}</Badge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[12px] text-ink-400">Zonas</dt>
                <dd className="text-ink-700">{csv(a.zones).map((z) => (z === "COSTA_BRAVA" ? "Toda la Costa Brava" : label(LOCATION_LABELS, z))).join(", ")}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-400">Idiomas</dt>
                <dd className="uppercase text-ink-700">{csv(a.languages).join(" · ")}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-400">Tipos</dt>
                <dd className="text-ink-700">{csv(a.propertyTypes).map((t) => label(PROPERTY_LABELS, t)).join(", ")}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-400">Precio</dt>
                <dd className="text-ink-700">
                  {formatEUR(a.monthlyFee)}/mes · {formatEUR(a.pricePerAppointment)}/cita
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-sand-100 pt-4">
              <p className="text-sm text-ink-500">
                <span className="font-serif text-2xl text-ink-800">{a._count.leads}</span> leads recibidos · {a._count.appointments} citas
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
