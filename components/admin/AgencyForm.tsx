"use client";

import { useActionState } from "react";
import { saveAgencyAction, type AgencyFormState } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { LANGUAGE_NAMES, LOCATION_LABELS, PROPERTY_LABELS } from "@/lib/labels";
import { csv } from "@/lib/utils";
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
}

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
          <label className="field-label" htmlFor="monthlyFee">Precio mensual (€)</label>
          <input id="monthlyFee" name="monthlyFee" type="number" min={0} defaultValue={agency?.monthlyFee ?? 250} className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="pricePerAppointment">Precio por cita (€)</label>
          <input id="pricePerAppointment" name="pricePerAppointment" type="number" min={0} defaultValue={agency?.pricePerAppointment ?? 150} className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="status">Estado</label>
          <select id="status" name="status" defaultValue={agency?.status ?? "ACTIVE"} className="field">
            <option value="ACTIVE">ACTIVE · recibe leads</option>
            <option value="PAUSED">PAUSED · no recibe leads</option>
          </select>
        </div>
      </div>
      <div>
        <p className="field-label">Zonas</p>
        <CheckGroup name="zones" options={ZONE_OPTIONS} selected={csv(agency?.zones)} />
      </div>
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
        {agency?.id ? "Guardar cambios" : "Crear inmobiliaria"}
      </SubmitButton>
    </form>
  );
}
