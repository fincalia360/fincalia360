import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, MessageCircle } from "lucide-react";
import { addNoteAction, createAppointmentAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ContactCrmPanel } from "@/components/admin/crm/ContactCrmPanel";
import { Timeline } from "@/components/admin/Timeline";
import { Badge, DemoBadge, STATUS_TONES, TIER_TONES } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  APPOINTMENT_STATUS_LABELS,
  CONDITION_LABELS,
  CONTACT_LABELS,
  INTENT_LABELS,
  LANGUAGE_NAMES,
  LOCATION_LABELS,
  MOTIVATION_LABELS,
  PROPERTY_LABELS,
  SITUATION_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  TIER_LABELS,
  TIMELINE_LABELS,
  label,
} from "@/lib/labels";
import { formatDateTime, formatEUR, parseJSON } from "@/lib/utils";
import { getLeadDetail } from "@/services/leadService";
import { TIER_THRESHOLDS } from "@/services/scoringService";
import type { ExtractedData, Language, ScoreItem } from "@/types";

export const metadata = { title: "Ficha del lead" };

function Field({ label: name, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <dt className="text-[12px] text-ink-400">{name}</dt>
      <dd className="mt-0.5 text-sm text-ink-800">{children ?? "—"}</dd>
    </div>
  );
}

