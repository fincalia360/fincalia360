"use client";

import { useActionState } from "react";
import { saveAgencyAction, type AgencyFormState } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { LANGUAGE_NAMES, LOCATION_LABELS, PROPERTY_LABELS } from "@/lib/labels";
import { csv } from "@/lib/utils";
import { PROVINCES } from "@/services/study/geo";
import { isPortalProvince } from "@/services/listings/catalog";
import { LANGUAGES, LOCATIONS, PROPERTY_TYPES } from "@/types";

interface AgencyValues {
  id?: string;
  name: string;
  zones: string;
  email: string;
  phone: string;
  languages: string;
  propertyTypes: string;
  status: string;
  monthlyFee: number;
  pricePerAppointment: number;
  partnerType: string;
  services: string;
  provinces: string;
  municipalities: string;
  contactName: string | null;
  agreementTerms: string | null;
  notes: string | null;
}

const PARTNER_TYPE_LABELS: Record<string, string> = { INMOBILIARIA: "Inmobiliaria", ABOGADO: "Abogado", GESTOR: "Gestor / administrador de fincas", TASADOR: "Tasador", OTRO: "Otro profesional" };
const SERVICE_OPTIONS = [["SELL", "Venta"], ["RENT", "Alquiler"], ["ADVICE", "Asesoramiento"]] as const;

const ZONE_OPTIONS = [...LOCATIONS.map((l) => [l, LOCATION_LABELS[l]] as const), ["COSTA_BRAVA", "Toda la Costa Brava"] as const];

function CheckGroup({ name, options, selected }: { name: string; options: ReadonlyArray<readonly [string, string]>; selected: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([value, text]) => (
        <label key={value} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-sm has-[:checked]:border-ink-800 has-[:checked]:bg-ink-800 has-[:checked]:text-white">
          <input type="checkbox" name={name} value={value} defaultChecked={selected.includes(value)} className="sr-only" />
          {text}
        </label>
      ))}
    </div>
  );
}

export function AgencyForm({ agency }: { agency?: AgencyValues }) {
  const action = saveAgencyAction.bind(null, agency?.id ?? null);
  const [state, formAction] = useActionState<AgencyFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="name">Nombre</label>
          <input id="name" name="name" required defaultValue={agency?.name} className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required defaultValue={agency?.email} className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="phone">Teléfono</label>
          <input id="phone" name="phone" required defaultValue={agency?.phone} className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="contactName">Persona de contacto</label>
          <input id="contactName" name="contactName" defaultValue={agency?.contactName ?? ""} className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="partnerType">Tipo de colaborador</label>
          <select id="partnerType" name="partnerType" defaultValue={agency?.partnerType ?? "INMOBILIARIA"} className="field">
            {Object.entries(PARTNER_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="status">Estado de la colaboración</label>
          <select id="status" name="status" defaultValue={agency?.status ?? "PROSPECT"} className="field">
            <option value="PROSPECT">En conversaciones · no recibe oportunidades</option>
            <option value="ACTIVE">Activa · puede recibir oportunidades</option>
            <option value="PAUSED">Pausada · no recibe oportunidades</option>
            <option value="ENDED">Finalizada</option>
          </select>
        </div>
      </div>
      <div>
        <p className="field-label">Servicios que presta</p>
        <CheckGroup name="services" options={SERVICE_OPTIONS} selected={csv(agency?.services ?? "SELL")} />
      </div>
      <div>
        <p className="field-label">Provincias donde opera</p>
        <p className="mb-2 text-xs text-ink-400">Si no marcas ninguna, se considera de ámbito nacional.</p>
        <CheckGroup name="provinces" options={PROVINCES.filter((p) => isPortalProvince(p.code)).sort((a, b) => a.name.localeCompare(b.name, "es")).map((p) => [p.code, p.name] as const)} selected={csv(agency?.provinces)} />
      </div>
      <div>
        <label className="field-label" htmlFor="municipalities">Municipios concretos (opcional)</label>
        <input id="municipalities" name="municipalities" defaultValue={agency?.municipalities ?? ""} placeholder="Ej.: Barcelona, Badalona, L'Hospitalet de Llobregat" className="field" />
      </div>
      <div>
        <label className="field-label" htmlFor="agreementTerms">Condiciones comerciales acordadas</label>
        <textarea id="agreementTerms" name="agreementTerms" rows={3} defaultValue={agency?.agreementTerms ?? ""} placeholder="Lo acordado por escrito (honorarios, plazos, forma de derivar los contactos…)" className="field" />
        <p className="mt-1 text-xs text-ink-400">Solo informativo: la plataforma no calcula ni cobra comisiones.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="monthlyFee">Cuota mensual acordada (€, si la hay)</label>
          <input id="monthlyFee" name="monthlyFee" type="number" min={0} defaultValue={agency?.monthlyFee ?? 0} className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="pricePerAppointment">Importe por oportunidad (€, si lo hay)</label>
          <input id="pricePerAppointment" name="pricePerAppointment" type="number" min={0} defaultValue={agency?.pricePerAppointment ?? 0} className="field" />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="notes">Notas internas</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={agency?.notes ?? ""} className="field" />
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-ink-500">Zonas de la Costa Brava (formulario antiguo, opcional)</summary>
        <div className="mt-2">
          <CheckGroup name="zones" options={ZONE_OPTIONS} selected={csv(agency?.zones)} />
        </div>
      </details>
      <div>
        <p className="field-label">Idiomas</p>
        <CheckGroup name="languages" options={LANGUAGES.map((l) => [l, LANGUAGE_NAMES[l]] as const)} selected={csv(agency?.languages ?? "es")} />
      </div>
      <div>
        <p className="field-label">Tipos de propiedad</p>
        <CheckGroup name="propertyTypes" options={PROPERTY_TYPES.map((t) => [t, PROPERTY_LABELS[t]] as const)} selected={csv(agency?.propertyTypes ?? "APARTMENT,HOUSE")} />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton size="lg" pendingLabel="Guardando…">
        {agency?.id ? "Guardar cambios" : "Crear colaborador"}
      </SubmitButton>
    </form>
  );
}
