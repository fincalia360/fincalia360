import Link from "next/link";
import { AlertCircle, CalendarDays, Clock } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { formatMadrid } from "@/lib/dates";
import { requireAgency } from "@/services/agency/auth";
import { agencyDashboard } from "@/services/agency/crm";
import { LISTING_STATUSES } from "@/services/listings/catalog";

export const metadata = { title: "Inicio" };

const P = "/zona-inmobiliarias/panel";

export default async function AgencyHomePage() {
  const s = await requireAgency();
  const d = await agencyDashboard(s);
  const listingSummary = (["PUBLISHED", "RESERVED", "REVIEW", "DRAFT"] as const).filter((k) => d.listings[k]).map((k) => `${d.listings[k]} ${LISTING_STATUSES[k].toLowerCase()}`);

  return (
    <>
      <PageHeader
        title={`Hola, ${s.userName.split(" ")[0]}`}
        description={`Resumen de ${s.agencyName}. Solo tú y tu equipo veis estos datos.`}
        actions={
          <>
            <ButtonLink href={`${P}/contactos/nuevo`} variant="outline">
              Nuevo contacto
            </ButtonLink>
            <ButtonLink href={`${P}/inmuebles/nuevo`} variant="accent">
              Nuevo inmueble
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href={`${P}/contactos?vista=pending`}>
          <StatCard label="Contactos pendientes" value={d.pending} hint="Nuevos o pendientes de contactar" />
        </Link>
        <Link href={`${P}/contactos?vista=in_progress`}>
          <StatCard label="Operaciones en curso" value={d.inProgress} hint="Contactado → negociación" />
        </Link>
        <Link href={`${P}/solicitudes`}>
          <StatCard label="Solicitudes nuevas" value={d.newInquiries} hint="Desde tus anuncios" />
        </Link>
        <Link href={`${P}/contactos?vista=won`}>
          <StatCard label="Operaciones cerradas" value={d.wonTotal} hint={`${d.wonMonth} este mes`} />
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Tareas vencidas" description="Próximas acciones con la fecha pasada" />
          <TaskList items={d.overdue} empty="Nada vencido. ¡Bien!" tone="red" />
        </Card>
        <Card>
          <CardHeader title="Próximas tareas" description="Siguientes 7 días" />
          <TaskList items={d.upcomingTasks} empty="Sin tareas programadas." tone="ink" />
        </Card>
        <Card>
          <CardHeader title="Visitas programadas" action={<Link href={`${P}/visitas`} className="text-[13px] text-ink-500 hover:underline">Ver todas</Link>} />
          {d.visits.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400">No hay visitas programadas.</p>
          ) : (
            <ul className="divide-y divide-sand-100">
              {d.visits.map((v) => (
                <li key={v.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-500" />
                  <div>
                    <Link href={`${P}/contactos/${v.contact.id}`} className="font-medium text-ink-800 hover:underline">
                      {v.contact.name}
                    </Link>
                    <p className="text-[13px] text-ink-500">
                      {formatMadrid(v.at)}
                      {v.listing ? ` · ${v.listing.reference}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-sm text-ink-600">
          <strong className="text-ink-800">Tus inmuebles:</strong> {listingSummary.length ? listingSummary.join(" · ") : "todavía no has creado ninguno."}
        </p>
        <ButtonLink href={`${P}/inmuebles`} variant="outline" size="sm">
          Gestionar inmuebles
        </ButtonLink>
      </Card>
    </>
  );
}

function TaskList({ items, empty, tone }: { items: { id: string; name: string; nextAction: string | null; nextActionAt: Date | null }[]; empty: string; tone: "red" | "ink" }) {
  if (!items.length) return <p className="px-5 py-6 text-sm text-ink-400">{empty}</p>;
  return (
    <ul className="divide-y divide-sand-100">
      {items.map((c) => (
        <li key={c.id} className="flex items-start gap-3 px-5 py-3 text-sm">
          {tone === "red" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />}
          <div className="min-w-0">
            <Link href={`${P}/contactos/${c.id}`} className="font-medium text-ink-800 hover:underline">
              {c.name}
            </Link>
            <p className="truncate text-[13px] text-ink-600">{c.nextAction}</p>
            <p className={tone === "red" ? "text-[12px] text-red-600" : "text-[12px] text-ink-400"}>{formatMadrid(c.nextActionAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
