import Link from "next/link";
import { AlertTriangle, Download, ExternalLink } from "lucide-react";
import {
  addRevenueAction,
  assignPartnerAction,
  changeStatusAction,
  eraseContactAction,
  logContactAction,
  setNextActionAction,
  updateAssignmentAction,
  updatePreferencesAction,
} from "@/app/admin/crmActions";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/db/client";
import { formatMadrid, madridLocalValue } from "@/lib/dates";
import { CONTACT_LABELS, CONTACT_WINDOW_LABELS, INTEREST_LABELS, label } from "@/lib/labels";
import { formatEUR } from "@/lib/utils";
import { getServices, getStages } from "@/services/crm/catalog";
import { ASSIGNMENT_STATUS_LABELS, CONTACT_CHANNELS, getContactCrm } from "@/services/crm/contacts";
import { ActionForm } from "./CrmForms";

const small = "field h-9 py-1.5 text-sm";

export async function ContactCrmPanel({ leadId }: { leadId: string }) {
  const [lead, stages, services] = await Promise.all([getContactCrm(leadId), getStages(), getServices()]);
  if (!lead) return null;
  const consent = await prisma.consent.findUnique({ where: { leadId } });
  const provinces = [...new Set(lead.studies.map((s) => s.provinceCode))];
  const partners = await prisma.agency.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });
  // Colaboradores que cubren la provincia de la vivienda (o sin provincias = ámbito nacional) y el servicio
  const suitable = partners.filter((p) => {
    const provs = p.provinces.split(",").filter(Boolean);
    return !provs.length || provs.some((x) => provinces.includes(x));
  });
  const now = new Date();
  const overdue = lead.nextActionAt != null && lead.nextActionAt <= now && !["CONVERTED", "LOST"].includes(lead.status);
  const erased = lead.name === "Contacto suprimido";

  return (
    <div className="space-y-6">
      {/* Estado y seguimiento */}
      <Card>
        <CardHeader title="Estado y seguimiento" description="Cambia el estado, programa la próxima acción y registra las comunicaciones." />
        <CardBody className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <ActionForm action={changeStatusAction.bind(null, leadId)} submitLabel="Cambiar estado" okLabel="Estado actualizado" resetOnSuccess={false}>
              <label className="block text-sm font-medium text-ink-700">
                Estado comercial
                <select name="status" defaultValue={lead.status} className={`${small} mt-1`}>
                  {stages.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </ActionForm>
            <div className="text-sm">
              <p className="text-ink-500">
                Último contacto: <span className="font-medium text-ink-800">{formatMadrid(lead.lastContactAt)}</span>
              </p>
              <p className={`mt-1 ${overdue ? "font-semibold text-red-700" : "text-ink-500"}`}>
                {overdue && <AlertTriangle className="mr-1 inline h-4 w-4" />}
                Próxima acción: <span className="text-ink-800">{lead.nextAction ?? "—"}</span>
                {lead.nextActionAt && <> · {formatMadrid(lead.nextActionAt)}</>}
              </p>
            </div>
          </div>

          <div className="grid gap-6 border-t border-sand-100 pt-5 lg:grid-cols-2">
            <ActionForm action={setNextActionAction.bind(null, leadId)} submitLabel="Programar" okLabel="Próxima acción guardada">
              <p className="text-sm font-semibold text-ink-800">Próxima acción</p>
              <input name="action" required maxLength={200} placeholder="Ej.: Llamar para concertar la consulta" defaultValue={lead.nextAction ?? ""} className={small} />
              <label className="block text-xs text-ink-500">
                Fecha y hora (hora de España)
                <input type="datetime-local" name="dueAt" defaultValue={madridLocalValue(lead.nextActionAt)} className={`${small} mt-1`} />
              </label>
            </ActionForm>
            <ActionForm action={logContactAction.bind(null, leadId)} submitLabel="Registrar" okLabel="Comunicación registrada">
              <p className="text-sm font-semibold text-ink-800">Registrar una comunicación</p>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <select name="channel" defaultValue="CALL" className={small}>
                  {Object.entries(CONTACT_CHANNELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input type="datetime-local" name="at" defaultValue={madridLocalValue(now)} className={small} />
              </div>
              <textarea name="summary" required rows={2} maxLength={500} placeholder="Qué se habló y qué se acordó" className="field resize-y text-sm" />
            </ActionForm>
          </div>
        </CardBody>
      </Card>

      {/* Solicitudes y estudios */}
      <Card>
        <CardHeader title="Solicitudes y estudios" description={`${lead.requests.length} solicitud(es)`} />
        <CardBody>
          {lead.requests.length === 0 ? (
            <p className="text-sm text-ink-400">Sin solicitudes desde la pantalla final del estudio.</p>
          ) : (
            <ul className="divide-y divide-sand-100">
              {lead.requests.map((r) => (
                <li key={r.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="ink">{INTEREST_LABELS[r.interest] ?? r.interest}</Badge>
                    <span className="text-ink-500">{formatMadrid(r.createdAt)}</span>
                    <span className="text-ink-500">
                      · {label(CONTACT_LABELS, r.contactChannel)}
                      {r.contactWindow ? ` · ${CONTACT_WINDOW_LABELS[r.contactWindow]}` : ""}
                    </span>
                    {r.study && (
                      <Link href={`/admin/studies/${r.study.id}`} className="inline-flex items-center gap-1 font-medium text-terracotta-600 hover:underline">
                        Estudio · {r.study.municipalityName} <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    Autoriza: atender la solicitud{r.consentPartnerShare ? " · comunicar datos a un colaborador" : ""}
                    {r.consentMarketing ? " · información comercial" : ""} (versión {r.consentVersion})
                  </p>
                  {r.comments && <p className="mt-1 rounded-lg bg-sand-50 px-3 py-2 text-[13px] text-ink-600">“{r.comments}”</p>}
                </li>
              ))}
            </ul>
          )}
          {lead.studies.length > 0 && (
            <p className="mt-3 text-xs text-ink-400">
              Estudios asociados:{" "}
              {lead.studies.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ", "}
                  <Link href={`/admin/studies/${s.id}`} className="underline">
                    {s.municipalityName} ({s.createdAt.toLocaleDateString("es-ES")})
                  </Link>
                </span>
              ))}
            </p>
          )}
        </CardBody>
      </Card>

      {/* Colaboradores */}
      <Card>
        <CardHeader title="Colaborador" description="Solo se pueden compartir los datos si el propietario lo ha autorizado." />
        <CardBody className="space-y-4">
          {lead.assignments.map((a) => (
            <div key={a.id} className="rounded-xl border border-sand-200 p-3 text-sm">
              <p className="font-medium text-ink-800">
                {a.agency.name} · {a.serviceCode ? INTEREST_LABELS[a.serviceCode] : "sin servicio"} · {ASSIGNMENT_STATUS_LABELS[a.status]}
              </p>
              <p className="text-xs text-ink-400">Asignado {formatMadrid(a.createdAt)}</p>
              <ActionForm action={updateAssignmentAction.bind(null, a.id, leadId)} submitLabel="Actualizar resultado" okLabel="Actualizado" className="mt-2 space-y-2" resetOnSuccess={false}>
                <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
                  <select name="status" defaultValue={a.status} className={small}>
                    {Object.entries(ASSIGNMENT_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <input name="result" defaultValue={a.result ?? ""} maxLength={500} placeholder="Resultado (p. ej. mandato firmado, no interesado…)" className={small} />
                </div>
              </ActionForm>
            </div>
          ))}
          {lead.partnerShareConsent ? (
            suitable.length ? (
              <ActionForm action={assignPartnerAction.bind(null, leadId)} submitLabel="Asignar oportunidad" okLabel="Asignada">
                <div className="grid gap-2 sm:grid-cols-2">
                  <select name="agencyId" required defaultValue="" className={small}>
                    <option value="" disabled>
                      Elige colaborador
                    </option>
                    {suitable.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select name="serviceCode" defaultValue={lead.primaryInterest && lead.primaryInterest !== "REPORT_ONLY" ? lead.primaryInterest : ""} className={small}>
                    <option value="">Sin servicio concreto</option>
                    {services.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </ActionForm>
            ) : (
              <p className="text-sm text-ink-500">
                No hay colaboradores activos para esta provincia.{" "}
                <Link href="/admin/agencies/new" className="underline">
                  Añadir colaborador
                </Link>
              </p>
            )
          ) : (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              El propietario no ha autorizado comunicar sus datos a colaboradores. Pregúntaselo antes y regístralo (solicitud nueva desde su estudio o consentimiento por escrito).
            </p>
          )}
        </CardBody>
      </Card>

      {/* Preferencias y consentimientos */}
      <Card>
        <CardHeader title="Preferencias de comunicación" />
        <CardBody className="space-y-3 text-sm">
          <p className="text-ink-600">
            Información comercial: <strong>{consent?.consentMarketing ? "autorizada" : "no autorizada"}</strong> · Comunicar datos a colaboradores:{" "}
            <strong>{lead.partnerShareConsent ? "autorizado" : "no autorizado"}</strong>
          </p>
          <ActionForm action={updatePreferencesAction.bind(null, leadId)} submitLabel="Guardar preferencias" okLabel="Preferencias guardadas" resetOnSuccess={false}>
            <div className="grid gap-2 sm:grid-cols-2">
              <select name="preferredContact" defaultValue={lead.preferredContact ?? "EMAIL"} className={small}>
                <option value="EMAIL">Email</option>
                <option value="PHONE">Teléfono</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
              <select name="contactWindow" defaultValue={lead.contactWindow ?? ""} className={small}>
                <option value="">Sin franja preferida</option>
                {Object.entries(CONTACT_WINDOW_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {consent?.consentMarketing && (
              <label className="flex items-center gap-2 text-ink-600">
                <input type="checkbox" name="revokeMarketing" /> Retirar la autorización de información comercial (a petición del propietario)
              </label>
            )}
            {lead.partnerShareConsent && (
              <label className="flex items-center gap-2 text-ink-600">
                <input type="checkbox" name="revokePartnerShare" /> Retirar la autorización para comunicar datos a colaboradores
              </label>
            )}
            <p className="text-xs text-ink-400">El equipo solo puede retirar autorizaciones; darlas corresponde siempre al propietario.</p>
          </ActionForm>
        </CardBody>
      </Card>

      {/* Ingresos */}
      <Card>
        <CardHeader title="Ingresos" description="Solo ingresos reales: se suman en los indicadores del negocio." />
        <CardBody className="space-y-4">
          {lead.revenues.length > 0 && (
            <ul className="divide-y divide-sand-100 text-sm">
              {lead.revenues.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {r.date.toLocaleDateString("es-ES")} · {r.description}
                  </span>
                  <span className="font-semibold tabular-nums">{formatEUR(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addRevenueAction.bind(null, leadId)} submitLabel="Registrar ingreso" okLabel="Ingreso registrado">
            <div className="grid gap-2 sm:grid-cols-[120px_150px_1fr]">
              <input name="amount" type="number" min={1} step={1} required placeholder="€" className={small} />
              <input name="date" type="date" required defaultValue={now.toISOString().slice(0, 10)} className={small} />
              <input name="description" required maxLength={200} placeholder="Concepto (p. ej. honorarios de asesoramiento)" className={small} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select name="serviceCode" defaultValue="" className={small}>
                <option value="">Servicio (opcional)</option>
                {services.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select name="agencyId" defaultValue="" className={small}>
                <option value="">Colaborador (opcional)</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </ActionForm>
        </CardBody>
      </Card>

      {/* Derechos del propietario */}
      <Card>
        <CardHeader title="Datos personales del propietario" description="Derechos de acceso, portabilidad y supresión (RGPD)." />
        <CardBody className="space-y-4 text-sm">
          <a href={`/api/admin/leads/${leadId}/export`} className="inline-flex items-center gap-1.5 font-medium text-terracotta-600 hover:underline">
            <Download className="h-4 w-4" /> Exportar todos sus datos (JSON)
          </a>
          {erased ? (
            <p className="text-ink-500">Los datos personales de este contacto ya se han suprimido.</p>
          ) : (
            <ActionForm action={eraseContactAction.bind(null, leadId)} submitLabel="Suprimir datos personales" variant="danger">
              <p className="text-ink-600">
                Elimina nombre, email, teléfono, notas, conversaciones, comentarios y dirección exacta. Se conservan solo registros anónimos (fechas, estados e
                importes). <strong>No se puede deshacer.</strong>
              </p>
              <input name="confirm" placeholder="Escribe SUPRIMIR para confirmar" className={`${small} max-w-xs`} autoComplete="off" />
            </ActionForm>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
