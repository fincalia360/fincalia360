"use client";

// Formulario de alta y edición de anuncios. Lo usan el panel de FINCALIA360 y la Zona inmobiliarias
// (cada uno le pasa su propia acción de servidor, que es la que comprueba los permisos).
// Los campos cambian según el tipo de inmueble: vivienda, local u oficina, garaje, terreno, amarre u otros.
import { useEffect, useRef, useState } from "react";
import { useActionForm } from "@/lib/useActionForm";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  AUTHORIZATION_TYPES,
  CONDITIONS,
  ENERGY_RATINGS,
  FEATURES_BY_KIND,
  LAND_CLASSIFICATIONS,
  LAND_USES,
  MOORING_TYPES,
  PROPERTY_GROUPS,
  PROPERTY_TYPES,
  RENTAL_TYPES,
  RENT_PERIODS,
  kindOf,
  needsEnergyCertificate,
  type FieldKind,
} from "@/services/listings/catalog";

export type FormState = { ok?: boolean; error?: string; field?: string; notice?: string };
type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
export type AiCopyAction = (
  raw: Record<string, unknown>,
  mode: "ALL" | "TITLE" | "DESCRIPTION",
) => Promise<{ ok: boolean; error?: string; warnings?: string[]; copy?: Partial<Record<"title" | "description" | "seoTitle" | "seoDescription" | "slugText", string>> }>;

