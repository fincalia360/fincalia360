import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Mail, Phone } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm } from "@/components/admin/crm/CrmForms";
import { ConfirmAction } from "@/components/agency/ConfirmAction";
import { ContactForm } from "@/components/agency/ContactForm";
import { STAGE_TONES } from "@/components/agency/tones";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/db/client";
import { formatMadrid, madridLocalValue } from "@/lib/dates";
import { requireAgency } from "@/services/agency/auth";
import { ACTIVITY_TYPES, AGENCY_STAGES, CONTACT_KINDS, CONTACT_SOURCES, CrmError, VISIT_STATUSES, getContact } from "@/services/agency/crm";
import { LISTING_STATUSES } from "@/services/listings/catalog";
import {
  contactStatusAction,
  deleteContactAction,
  logActivityAction,
  nextActionAction,
  scheduleVisitAction,
  updateContactAction,
  visitStatusAction,
} from "../../actions";

export const metadata = { title: "Contacto" };

const P = "/zona-inmobiliarias/panel";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireAgency();
  const { id } = await params;
  const c = await getContact(s, id).catch((e) => {
    if (e instanceof CrmError) notFound();
    throw e;
  });
  const listings = await prisma.listing.findMany({ where: { agencyId: s.agencyId, status: { in: ["DRAFT", "REVIEW", "PUBLISHED", "RESERVED"] } }, select: { id: true, reference: true, title: true }, orderBy: { updatedAt: "desc" } });
  const now = new Date();
  const overdue = c.nextActionAt && c.nextActionAt < now;

  return (
    <>
      <Link href={`${P}/contactos`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Contactos
      </Link>
      <PageHeader
        title={c.name}
        description={`${CONTACT_KINDS[c.kind as keyof typeof CONTACT_KINDS] ?? c.kind} · ${CONTACT_SOURCES[c.source as keyof typeof CONTACT_SOURCES] ?? c.source} · alta ${formatMadrid(c.createdAt)}`}
        actions={<Badge tone={STAGE_TONES[c.status] ?? "neutral"}>{AGENCY_STAGES[c.status as keyof typeof AGENCY_STAGES]?.label ?? c.status}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardBody className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {c.phone && (
                <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 font-medium text-ink-800 hover:underline">
                  <Phone className="h-4 w-4 text-ink-400" /> {c.phone}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 font-medium text-ink-800 hover:underline">
                  <Mail className="h-4 w-4 text-ink-400" /> {c.email}
                </a>
              )}
              {c.lastContactAt && <span className="text-ink-500">Último contacto: {formatMadrid(c.lastContactAt)}</span>}
            </CardBody>
            {c.notes && <p className="whitespace-pre-line border-t border-sand-100 px-5 py-4 text-sm text-ink-600">{c.notes}</p>}
          </Card>

          <Card>
            <CardHeader title="Registrar una comunicación o nota" />
            <CardBody>
              <ActionForm action={logActivityAction.bind(null, c.id)} submitLabel="Registrar">
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <select name="type" defaultValue="CALL" className="field">
                    {(["CALL", "WHATSAPP", "EMAIL", "MEETING", "NOTE"] as const).map((k) => (
                      <option key={k} value={k}>
                        {ACTIVITY_TYPES[k]}
                      </option>
                    ))}
                  </select>
                  <input name="at" type="datetime-local" defaultValue={madridLocalValue(now)} className="field" aria-label="Fecha" />
                </div>
                <textarea name="summary" rows={2} required maxLength={1000} placeholder="Resumen: qué se habló, qué quedó pendiente…" className="field" />
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Historial" />
            {c.activities.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-400">Sin actividad todavía.</p>
            ) : (
              <ol className="divide-y divide-sand-100">
                {c.activities.map((a) => (
                  <li key={a.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone={a.type === "STATUS" ? "violet" : a.type === "SYSTEM" ? "neutral" : "ink"}>{ACTIVITY_TYPES[a.type as keyof typeof ACTIVITY_TYPES] ?? a.type}</Badge>
                      <span className="text-[12px] text-ink-400">
                        {formatMadrid(a.at)}
                        {a.userName ? ` · ${a.userName}` : ""}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-ink-700">{a.summary}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <details className="rounded-2xl border border-sand-200 bg-white">
            <summary className="cursor-pointer px-5 py-4 text-[15px] font-semibold text-ink-800">Editar datos del contacto</summary>
            <div className="border-t border-sand-100 p-5">
              <ContactForm action={updateContactAction.bind(null, c.id)} values={c} submitLabel="Guardar cambios" />
            </div>
          </details>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Estado" />
            <CardBody>
              <ActionForm key={c.status} action={contactStatusAction.bind(null, c.id)} submitLabel="Cambiar estado" resetOnSuccess={false}>
                <select name="status" defaultValue={c.status} className="field">
                  {Object.entries(AGENCY_STAGES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Próxima acción" description={c.nextAction ? undefined : "Sin acción programada"} />
            <CardBody>
              {c.nextAction && (
                <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${overdue ? "bg-red-50 text-red-700" : "bg-sand-50 text-ink-700"}`}>
                  {c.nextAction} · {formatMadrid(c.nextActionAt)} {overdue && <strong>(vencida)</strong>}
                </p>
              )}
              <ActionForm key={`${c.nextAction}-${c.nextActionAt?.toISOString()}`} action={nextActionAction.bind(null, c.id)} submitLabel="Programar" resetOnSuccess={false}>
                <input name="action" maxLength={200} defaultValue={c.nextAction ?? ""} placeholder="Ej.: llamar para enviar la propuesta" className="field" />
                <input name="dueAt" type="datetime-local" defaultValue={madridLocalValue(c.nextActionAt)} className="field" aria-label="Fecha de la próxima acción" />
                <p className="text-xs text-ink-400">Deja el texto vacío y guarda para quitarla.</p>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Visitas" />
            <CardBody className="space-y-4">
              {c.visits.length > 0 && (
                <ul className="space-y-2">
                  {c.visits.map((v) => (
                    <li key={v.id} className="rounded-lg border border-sand-100 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink-800">{formatMadrid(v.at)}</span>
                        <Badge tone={v.status === "DONE" ? "green" : v.status === "CANCELLED" ? "neutral" : "terracotta"}>{VISIT_STATUSES[v.status as keyof typeof VISIT_STATUSES]}</Badge>
                      </div>
                      {v.listing && <p className="text-[13px] text-ink-500">{v.listing.reference} · {v.listing.title}</p>}
                      {v.notes && <p className="text-[13px] text-ink-500">{v.notes}</p>}
                      {v.status === "SCHEDULED" && (
                        <div className="mt-1 flex gap-3 text-[12.5px]">
                          <form action={visitStatusAction.bind(null, v.id, "DONE")}>
                            <button className="font-medium text-pine-600 hover:underline">Realizada</button>
                          </form>
                          <form action={visitStatusAction.bind(null, v.id, "CANCELLED")}>
                            <button className="font-medium text-ink-500 hover:underline">Cancelar</button>
                          </form>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <ActionForm action={scheduleVisitAction.bind(null, c.id)} submitLabel="Programar visita">
                <input name="at" type="datetime-local" required className="field" aria-label="Fecha y hora de la visita" />
                <select name="listingId" defaultValue="" className="field">
                  <option value="">Sin inmueble concreto</option>
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.reference} · {l.title}
                    </option>
                  ))}
                </select>
                <input name="notes" maxLength={500} placeholder="Notas (opcional)" className="field" />
              </ActionForm>
            </CardBody>
          </Card>

          {(c.inquiries.length > 0 || c.listings.length > 0) && (
            <Card>
              <CardHeader title="Inmuebles relacionados" />
              <ul className="divide-y divide-sand-100 text-sm">
                {c.listings.map((l) => (
                  <li key={l.id} className="px-5 py-3">
                    <Link href={`${P}/inmuebles/${l.id}`} className="font-medium text-ink-800 hover:underline">
                      {l.reference}
                    </Link>{" "}
                    <span className="text-ink-500">· propietario · {LISTING_STATUSES[l.status as keyof typeof LISTING_STATUSES]}</span>
                  </li>
                ))}
                {c.inquiries.map((i) => (
                  <li key={i.id} className="px-5 py-3">
                    <Link href={`${P}/inmuebles/${i.listing.id}`} className="font-medium text-ink-800 hover:underline">
                      {i.listing.reference}
                    </Link>{" "}
                    <span className="text-ink-500">· solicitud del {formatMadrid(i.createdAt)}</span>
                    {i.message && <p className="text-[13px] text-ink-500">«{i.message}»</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Protección de datos" />
            <CardBody className="space-y-3 text-sm">
              <a href={`/api/zona/contactos/${c.id}/export`} className="inline-flex items-center gap-1.5 font-medium text-ink-700 hover:underline">
                <Download className="h-4 w-4" /> Descargar sus datos (acceso / portabilidad)
              </a>
              <ConfirmAction action={deleteContactAction.bind(null, c.id)} confirmText={`¿Eliminar definitivamente a ${c.name} y todo su historial? No se puede deshacer.`}>
                Eliminar contacto y su historial (supresión)
              </ConfirmAction>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
