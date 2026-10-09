import Link from "next/link";
import { setAppointmentStatusAction } from "@/app/admin/actions";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge, DemoBadge, TIER_TONES } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { APPOINTMENT_STATUS_LABELS, LOCATION_LABELS, PROPERTY_LABELS, TIER_LABELS, label } from "@/lib/labels";
import { listAppointments } from "@/services/appointmentService";

export const metadata = { title: "Citas" };

const TONE: Record<string, "terracotta" | "green" | "amber" | "neutral"> = {
  BOOKED: "terracotta",
  COMPLETED: "green",
  REQUESTED: "amber",
  CANCELLED: "neutral",
};

type Appointment = Awaited<ReturnType<typeof listAppointments>>[number];

function AppointmentRow({ a }: { a: Appointment }) {
  const d = new Date(a.scheduledAt);
  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="w-24 shrink-0 text-center">
        <p className="text-[11px] uppercase tracking-wider text-ink-400">{d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}</p>
        <p className="font-serif text-2xl tabular-nums text-ink-800">{d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/leads/${a.lead.id}`} className="font-medium text-ink-800 hover:text-terracotta-600">
            {a.lead.name}
          </Link>
          <Badge tone={TIER_TONES[a.lead.scoreTier]}>
            {label(TIER_LABELS, a.lead.scoreTier)} · {a.lead.score}
          </Badge>
          <Badge tone={TONE[a.status]}>{label(APPOINTMENT_STATUS_LABELS, a.status)}</Badge>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-ink-500">
          {label(PROPERTY_LABELS, a.lead.property?.type)} en {label(LOCATION_LABELS, a.lead.property?.location)} · {a.lead.language.toUpperCase()} ·{" "}
          {a.lead.phone ?? "sin teléfono"} · {a.agency?.name ?? "sin inmobiliaria"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {a.status === "REQUESTED" && (
          <form action={setAppointmentStatusAction.bind(null, a.id, "BOOKED")}>
            <SubmitButton size="sm" variant="primary">Confirmar</SubmitButton>
          </form>
        )}
        {(a.status === "BOOKED" || a.status === "REQUESTED") && (
          <>
            <form action={setAppointmentStatusAction.bind(null, a.id, "COMPLETED")}>
              <SubmitButton size="sm" variant="outline">Realizada</SubmitButton>
            </form>
            <form action={setAppointmentStatusAction.bind(null, a.id, "CANCELLED")}>
              <SubmitButton size="sm" variant="ghost">Cancelar</SubmitButton>
            </form>
          </>
        )}
      </div>
    </li>
  );
}

export default async function AppointmentsPage() {
  const [upcoming, past] = await Promise.all([listAppointments("upcoming"), listAppointments("past")]);
  return (
    <>
      <PageHeader
        title="Citas"
        description="Llamadas con especialistas. El calendario es una simulación con horarios ficticios."
        actions={<DemoBadge>Calendario demo · TODO: Google Calendar / Cal.com</DemoBadge>}
      />
      <Card>
        <CardHeader title="Próximas" description={`${upcoming.length} citas`} />
        <ul className="divide-y divide-sand-100">
          {upcoming.map((a) => (
            <AppointmentRow key={a.id} a={a} />
          ))}
          {upcoming.length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-400">No hay citas próximas.</li>}
        </ul>
      </Card>
      <Card className="mt-6">
        <CardHeader title="Pasadas" description={`${past.length} citas`} />
        <ul className="divide-y divide-sand-100">
          {past.map((a) => (
            <AppointmentRow key={a.id} a={a} />
          ))}
          {past.length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-400">Sin historial.</li>}
        </ul>
      </Card>
    </>
  );
}