export interface ListingValues {
  category?: string;
  portName?: string | null;
  berthLength?: number | null;
  berthWidth?: number | null;
  maxBoatLength?: number | null;
  maxBoatBeam?: number | null;
  berthDepth?: number | null;
  mooringType?: string | null;
  rentPeriod?: string | null;
  concessionEnd?: number | null;
  extraInfo?: string | null;
  distribution?: string | null;
  landClassification?: string | null;
  landUse?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  slugText?: string | null;
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

function Select({ name, value, options, empty = "Sin indicar" }: { name: string; value?: string | null; options: Record<string, string>; empty?: string }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="field">
      <option value="">{empty}</option>
      {Object.entries(options).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

const FEATURES_TITLE: Record<FieldKind, string> = {
  DWELLING: "Equipamiento",
  COMMERCIAL: "Características comerciales",
  GARAGE: "Características de la plaza",
  LAND: "Servicios del terreno",
  MOORING: "Servicios e instalaciones",
  OTHER: "Equipamiento",
};

export function ListingForm({
  action,
  values = {},
  provinces,
  ownerContacts,
  submitLabel,
  agencyMode = false,
  category = "HOME",
  aiAction,
}: {
  /** Tipo inicial al crear (los amarres se crean desde «Nuevo amarre»). */
  category?: "HOME" | "MOORING";
  action: Action;
  values?: ListingValues;
  provinces: { code: string; name: string }[];
  ownerContacts?: { id: string; name: string }[];
  submitLabel: string;
  agencyMode?: boolean;
  /** IA de redacción (solo en el panel de administración). */
  aiAction?: AiCopyAction;
}) {
  const [state, onSubmit, pending] = useActionForm(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [operation, setOperation] = useState(values.operation ?? "SALE");
  const [propertyType, setPropertyType] = useState(values.propertyType ?? (category === "MOORING" ? "AMARRE" : "PISO"));
  const kind = kindOf({ propertyType });
  const mooring = kind === "MOORING";
  const rent = operation === "RENT";
  const energy = needsEnergyCertificate(kind) || kind === "OTHER";
  const features = new Set((values.features ?? "").split(",").filter(Boolean));
  // Municipios oficiales (INE) de la provincia elegida: el nombre coincide con el del buscador del portal
  const [provinceCode, setProvinceCode] = useState(values.provinceCode ?? "");
  const [municipalityOptions, setMunicipalityOptions] = useState<string[]>([]);
  const [ai, setAi] = useState<{ busy: "ALL" | "TITLE" | "DESCRIPTION" | null; error?: string; warnings?: string[]; done?: boolean }>({ busy: null });

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

  async function runAi(mode: "ALL" | "TITLE" | "DESCRIPTION") {
    if (!aiAction || !formRef.current) return;
    const fd = new FormData(formRef.current);
    const raw: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) if (typeof v === "string" && k !== "features") raw[k] = v;
    raw.features = fd.getAll("features").map(String);
    setAi({ busy: mode });
    try {
      const res = await aiAction(raw, mode);
      if (!res.ok || !res.copy) return setAi({ busy: null, error: res.error ?? "No se ha podido generar el texto" });
      const form = formRef.current;
      for (const [name, value] of Object.entries(res.copy)) {
        const el = form.elements.namedItem(name);
        if (value && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) el.value = value;
      }
      setAi({ busy: null, warnings: res.warnings, done: true });
    } catch {
      setAi({ busy: null, error: "El servicio de IA no ha respondido. Inténtalo de nuevo o redacta el anuncio a mano." });
    }
  }

  const sizeLabel = kind === "LAND" ? "Superficie del terreno (m²)" : kind === "GARAGE" ? "Superficie (m²)" : "Superficie construida (m²)";
  const featureOptions = FEATURES_BY_KIND[kind];

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="category" value={mooring ? "MOORING" : "HOME"} />
      <Section title="Operación, tipo y precio">
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
        <Field label="Tipo de inmueble" hint="Los campos del formulario se adaptan al tipo elegido">
          <select name="propertyType" value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="field">
            {Object.entries(PROPERTY_GROUPS).map(([g, group]) => (
              <optgroup key={g} label={group.label}>
                {group.types.map((t) => (
                  <option key={t} value={t}>
                    {t === "AMARRE" ? "Amarre náutico" : PROPERTY_TYPES[t as keyof typeof PROPERTY_TYPES]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label={rent ? (mooring ? "Precio del alquiler (€)" : "Renta mensual (€)") : "Precio de venta (€)"}>
          <input name="price" type="number" min={1} step={1} required defaultValue={num(values.price)} className="field" />
        </Field>
        {mooring && rent && (
          <Field label="Periodicidad del alquiler">
            <select name="rentPeriod" defaultValue={values.rentPeriod ?? "MONTH"} className="field">
              {Object.entries(RENT_PERIODS).map(([k, v]) => (
                <option key={k} value={k}>
                  Por {v}
                </option>
              ))}
            </select>
          </Field>
        )}
        {kind !== "LAND" && (
          <Field label={mooring ? "Gastos de mantenimiento (€/mes)" : "Gastos de comunidad (€/mes)"} hint="Opcional">
            <input name="communityFee" type="number" min={0} step={1} defaultValue={num(values.communityFee)} className="field" />
          </Field>
        )}
        {mooring ? (
          <>
            <Field label="Tipo de amarre">
              <Select name="mooringType" value={values.mooringType} options={MOORING_TYPES} />
            </Field>
            <Field label="Fin de la concesión o del derecho de uso" hint="Año. Opcional, pero muy útil para el comprador">
              <input name="concessionEnd" type="number" min={2000} max={2150} defaultValue={num(values.concessionEnd)} className="field" />
            </Field>
          </>
        ) : (
          kind !== "LAND" && (
            <Field label="Estado">
              <Select name="condition" value={values.condition} options={CONDITIONS} />
            </Field>
          )
        )}
      </Section>

      <Section
        title="Ubicación"
        description={mooring ? "El número exacto del amarre es privado: no se muestra en la web." : "La dirección exacta y la referencia catastral son privadas: no se muestran en la web."}
      >
        {mooring && (
          <Field label="Puerto deportivo o instalación náutica" wide hint="Ej.: Port de Roses, Marina Port Vell, Club Nàutic L'Escala">
            <input name="portName" required maxLength={100} defaultValue={values.portName ?? ""} className="field" />
          </Field>
        )}
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
        <Field label={mooring ? "Ubicación en el puerto" : "Zona o barrio"} hint="Se muestra en el anuncio">
          <input name="zone" maxLength={80} defaultValue={values.zone ?? ""} className="field" />
        </Field>
        <Field label="Código postal">
          <input name="postalCode" inputMode="numeric" maxLength={5} defaultValue={values.postalCode ?? ""} className="field" />
        </Field>
        <Field label={mooring ? "Número de amarre (privado)" : "Dirección (privada)"}>
          <input name="address" maxLength={160} defaultValue={values.address ?? ""} className="field" />
        </Field>
        {!mooring && (
          <Field label="Referencia catastral (privada)">
            <input name="cadastralRef" maxLength={24} defaultValue={values.cadastralRef ?? ""} className="field uppercase" />
          </Field>
        )}
      </Section>

      <Section
        title={mooring ? "Medidas y características del amarre" : "Características"}
        description={mooring || kind === "GARAGE" ? "Medidas en metros. Usa coma o punto para los decimales." : undefined}
      >
        {(mooring || kind === "GARAGE") && (
          <>
            <Field label={mooring ? "Longitud del amarre (m)" : "Largo de la plaza (m)"} hint={mooring ? undefined : "Opcional"}>
              <input name="berthLength" inputMode="decimal" required={mooring} defaultValue={num(values.berthLength)} className="field" />
            </Field>
            <Field label={mooring ? "Anchura del amarre (m)" : "Ancho de la plaza (m)"} hint={mooring ? undefined : "Opcional"}>
              <input name="berthWidth" inputMode="decimal" required={mooring} defaultValue={num(values.berthWidth)} className="field" />
            </Field>
          </>
        )}
        {mooring && (
          <>
            <Field label="Eslora máxima admitida (m)" hint="Opcional">
              <input name="maxBoatLength" inputMode="decimal" defaultValue={num(values.maxBoatLength)} className="field" />
            </Field>
            <Field label="Manga máxima admitida (m)" hint="Opcional">
              <input name="maxBoatBeam" inputMode="decimal" defaultValue={num(values.maxBoatBeam)} className="field" />
            </Field>
            <Field label="Calado (m)" hint="Opcional">
              <input name="berthDepth" inputMode="decimal" defaultValue={num(values.berthDepth)} className="field" />
            </Field>
          </>
        )}
        <Field label={mooring ? "Superficie (m²)" : sizeLabel} hint={mooring || kind === "GARAGE" ? "Opcional, si corresponde" : undefined}>
          <input name="builtArea" type="number" min={0} defaultValue={num(values.builtArea)} className="field" />
        </Field>
        {(kind === "DWELLING" || kind === "COMMERCIAL" || kind === "OTHER") && (
          <Field label="Superficie útil (m²)" hint="Opcional">
            <input name="usefulArea" type="number" min={0} defaultValue={num(values.usefulArea)} className="field" />
          </Field>
        )}
        {(kind === "DWELLING" || kind === "OTHER") && (
          <Field label="Habitaciones">
            <input name="bedrooms" type="number" min={0} max={50} defaultValue={num(values.bedrooms)} className="field" />
          </Field>
        )}
        {(kind === "DWELLING" || kind === "COMMERCIAL" || kind === "OTHER") && (
          <Field label={kind === "COMMERCIAL" ? "Aseos" : "Baños"}>
            <input name="bathrooms" type="number" min={0} max={50} defaultValue={num(values.bathrooms)} className="field" />
          </Field>
        )}
        {kind !== "LAND" && !mooring && (
          <Field label="Planta" hint={kind === "GARAGE" ? "Ej.: -1, -2, baja" : "Ej.: 3ª, bajo, ático"}>
            <input name="floor" maxLength={30} defaultValue={values.floor ?? ""} className="field" />
          </Field>
        )}
        {(kind === "DWELLING" || kind === "COMMERCIAL" || kind === "OTHER") && (
          <Field label="Año de construcción">
            <input name="yearBuilt" type="number" min={1500} max={2100} defaultValue={num(values.yearBuilt)} className="field" />
          </Field>
        )}
        {kind === "COMMERCIAL" && (
          <Field label="Distribución" wide hint="Ej.: planta diáfana, 3 despachos, sala de reuniones y almacén. Opcional">
            <textarea name="distribution" rows={2} maxLength={1000} defaultValue={values.distribution ?? ""} className="field" />
          </Field>
        )}
        {kind === "LAND" && (
          <>
            <Field label="Clasificación urbanística" hint="Solo si consta en información verificada (ayuntamiento, nota simple…)">
              <Select name="landClassification" value={values.landClassification} options={LAND_CLASSIFICATIONS} />
            </Field>
            <Field label="Uso permitido" hint="Solo si está verificado">
              <Select name="landUse" value={values.landUse} options={LAND_USES} />
            </Field>
          </>
        )}
        {mooring && (
          <Field label="Disponible desde" hint="Opcional">
            <input name="availableFrom" type="date" defaultValue={dateValue(values.availableFrom)} className="field" />
          </Field>
        )}
        <div className="sm:col-span-2">
          <span className="field-label">{FEATURES_TITLE[kind]}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(featureOptions).map(([k, v]) => (
              <label key={`${kind}-${k}`} className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" name="features" value={k} defaultChecked={features.has(k)} className="h-4 w-4 rounded border-sand-300" />
                {v}
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Anuncio">
        {aiAction && (
          <div className="rounded-xl border border-terracotta-100 bg-terracotta-50 p-3 sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => runAi("ALL")}
                disabled={ai.busy !== null}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-terracotta-500 px-4 text-sm font-medium text-white hover:bg-terracotta-600 disabled:opacity-60"
              >
                {ai.busy === "ALL" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {ai.done ? "Regenerar texto con IA" : "Generar texto con IA"}
              </button>
              <button
                type="button"
                onClick={() => runAi("TITLE")}
                disabled={ai.busy !== null}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-terracotta-500 px-3 text-sm text-terracotta-700 hover:bg-white disabled:opacity-60"
              >
                {ai.busy === "TITLE" && <Loader2 className="h-4 w-4 animate-spin" />} Mejorar título
              </button>
              <button
                type="button"
                onClick={() => runAi("DESCRIPTION")}
                disabled={ai.busy !== null}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-terracotta-500 px-3 text-sm text-terracotta-700 hover:bg-white disabled:opacity-60"
              >
                {ai.busy === "DESCRIPTION" && <Loader2 className="h-4 w-4 animate-spin" />} Mejorar descripción
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-500">
              La IA redacta con los datos de este formulario (y tu texto, si lo has escrito). Revisa y edita el resultado: no se guarda hasta que pulses «{submitLabel}» y no
              se publica hasta que pulses «Publicar».
            </p>
            {ai.error && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {ai.error}
              </p>
            )}
            {ai.done && !ai.error && (
              <p className="mt-2 text-sm text-pine-600" role="status">
                Texto propuesto en los campos de abajo. Revísalo antes de guardar.
              </p>
            )}
            {ai.warnings?.map((w) => (
              <p key={w} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
                {w}
              </p>
            ))}
          </div>
        )}
        <Field
          label="Título"
          wide
          hint={mooring ? "Entre 10 y 110 caracteres. Ej.: Amarre de 12 x 4 m en Port de Roses" : "Entre 10 y 110 caracteres. Ej.: Piso en venta de 3 habitaciones en Girona"}
        >
          <input name="title" required minLength={10} maxLength={110} defaultValue={values.title ?? ""} className="field" />
        </Field>
        <Field label="Descripción" wide hint="Al menos 80 caracteres para poder publicar. Describe el inmueble con datos reales.">
          <textarea name="description" rows={8} maxLength={6000} defaultValue={values.description ?? ""} className="field" />
        </Field>
        <Field
          label="Información adicional"
          wide
          hint={mooring ? "Opcional: tasas portuarias, condiciones de la concesión, acceso, normas del puerto…" : "Opcional: lo que quieras añadir para el comprador o el inquilino"}
        >
          <textarea name="extraInfo" rows={3} maxLength={3000} defaultValue={values.extraInfo ?? ""} className="field" />
        </Field>
      </Section>

      <Section title="SEO (cómo aparece en Google)" description="Opcional. Si lo dejas vacío se usan el título y el principio de la descripción.">
        <Field label="Título para Google" wide hint="Hasta 60 caracteres, con tipo de inmueble, operación y municipio">
          <input name="seoTitle" maxLength={70} defaultValue={values.seoTitle ?? ""} className="field" />
        </Field>
        <Field label="Descripción para Google" wide hint="Entre 120 y 155 caracteres">
          <textarea name="seoDescription" rows={2} maxLength={170} defaultValue={values.seoDescription ?? ""} className="field" />
        </Field>
        <Field
          label="Texto de la dirección (URL)"
          wide
          hint="Ej.: piso-venta-3-habitaciones-girona. Se añade la referencia al final; si lo cambias, la dirección antigua redirige a la nueva"
        >
          <input name="slugText" maxLength={90} defaultValue={values.slugText ?? ""} className="field" />
        </Field>
      </Section>

      {energy && (
        <Section title="Certificado energético" description={kind === "OTHER" ? "Indícalo si el inmueble lo requiere." : "Obligatorio indicarlo en todo anuncio de venta o alquiler."}>
          <Field label="Calificación">
            <Select name="energyRating" value={values.energyRating} options={ENERGY_RATINGS} />
          </Field>
          <div />
          <Field label="Consumo (kWh/m² año)" hint="Opcional">
            <input name="energyConsumption" type="number" step="0.1" min={0} defaultValue={num(values.energyConsumption)} className="field" />
          </Field>
          <Field label="Emisiones (kg CO₂/m² año)" hint="Opcional">
            <input name="energyEmissions" type="number" step="0.1" min={0} defaultValue={num(values.energyEmissions)} className="field" />
          </Field>
        </Section>
      )}

      {rent && kind === "DWELLING" && (
        <Section title="Condiciones del alquiler" description="Revisa la normativa aplicable al inmueble (zona tensionada, fianza, gastos) antes de publicar.">
          <Field label="Tipo de alquiler">
            <Select name="rentalType" value={values.rentalType} options={RENTAL_TYPES} empty="Elige" />
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

      {rent && kind !== "DWELLING" && (
        <Section title="Condiciones del alquiler">
          <Field label="Fianza (meses)" hint={mooring ? "Opcional" : undefined}>
            <input name="depositMonths" type="number" min={0} max={12} defaultValue={num(values.depositMonths)} className="field" />
          </Field>
          <Field label="Duración mínima (meses)" hint="Opcional">
            <input name="minTermMonths" type="number" min={0} max={120} defaultValue={num(values.minTermMonths)} className="field" />
          </Field>
          {!mooring && (
            <Field label="Disponible desde" hint="Opcional">
              <input name="availableFrom" type="date" defaultValue={dateValue(values.availableFrom)} className="field" />
            </Field>
          )}
          <Field label="Otras condiciones" hint={mooring ? "Seguro de la embarcación, documentación exigida, uso de servicios…" : "Gastos, garantías, uso permitido…"} wide>
            <textarea name="rentConditions" rows={3} maxLength={1500} defaultValue={values.rentConditions ?? ""} className="field" />
          </Field>
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
        <Field label={mooring ? "Autorización del titular" : "Autorización del propietario"}>
          <Select name="authorizationType" value={values.authorizationType} options={AUTHORIZATION_TYPES} />
        </Field>
        <Field label="Fecha de la autorización">
          <input name="authorizationDate" type="date" defaultValue={dateValue(values.authorizationDate)} className="field" />
        </Field>
        <Check name="checkAuthorization" defaultChecked={values.checkAuthorization}>
          {mooring
            ? "Tengo la autorización firmada del titular del amarre (o de su derecho de uso) para comercializarlo y publicarlo."
            : "Tengo la autorización firmada del propietario para comercializar y publicar este inmueble."}
        </Check>
        {energy && (
          <Check name="checkEnergy" defaultChecked={values.checkEnergy}>
            El certificado energético indicado es correcto (o está en trámite o el inmueble está exento).
          </Check>
        )}
        <Check name="checkData" defaultChecked={values.checkData}>
          He comprobado que los datos del anuncio (medidas, precio, características y fotos) son reales y están actualizados.
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