function yesNo(v: boolean | null | undefined) {
  return v === true ? "Sí" : v === false ? "No" : "—";
}

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; erased?: string }> }) {
  const { id } = await params;
  const { created, erased } = await searchParams;
  const lead = await getLeadDetail(id);
  if (!lead) notFound();

  const breakdown = parseJSON<ScoreItem[]>(lead.scoreBreakdown, []);
  const conversation = lead.conversations[0];
  const extracted = parseJSON<ExtractedData>(conversation?.extracted, {});
  const p = lead.property;
  const isClosed = lead.status === "CONVERTED" || lead.status === "LOST";

  return (
    <>
      <Link href="/admin/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Contactos
      </Link>

      {created && (
        <div className="mb-5 rounded-xl border border-terracotta-100 bg-terracotta-50 px-4 py-3 text-sm text-terracotta-700">
          {created === "hot"
            ? "Lead caliente simulado: conversación con el agente completada, score alto y cita sugerida pendiente de confirmar."
            : "Lead demo creado con datos ficticios."}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-4xl font-medium tracking-tight text-ink-800">{lead.name}</h1>
            {lead.isDemo && <DemoBadge>Ficticio</DemoBadge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <Badge tone={STATUS_TONES[lead.status]}>{label(STATUS_LABELS, lead.status)}</Badge>
            <Badge tone={TIER_TONES[lead.scoreTier]}>
              {label(TIER_LABELS, lead.scoreTier)} · {lead.score}
            </Badge>
            <span>Entrada {formatDateTime(lead.createdAt)}</span>
            <span>· {label(SOURCE_LABELS, lead.source)}</span>
          </div>
          <p className="mt-3 text-sm">
            <span className="text-ink-400">Próxima acción: </span>
            <span className="font-medium text-ink-800">{lead.nextAction ?? "—"}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/agent/${lead.id}`} className={buttonClasses({ variant: "outline" })}>
            <MessageCircle className="h-4 w-4" /> Conversación con agente
          </Link>
          {!isClosed && (
            <form action={createAppointmentAction.bind(null, lead.id)}>
              <SubmitButton variant="outline">
                <CalendarPlus className="h-4 w-4" /> Crear cita
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {erased && (
        <div className="mb-5 rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-ink-600">Datos personales suprimidos. Solo se conservan registros anónimos.</div>
      )}
      <div className="mb-6">
        <ContactCrmPanel leadId={lead.id} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Datos personales" />
            <CardBody>
              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <Field label="Nombre">{lead.name}</Field>
                <Field label="Email">{lead.email}</Field>
                <Field label="Teléfono">{lead.phone ?? "—"}</Field>
                <Field label="Idioma">{LANGUAGE_NAMES[lead.language as Language] ?? lead.language}</Field>
                <Field label="Contacto preferido">{label(CONTACT_LABELS, lead.preferredContact)}</Field>
                <Field label="Origen">{label(SOURCE_LABELS, lead.source)}</Field>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Datos de la propiedad" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                <Field label="Ubicación">
                  {label(LOCATION_LABELS, p?.location)}
                  {p?.locationOther ? ` (${p.locationOther})` : ""}
                </Field>
                <Field label="Tipo">{label(PROPERTY_LABELS, p?.type)}</Field>
                <Field label="Superficie">{p?.sqm ? `${p.sqm} m²` : "—"}</Field>
                <Field label="Dormitorios">{p?.bedrooms ?? "—"}</Field>
                <Field label="Baños">{p?.bathrooms ?? "—"}</Field>
                <Field label="Estado">{label(CONDITION_LABELS, p?.condition)}</Field>
                <Field label="Terraza">{yesNo(p?.terrace)}</Field>
                <Field label="Piscina">{yesNo(p?.pool)}</Field>
                <Field label="Parking">{yesNo(p?.parking)}</Field>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Datos de venta" description="Formulario + datos extraídos por el agente" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                <Field label="Intención">{label(INTENT_LABELS, lead.intent)}</Field>
                <Field label="Plazo">{label(TIMELINE_LABELS, lead.timeline)}</Field>
                <Field label="Situación">{label(SITUATION_LABELS, lead.situation)}</Field>
                <Field label="Motivación">{label(MOTIVATION_LABELS, lead.motivation)}</Field>
                <Field label="Urgencia">{lead.urgency === "HIGH" ? "Alta" : "Normal"}</Field>
                <Field label="Quiere inmobiliaria">{lead.agencyInterest === null ? "Indeciso / —" : yesNo(lead.agencyInterest)}</Field>
                <Field label="Interés en cita">{yesNo(lead.appointmentInterest)}</Field>
                <Field label="Valor estimado">{formatEUR(lead.estimatedValue)}</Field>
                <Field label="Horquilla">
                  {formatEUR(lead.estimatedValueMin)} – {formatEUR(lead.estimatedValueMax)}
                </Field>
              </dl>
              {lead.motivationText && <p className="mt-2 rounded-lg bg-sand-50 px-3 py-2 text-sm text-ink-600">“{lead.motivationText}”</p>}
              {extracted.ownerPriceExpectation && (
                <p className="mt-2 text-sm text-ink-500">Expectativa de precio del propietario: {formatEUR(extracted.ownerPriceExpectation)}</p>
              )}
              {lead.lostReason && lead.status === "LOST" && <p className="mt-2 text-sm text-ink-500">Motivo de descarte: {lead.lostReason}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Conversación con agente"
              description={conversation ? `${conversation.messages.length} mensajes · ${conversation.status === "COMPLETED" ? "completada" : "en curso"}` : "Aún no iniciada"}
              action={
                <Link href={`/agent/${lead.id}`} className="text-sm font-medium text-terracotta-600 hover:underline">
                  {conversation ? "Abrir chat" : "Iniciar chat"}
                </Link>
              }
            />
            <CardBody>
              {conversation ? (
                <div className="max-h-96 space-y-2 overflow-y-auto rounded-xl bg-[#EFE7DC] p-3">
                  {conversation.messages.map((m) => (
                    <div key={m.id} className={m.role === "lead" ? "flex justify-end" : "flex justify-start"}>
                      <p className={`max-w-[85%] rounded-xl px-3 py-1.5 text-[13.5px] shadow-sm ${m.role === "lead" ? "bg-[#D9F2CF]" : "bg-white"}`}>{m.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-400">El agente saludará al propietario en su idioma ({LANGUAGE_NAMES[lead.language as Language]}).</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Historial de actividad" description="Cambios de estado, comunicaciones, correos y notas" />
            <CardBody>
              <Timeline events={lead.events} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Score" description="Scoring transparente" />
            <CardBody>
              <div className="flex items-end gap-3">
                <span className="font-serif text-6xl leading-none text-ink-800">{lead.score}</span>
                <Badge tone={TIER_TONES[lead.scoreTier]} className="mb-1">
                  {label(TIER_LABELS, lead.scoreTier)}
                </Badge>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-sand-100">
                <div className="h-full rounded-full bg-terracotta-500" style={{ width: `${Math.min(100, lead.score)}%` }} />
              </div>
              <ul className="mt-5 divide-y divide-sand-100 text-sm">
                {breakdown.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-ink-600">{item.label}</span>
                    <span className="font-semibold tabular-nums text-ink-800">+{item.points}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between py-2 font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{lead.score}</span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-ink-400">
                Clasificación: {TIER_THRESHOLDS.slice().reverse().map((t) => `${TIER_LABELS[t.tier]} ≥ ${t.min}`).join(" · ")}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Cita" />
            <CardBody>
              {lead.appointments.length === 0 ? (
                <p className="text-sm text-ink-400">Sin citas. Usa “Crear cita” o deja que el agente la reserve.</p>
              ) : (
                <ul className="space-y-3">
                  {lead.appointments.map((a) => (
                    <li key={a.id} className="rounded-xl border border-sand-200 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium tabular-nums text-ink-800">{formatDateTime(a.scheduledAt)}</span>
                        <Badge tone={a.status === "BOOKED" ? "terracotta" : a.status === "COMPLETED" ? "green" : a.status === "REQUESTED" ? "amber" : "neutral"}>
                          {label(APPOINTMENT_STATUS_LABELS, a.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[13px] text-ink-500">
                        Llamada · {a.agency?.name ?? "Sin inmobiliaria"} · origen {a.source.toLowerCase()}
                      </p>
                      {a.notes && <p className="mt-1 text-[13px] text-ink-400">{a.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Consentimientos" />
            <CardBody>
              {lead.consent ? (
                <dl className="text-sm">
                  <Field label="consent_contact">{yesNo(lead.consent.consentContact)}</Field>
                  <Field label="consent_marketing">{yesNo(lead.consent.consentMarketing)}</Field>
                  <Field label="consent_timestamp">{lead.consent.consentTimestamp.toISOString()}</Field>
                  <Field label="consent_version">{lead.consent.consentVersion}</Field>
                  <details className="mt-2 text-[13px] text-ink-500">
                    <summary className="cursor-pointer text-ink-600">Texto aceptado ({lead.consent.language.toUpperCase()})</summary>
                    <p className="mt-2 leading-relaxed">{lead.consent.consentText}</p>
                  </details>
                </dl>
              ) : (
                <p className="text-sm text-red-600">Sin consentimiento registrado.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notas" />
            <CardBody>
              <form action={addNoteAction.bind(null, lead.id)} className="space-y-2">
                <textarea name="content" rows={3} required placeholder="Añadir una nota interna…" className="field resize-y" />
                <SubmitButton size="sm" variant="primary">Guardar nota</SubmitButton>
              </form>
              <ul className="mt-4 space-y-3">
                {lead.notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-sand-50 px-3 py-2 text-sm">
                    <p className="text-ink-700">{n.content}</p>
                    <p className="mt-1 text-[11.5px] text-ink-400">
                      {n.author} · {formatDateTime(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
