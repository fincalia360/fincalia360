"use client";

// Formulario de alta y edición de inmuebles. Lo usan el panel de FINCALIA360 y la Zona inmobiliarias
// (cada uno le pasa su propia acción de servidor, que es la que comprueba los permisos).
import { useEffect, useState } from "react";
import { useActionForm } from "@/lib/useActionForm";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  AUTHORIZATION_TYPES,
  CONDITIONS,
  ENERGY_RATINGS,
  FEATURES,
  PROPERTY_TYPES,
  RENTAL_TYPES,
} from "@/services/listings/catalog";

export type FormState = { ok?: boolean; error?: string; field?: string; notice?: string };
type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export interface ListingValues {
  operation?: string;
  title?: string;
  description?: string;
  propertyType?: string;
  price?: number;
  communityFee?: number | null;
  provinceCode?: string;
  municipality?: string;
  zone?: string | null;
  postalCode?: string | null;
  address?: string | null;
  cadastralRef?: string | null;
  builtArea?: number | null;
  usefulArea?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floor?: string | null;
  yearBuilt?: number | null;
  condition?: string | null;
  features?: string;
  energyRating?: string | null;
  energyConsumption?: number | null;
  energyEmissions?: number | null;
  rentalType?: string | null;
  depositMonths?: number | null;
  minTermMonths?: number | null;
  availableFrom?: Date | null;
  rentConditions?: string | null;
  rentalRegistry?: string | null;
  authorizationType?: string | null;
  authorizationDate?: Date | null;
  checkData?: boolean;
  checkAuthorization?: boolean;
  checkEnergy?: boolean;
  checkLegalRent?: boolean;
  ownerContactId?: string | null;
}

