import Link from "next/link";
import { Bot, ExternalLink } from "lucide-react";
import { Badge, DemoBadge, STATUS_TONES, TIER_TONES } from "@/components/ui/Badge";
import {
  CONTACT_LABELS,
  INTENT_LABELS,
  LANGUAGE_NAMES,
  LOCATION_LABELS,
  MOTIVATION_LABELS,
  PROPERTY_LABELS,
  SITUATION_LABELS,
  STATUS_LABELS,
  TIER_LABELS,
  TIMELINE_LABELS,
  label,
} from "@/lib/labels";
import { formatDateTime, formatEUR } from "@/lib/utils";
import type { ConversationView } from "@/services/agentService";

const FEATURE_LABELS: Record<string, string> = {
  SEA_VIEW: "Vistas al mar",
  MOORING: "Amarre / canal",
  RENOVATED: "Reformada",
  TO_REFORM: "A reformar",
};

const STEP_LABELS: Record<string, string> = {
  CONFIRM_INTEREST: "Confirmar interés",
  LOCATION: "Zona",
  PROPERTY_TYPE: "Tipo de propiedad",
  MOTIVATION: "Motivación",
  TIMELINE: "Plazo",
  SITUATION: "Situación",
  DETAILS: "Características",
  FEATURES: "Puntos fuertes",
  AGENCY_INTEREST: "Interés en inmobiliaria",
  OFFER_APPOINTMENT: "Propuesta de cita",
  SLOTS: "Eligiendo horario",
  PREFERRED_CONTACT: "Canal preferido",
  BOOKED: "Cita reservada",
  CLOSED: "Cerrada",
};

function yesNo(v: boolean | null | undefined) {
  if (v === true) return "Sí";
  if (v === false) return "No";
  if (v === null) return "Indeciso";
  return "—";
}

/** Panel interno: datos estructurados que el agente va extrayendo en tiempo real. */
export function AgentInsights({ view }: { view: ConversationView }) {
  const x = view.extracted;
  const rows: Array<[string, string, React.ReactNode]> = [
    ["intent", "Intención", x.intent ? label(INTENT_LABELS, x.intent) : "—"],
    ["timeline", "Plazo", label(TIMELINE_LABELS, x.timeline)],
    ["motivation", "Motivación", label(MOTIVATION_LABELS, x.motivation)],
    ["property_type", "Propiedad", label(PROPERTY_LABELS, x.propertyType)],
    ["location", "Ubicación", label(LOCATION_LABELS, x.location)],
    ["situation", "Situación", label(SITUATION_LABELS, x.situation)],
    ["estimated_value", "Valor estimado", formatEUR(x.estimatedValue)],
    ["language", "Idioma", x.language ? LANGUAGE_NAMES[x.language] : "—"],
    ["preferred_contact", "Contacto preferido", label(CONTACT_LABELS, x.preferredContact)],
    ["appointment_interest", "Interés en cita", yesNo(x.appointmentInterest)],
    ["agency_interest", "Quiere inmobiliaria", yesNo(x.agencyInterest)],
    ["urgency", "Urgencia", x.urgency === "HIGH" ? "Alta" : "Normal"],
  ];

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-ink-500" />
            <p className="text-sm font-semibold text-ink-800">Panel del agente</p>
          </div>
          <DemoBadge>Agente demo · reglas</DemoBadge>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
          Proveedor: <code className="rounded bg-sand-100 px-1">{view.provider}</code>. Detecta intención y datos con reglas multilingües y estado
          conversacional. Se puede sustituir por un LLM implementando <code className="rounded bg-sand-100 px-1">AIProvider</code>.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-serif text-4xl leading-none text-ink-800">{view.lead.score}</span>
          <Badge tone={TIER_TONES[view.lead.scoreTier]}>{label(TIER_LABELS, view.lead.scoreTier)}</Badge>
          <Badge tone={STATUS_TONES[view.lead.status]}>{label(STATUS_LABELS, view.lead.status)}</Badge>
          <span className="text-xs text-ink-400">Paso actual: {STEP_LABELS[view.step] ?? view.step}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white shadow-soft">
        <p className="border-b border-sand-100 px-5 py-3 text-sm font-semibold text-ink-800">Datos extraídos</p>
        <dl className="grid grid-cols-1 sm:grid-cols-2">
          {rows.map(([key, name, value]) => (
            <div key={key} className="border-b border-sand-100 px-5 py-2.5 sm:odd:border-r">
              <dt className="font-mono text-[10.5px] uppercase tracking-wider text-ink-400">{key}</dt>
              <dd className="mt-0.5 text-sm text-ink-800">
                <span className="sr-only">{name}: </span>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {(x.features?.length || x.sqm || x.motivationText) && (
          <div className="space-y-1 px-5 py-3 text-[13px] text-ink-500">
            {x.features && x.features.length > 0 && <p>Puntos fuertes: {x.features.map((f) => FEATURE_LABELS[f] ?? f).join(", ")}</p>}
            {x.sqm && <p>Superficie: {x.sqm} m² · {x.bedrooms ?? "—"} dormitorios</p>}
            {x.motivationText && <p>Texto literal: “{x.motivationText}”</p>}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white p-5 text-sm shadow-soft">
        <p className="text-ink-500">
          Asignado a: <span className="font-medium text-ink-800">{view.lead.agencyName ?? "Pendiente (se asigna al reservar cita)"}</span>
        </p>
        <p className="mt-1 text-ink-500">
          Cita: <span className="font-medium text-ink-800">{view.lead.appointmentAt ? formatDateTime(view.lead.appointmentAt) : "—"}</span>
        </p>
        <Link href={`/admin/leads/${view.leadId}`} className="mt-3 inline-flex items-center gap-1.5 font-medium text-terracotta-600 hover:text-terracotta-700">
          Abrir ficha en el CRM <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </aside>
  );
}