const dateValue = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const num = (v?: number | null) => (v == null ? "" : String(v));

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-sand-200 bg-white p-5">
      <legend className="sr-only">{title}</legend>
      <h2 className="text-[15px] font-semibold text-ink-800">{title}</h2>
      {description && <p className="mt-0.5 text-[13px] text-ink-400">{description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "block sm:col-span-2" : "block"}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

function Check({ name, defaultChecked, children }: { name: string; defaultChecked?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-ink-700 sm:col-span-2">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand-300" />
      <span>{children}</span>
    </label>
  );
}

export function ListingForm({
  action,
  values = {},
  provinces,
  ownerContacts,
  submitLabel,
  agencyMode = false,
}: {
  action: Action;
  values?: ListingValues;
  provinces: { code: string; name: string }[];
  ownerContacts?: { id: string; name: string }[];
  submitLabel: string;
  agencyMode?: boolean;
}) {
  const [state, onSubmit, pending] = useActionForm(action, {});
  const [operation, setOperation] = useState(values.operation ?? "SALE");
  const features = new Set((values.features ?? "").split(",").filter(Boolean));
  // Municipios oficiales (INE) de la provincia elegida: el nombre coincide con el del buscador del portal
  const [provinceCode, setProvinceCode] = useState(values.provinceCode ?? "");
  const [municipalityOptions, setMunicipalityOptions] = useState<string[]>([]);
  useEffect(() => {
    setMunicipalityOptions([]);
    if (!provinceCode) return;
    let cancelled = false;
    fetch(`/api/estudio/municipios?provincia=${provinceCode}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { municipalities?: { name: string }[] } | null) => {
        if (!cancelled && d?.municipalities) setMunicipalityOptions(d.municipalities.map((m) => m.name));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [provinceCode]);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Section title="Operación y precio">
        <div className="sm:col-span-2">
          <span className="field-label">Operación</span>
          <div className="inline-flex rounded-full bg-sand-100 p-1 text-sm font-medium">
            {(["SALE", "RENT"] as const).map((op) => (
              <label key={op} className={`cursor-pointer rounded-full px-5 py-1.5 ${operation === op ? "bg-white text-ink-800 shadow-sm" : "text-ink-500"}`}>
                <input type="radio" name="operation" value={op} checked={operation === op} onChange={() => setOperation(op)} className="sr-only" />
                {op === "SALE" ? "Venta" : "Alquiler"}
              </label>
            ))}
          </div>
        </div>
        <Field label={operation === "RENT" ? "Renta mensual (€)" : "Precio de venta (€)"}>
          <input name="price" type="number" min={1} step={1} required defaultValue={num(values.price)} className="field" />
        </Field>
        <Field label="Gastos de comunidad (€/mes)" hint="Opcional">
          <input name="communityFee" type="number" min={0} step={1} defaultValue={num(values.communityFee)} className="field" />
        </Field>
        <Field label="Tipo de inmueble">
          <select name="propertyType" defaultValue={values.propertyType ?? "PISO"} className="field">
            {Object.entries(PROPERTY_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado del inmueble">
          <select name="condition" defaultValue={values.condition ?? ""} className="field">
            <option value="">Sin indicar</option>
            {Object.entries(CONDITIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Ubicación" description="La dirección exacta y la referencia catastral son privadas: no se muestran en la web.">
        <Field label="Provincia">
          <select name="provinceCode" value={provinceCode} onChange={(e) => setProvinceCode(e.target.value)} required className="field">
            <option value="">Elige la provincia</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Municipio" hint={provinceCode ? "Elige el nombre oficial de la lista" : "Elige antes la provincia"}>
          <input name="municipality" required maxLength={80} defaultValue={values.municipality ?? ""} list="municipios-anuncio" autoComplete="off" className="field" />
          <datalist id="municipios-anuncio">
            {municipalityOptions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label="Zona o barrio" hint="Se muestra en el anuncio">
          <input name="zone" maxLength={80} defaultValue={values.zone ?? ""} className="field" />
        </Field>
        <Field label="Código postal">
          <input name="postalCode" inputMode="numeric" maxLength={5} defaultValue={values.postalCode ?? ""} className="field" />
        </Field>
        <Field label="Dirección (privada)">
          <input name="address" maxLength={160} defaultValue={values.address ?? ""} className="field" />
        </Field>
        <Field label="Referencia catastral (privada)">
          <input name="cadastralRef" maxLength={24} defaultValue={values.cadastralRef ?? ""} className="field uppercase" />
        </Field>
      </Section>

      <Section title="Características">
        <Field label="Superficie construida (m²)">
          <input name="builtArea" type="number" min={0} defaultValue={num(values.builtArea)} className="field" />
        </Field>
        <Field label="Superficie útil (m²)" hint="Opcional">
          <input name="usefulArea" type="number" min={0} defaultValue={num(values.usefulArea)} className="field" />
        </Field>
        <Field label="Habitaciones">
          <input name="bedrooms" type="number" min={0} max={50} defaultValue={num(values.bedrooms)} className="field" />
        </Field>
        <Field label="Baños">
          <input name="bathrooms" type="number" min={0} max={50} defaultValue={num(values.bathrooms)} className="field" />
        </Field>
        <Field label="Planta" hint="Ej.: 3ª, bajo, ático">
          <input name="floor" maxLength={30} defaultValue={values.floor ?? ""} className="field" />
        </Field>
        <Field label="Año de construcción">
          <input name="yearBuilt" type="number" min={1500} max={2100} defaultValue={num(values.yearBuilt)} className="field" />
        </Field>
        <div className="sm:col-span-2">
          <span className="field-label">Equipamiento</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(FEATURES).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" name="features" value={k} defaultChecked={features.has(k)} className="h-4 w-4 rounded border-sand-300" />
                {v}
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Anuncio">
        <Field label="Título" wide hint="Entre 10 y 110 caracteres. Ej.: Piso reformado con terraza junto al centro">
          <input name="title" required minLength={10} maxLength={110} defaultValue={values.title ?? ""} className="field" />
        </Field>
        <Field label="Descripción" wide hint="Al menos 80 caracteres para poder publicar. Describe el inmueble con datos reales.">
          <textarea name="description" rows={7} maxLength={6000} defaultValue={values.description ?? ""} className="field" />
        </Field>
      </Section>

      <Section title="Certificado energético" description="Obligatorio indicarlo en todo anuncio de venta o alquiler.">
        <Field label="Calificación">
          <select name="energyRating" defaultValue={values.energyRating ?? ""} className="field">
            <option value="">Sin indicar</option>
            {Object.entries(ENERGY_RATINGS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <div />
        <Field label="Consumo (kWh/m² año)" hint="Opcional">
          <input name="energyConsumption" type="number" step="0.1" min={0} defaultValue={num(values.energyConsumption)} className="field" />
        </Field>
        <Field label="Emisiones (kg CO₂/m² año)" hint="Opcional">
          <input name="energyEmissions" type="number" step="0.1" min={0} defaultValue={num(values.energyEmissions)} className="field" />
        </Field>
      </Section>

      {operation === "RENT" && (
        <Section title="Condiciones del alquiler" description="Revisa la normativa aplicable al inmueble (zona tensionada, fianza, gastos) antes de publicar.">
          <Field label="Tipo de alquiler">
            <select name="rentalType" defaultValue={values.rentalType ?? ""} className="field">
              <option value="">Elige</option>
              {Object.entries(RENTAL_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fianza (meses)">
            <input name="depositMonths" type="number" min={0} max={12} defaultValue={num(values.depositMonths)} className="field" />
          </Field>
          <Field label="Duración mínima (meses)" hint="Opcional">
            <input name="minTermMonths" type="number" min={0} max={120} defaultValue={num(values.minTermMonths)} className="field" />
          </Field>
          <Field label="Disponible desde" hint="Opcional">
            <input name="availableFrom" type="date" defaultValue={dateValue(values.availableFrom)} className="field" />
          </Field>
          <Field label="Nº Registro Único de Arrendamientos" hint="Obligatorio en alquiler de temporada" wide>
            <input name="rentalRegistry" maxLength={60} defaultValue={values.rentalRegistry ?? ""} className="field" />
          </Field>
          <Field label="Otras condiciones" hint="Gastos incluidos, mascotas, garantías adicionales… (dentro de lo que permite la ley)" wide>
            <textarea name="rentConditions" rows={3} maxLength={1500} defaultValue={values.rentConditions ?? ""} className="field" />
          </Field>
          <Check name="checkLegalRent" defaultChecked={values.checkLegalRent}>
            He revisado la normativa de alquiler aplicable a este inmueble (zona de mercado tensionado, límite de renta, fianza y gastos).
          </Check>
        </Section>
      )}

      <Section title="Autorización y comprobaciones" description="Nada se publica sin estas comprobaciones.">
        {agencyMode && ownerContacts && (
          <Field label="Propietario (contacto de tu CRM)" hint="Opcional" wide>
            <select name="ownerContactId" defaultValue={values.ownerContactId ?? ""} className="field">
              <option value="">Sin asociar</option>
              {ownerContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Autorización del propietario">
          <select name="authorizationType" defaultValue={values.authorizationType ?? ""} className="field">
            <option value="">Sin indicar</option>
            {Object.entries(AUTHORIZATION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha de la autorización">
          <input name="authorizationDate" type="date" defaultValue={dateValue(values.authorizationDate)} className="field" />
        </Field>
        <Check name="checkAuthorization" defaultChecked={values.checkAuthorization}>
          Tengo la autorización firmada del propietario para comercializar y publicar este inmueble.
        </Check>
        <Check name="checkEnergy" defaultChecked={values.checkEnergy}>
          El certificado energético indicado es correcto (o está en trámite o el inmueble está exento).
        </Check>
        <Check name="checkData" defaultChecked={values.checkData}>
          He comprobado que los datos del anuncio (superficie, precio, características y fotos) son reales y están actualizados.
        </Check>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-sand-200 bg-sand-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}
        </Button>
        {state.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && !pending && (
          <p className={state.notice ? "text-sm text-amber-700" : "text-sm text-pine-600"} role="status">
            {state.notice ?? "Cambios guardados"}
          </p>
        )}
      </div>
    </form>
  );
}
