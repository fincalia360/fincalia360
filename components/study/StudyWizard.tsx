"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink, Info, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { CCAA, PROVINCES, postalCodeMatchesProvince } from "@/services/study/geo";
import {
  CONDITION_LABELS,
  CURRENT_USE_LABELS,
  GOAL_LABELS,
  HORIZONS,
  LANDLORD_LABELS,
  OUTDOOR_LABELS,
  OWNER_VALUATION_LABELS,
  PROPERTY_KIND_LABELS,
  TAX_RESIDENCE_LABELS,
  TENANCY_ISSUE_LABELS,
  type CurrentUse,
  type LandlordBracket,
  type PropertyKind,
  type TaxResidence,
} from "@/services/study/types";
import { ChoiceGroup, Field, NumberInput, Toggle } from "./fields";

interface Municipality {
  name: string;
  code: string;
  ineValueId: number;
  population: number | null;
}

type Form = {
  ccaaCode: string;
  provinceCode: string;
  municipalityCode: string;
  municipalityName: string;
  ineValueId: number | null;
  postalCode: string;
  address: string;
  cadastralRef: string;
  kind: PropertyKind | null;
  sqm: string;
  bedrooms: string;
  bathrooms: string;
  floor: string;
  elevator: "YES" | "NO" | "";
  outdoor: "NONE" | "BALCONY" | "TERRACE" | "GARDEN";
  parking: boolean;
  storage: boolean;
  condition: "NEW" | "GOOD" | "TO_REFORM";
  yearBuilt: string;
  currentUse: CurrentUse | null;
  purchasePrice: string;
  purchaseYear: string;
  purchaseCosts: string;
  improvementsCost: string;
  mortgageBalance: string;
  mortgageRate: string;
  mortgageYearsLeft: string;
  mortgageMonthlyPayment: string;
  communityFeesYear: string;
  ibiYear: string;
  insuranceYear: string;
  maintenanceYear: string;
  otherCostsYear: string;
  cadastralValueTotal: string;
  cadastralValueLand: string;
  ownerValuationKind: "" | "APPRAISAL" | "CADASTRAL_REFERENCE_VALUE" | "OFFER";
  ownerValuationValue: string;
  goal: "SELL_SOON" | "INCOME" | "KEEP_WEALTH" | "UNSURE" | null;
  horizon: number;
  currentRent: string;
  tenancyIssue: "NONE" | "ARREARS" | "LITIGATION" | "POSSESSION_RECOVERY" | "UNDISCLOSED";
  rentalContractStart: string;
  landlordBracket: LandlordBracket;
  rentedLast5Years: "YES" | "NO" | "UNKNOWN";
  previousRent: string;
  taxResidence: TaxResidence;
  over65: "YES" | "NO" | "UNDISCLOSED";
  marginalRate: string;
};

const INITIAL: Form = {
  ccaaCode: "",
  provinceCode: "",
  municipalityCode: "",
  municipalityName: "",
  ineValueId: null,
  postalCode: "",
  address: "",
  cadastralRef: "",
  kind: null,
  sqm: "",
  bedrooms: "",
  bathrooms: "",
  floor: "",
  elevator: "",
  outdoor: "NONE",
  parking: false,
  storage: false,
  condition: "GOOD",
  yearBuilt: "",
  currentUse: null,
  purchasePrice: "",
  purchaseYear: "",
  purchaseCosts: "",
  improvementsCost: "",
  mortgageBalance: "",
  mortgageRate: "",
  mortgageYearsLeft: "",
  mortgageMonthlyPayment: "",
  communityFeesYear: "",
  ibiYear: "",
  insuranceYear: "",
  maintenanceYear: "",
  otherCostsYear: "",
  cadastralValueTotal: "",
  cadastralValueLand: "",
  ownerValuationKind: "",
  ownerValuationValue: "",
  goal: null,
  horizon: 5,
  currentRent: "",
  tenancyIssue: "NONE",
  rentalContractStart: "",
  landlordBracket: "UNDISCLOSED",
  rentedLast5Years: "UNKNOWN",
  previousRent: "",
  taxResidence: "ES",
  over65: "UNDISCLOSED",
  marginalRate: "",
};

const STEPS = ["Ubicación", "Características", "Situación económica", "Tu situación"];
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export function StudyWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [municipalities, setMunicipalities] = useState<Municipality[] | null>(null);
  const [muniStatus, setMuniStatus] = useState<"idle" | "loading" | "error">("idle");
  const [catastro, setCatastro] = useState<{ status: "idle" | "loading" | "ok" | "error"; message?: string; address?: string; use?: string; mapUrl?: string }>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const provinces = useMemo(
    () => (form.ccaaCode ? PROVINCES.filter((p) => p.ccaa === form.ccaaCode) : [...PROVINCES].sort((a, b) => a.name.localeCompare(b.name, "es"))),
    [form.ccaaCode],
  );

  // Municipios oficiales del INE para la provincia elegida
  useEffect(() => {
    let cancelled = false;
    setMunicipalities(null);
    if (!form.provinceCode) {
      setMuniStatus("idle");
      return;
    }
    setMuniStatus("loading");
    fetch(`/api/estudio/municipios?provincia=${form.provinceCode}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { municipalities: Municipality[] }) => {
        if (cancelled) return;
        setMunicipalities(d.municipalities);
        setMuniStatus("idle");
      })
      .catch(() => !cancelled && setMuniStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [form.provinceCode]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  async function lookupCatastro() {
    const rc = form.cadastralRef.trim().toUpperCase();
    if (!/^[0-9A-Z]{14}([0-9A-Z]{6})?$/.test(rc)) {
      setCatastro({ status: "error", message: "La referencia catastral tiene 20 caracteres (letras y números)." });
      return;
    }
    setCatastro({ status: "loading" });
    try {
      const res = await fetch(`/api/estudio/catastro?rc=${encodeURIComponent(rc)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm((f) => ({
        ...f,
        cadastralRef: data.cadastralRef,
        sqm: data.builtSqm ? String(Math.round(data.builtSqm)) : f.sqm,
        yearBuilt: data.yearBuilt ? String(data.yearBuilt) : f.yearBuilt,
        postalCode: f.postalCode || data.postalCode || "",
      }));
      setCatastro({
        status: "ok",
        address: data.address,
        use: data.use,
        mapUrl: `https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat=${data.cadastralRef.slice(0, 14)}`,
      });
    } catch (error) {
      setCatastro({ status: "error", message: (error as Error).message || "No se pudo consultar el Catastro." });
    }
  }

  function validate(s: number) {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!form.provinceCode) e.provinceCode = "Selecciona la provincia (o escribe el código postal)";
      if (!form.municipalityName.trim()) e.municipalityName = "Selecciona o escribe el municipio";
      if (!/^\d{5}$/.test(form.postalCode)) e.postalCode = "Código postal de 5 cifras";
      else if (!postalCodeMatchesProvince(form.postalCode, form.provinceCode)) e.postalCode = "Este código postal no pertenece a la provincia seleccionada";
    }
    if (s === 1) {
      if (!form.kind) e.kind = "Elige el tipo de inmueble";
      const sqm = num(form.sqm);
      if (!sqm || sqm < 15 || sqm > 5000) e.sqm = "Indica una superficie entre 15 y 5.000 m²";
      if (form.bedrooms === "") e.bedrooms = "Obligatorio";
      if (form.bathrooms === "") e.bathrooms = "Obligatorio";
      if (!form.currentUse) e.currentUse = "Indica el estado actual";
    }
    if (s === 2) {
      const land = num(form.cadastralValueLand);
      const total = num(form.cadastralValueTotal);
      if (land != null && total != null && land > total) e.cadastralValueLand = "No puede superar el valor catastral total";
      if (form.ownerValuationKind && !num(form.ownerValuationValue)) e.ownerValuationValue = "Indica el importe";
      const year = num(form.purchaseYear);
      if (year != null && (year < 1950 || year > new Date().getFullYear())) e.purchaseYear = "Año no válido";
    }
    if (s === 3) {
      if (!form.goal) e.goal = "Elige una opción";
      if (form.currentUse === "RENTED" && !num(form.currentRent)) e.currentRent = "Indica la renta mensual actual";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const next = () => validate(step) && setStep((s) => Math.min(s + 1, STEPS.length - 1));

  async function submit() {
    if (!validate(3)) return;
    setSubmitting(true);
    setErrors({});
    const body = {
      location: {
        country: "ES",
        ccaaCode: form.ccaaCode,
        provinceCode: form.provinceCode,
        municipalityName: form.municipalityName.trim(),
        municipalityCode: form.municipalityCode || null,
        ineValueId: form.ineValueId,
        postalCode: form.postalCode,
        address: form.address.trim() || null,
        cadastralRef: form.cadastralRef.trim() || null,
      },
      property: {
        kind: form.kind,
        sqm: num(form.sqm),
        bedrooms: num(form.bedrooms),
        bathrooms: num(form.bathrooms),
        floor: num(form.floor),
        elevator: form.elevator === "" ? null : form.elevator === "YES",
        outdoor: form.outdoor,
        parking: form.parking,
        storage: form.storage,
        condition: form.condition,
        yearBuilt: num(form.yearBuilt),
        currentUse: form.currentUse,
      },
      economics: {
        purchasePrice: num(form.purchasePrice),
        purchaseYear: num(form.purchaseYear),
        purchaseCosts: num(form.purchaseCosts),
        improvementsCost: num(form.improvementsCost),
        mortgageBalance: num(form.mortgageBalance),
        mortgageRate: num(form.mortgageRate),
        mortgageYearsLeft: num(form.mortgageYearsLeft),
        mortgageMonthlyPayment: num(form.mortgageMonthlyPayment),
        communityFeesYear: num(form.communityFeesYear),
        ibiYear: num(form.ibiYear),
        insuranceYear: num(form.insuranceYear),
        maintenanceYear: num(form.maintenanceYear),
        otherCostsYear: num(form.otherCostsYear),
        cadastralValueTotal: num(form.cadastralValueTotal),
        cadastralValueLand: num(form.cadastralValueLand),
        ownerValuation: form.ownerValuationKind ? { kind: form.ownerValuationKind, value: num(form.ownerValuationValue) } : null,
      },
      owner: {
        goal: form.goal,
        horizon: form.horizon,
        currentRent: form.currentUse === "RENTED" ? num(form.currentRent) : null,
        tenancyIssue: form.currentUse === "RENTED" ? form.tenancyIssue : "NONE",
        rentalContractStart: form.currentUse === "RENTED" && /^\d{4}-\d{2}$/.test(form.rentalContractStart) ? form.rentalContractStart : null,
        landlordBracket: form.landlordBracket,
        rentedLast5Years: form.currentUse === "RENTED" ? "YES" : form.rentedLast5Years,
        previousRent: form.currentUse !== "RENTED" && form.rentedLast5Years === "YES" ? num(form.previousRent) : null,
        taxResidence: form.taxResidence,
        over65: form.over65,
        marginalRate: num(form.marginalRate),
      },
    };
    try {
      const res = await fetch("/api/estudio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      router.push(`/estudio/${data.id}`);
    } catch (error) {
      setErrors({ form: (error as Error).message || "No hemos podido generar el estudio." });
      setSubmitting(false);
    }
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* Progreso */}
      <div className="mb-7">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.16em] text-ink-400">
          <span>
            Paso {step + 1} de {STEPS.length} · {STEPS[step]}
          </span>
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="inline-flex items-center gap-1 normal-case tracking-normal text-ink-500 hover:text-ink-800">
              <ArrowLeft className="h-3.5 w-3.5" /> Atrás
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1}>
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              disabled={i > step}
              onClick={() => i < step && setStep(i)}
              aria-label={`Ir al paso ${i + 1}: ${label}`}
              className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-terracotta-500" : "bg-sand-200", i < step && "cursor-pointer")}
            />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <h2 className="font-serif text-3xl font-medium text-ink-800">¿Dónde está la vivienda?</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Código postal" htmlFor="cp" error={errors.postalCode} hint="Rellena automáticamente la provincia y la comunidad.">
              <input
                id="cp"
                inputMode="numeric"
                maxLength={5}
                autoComplete="postal-code"
                className="field"
                value={form.postalCode}
                onChange={(e) => {
                  const cp = e.target.value.replace(/\D/g, "");
                  // Las dos primeras cifras del código postal identifican la provincia
                  const prov = cp.length >= 2 ? PROVINCES.find((p) => p.code === cp.slice(0, 2)) : undefined;
                  setForm((f) =>
                    prov && prov.code !== f.provinceCode
                      ? { ...f, postalCode: cp, provinceCode: prov.code, ccaaCode: prov.ccaa, municipalityCode: "", municipalityName: "", ineValueId: null }
                      : { ...f, postalCode: cp },
                  );
                  setErrors((er) => ({ ...er, postalCode: "", provinceCode: "" }));
                }}
              />
            </Field>
            <Field label="Comunidad autónoma" htmlFor="ccaa">
              <select
                id="ccaa"
                className="field"
                value={form.ccaaCode}
                onChange={(e) => {
                  const ccaa = e.target.value;
                  const inCcaa = PROVINCES.filter((p) => p.ccaa === ccaa);
                  // Si la comunidad solo tiene una provincia, se selecciona directamente
                  const provinceCode = inCcaa.length === 1 ? inCcaa[0].code : "";
                  setForm((f) => ({ ...f, ccaaCode: ccaa, provinceCode, municipalityCode: "", municipalityName: "", ineValueId: null }));
                }}
              >
                <option value="">Selecciona…</option>
                {CCAA.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Provincia" htmlFor="province" error={errors.provinceCode}>
              <select
                id="province"
                className="field"
                value={form.provinceCode}
                onChange={(e) => {
                  const prov = PROVINCES.find((p) => p.code === e.target.value);
                  setForm((f) => ({ ...f, provinceCode: e.target.value, ccaaCode: prov?.ccaa ?? f.ccaaCode, municipalityCode: "", municipalityName: "", ineValueId: null }));
                  setErrors((er) => ({ ...er, provinceCode: "" }));
                }}
              >
                <option value="">Selecciona…</option>
                {provinces.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Municipio"
              htmlFor="municipality"
              error={errors.municipalityName}
              hint={muniStatus === "loading" ? "Cargando municipios oficiales del INE…" : muniStatus === "error" ? "No se pudo cargar la lista del INE: escribe el nombre." : "Lista oficial del INE."}
            >
              {!form.provinceCode ? (
                <input id="municipality" className="field" disabled value="" readOnly placeholder="Elige antes la provincia o escribe el código postal" />
              ) : municipalities && muniStatus === "idle" ? (
                <select
                  id="municipality"
                  className="field"
                  value={form.municipalityCode}
                  onChange={(e) => {
                    const m = municipalities.find((x) => x.code === e.target.value);
                    setForm((f) => ({ ...f, municipalityCode: m?.code ?? "", municipalityName: m?.name ?? "", ineValueId: m?.ineValueId ?? null }));
                    setErrors((er) => ({ ...er, municipalityName: "" }));
                  }}
                >
                  <option value="">Selecciona…</option>
                  {municipalities.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input id="municipality" className="field" value={form.municipalityName} onChange={(e) => set("municipalityName", e.target.value)} placeholder="Municipio" />
              )}
            </Field>
            <Field label="Dirección" htmlFor="address" optional hint="Solo la usa el especialista si solicitas una valoración.">
              <input id="address" className="field" value={form.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" />
            </Field>
          </div>

          <div className="rounded-xl border border-sand-200 bg-sand-50 p-4">
            <Field
              label="Referencia catastral"
              htmlFor="rc"
              optional
              hint="Aparece en el recibo del IBI. Con ella completamos superficie y año de construcción desde el Catastro (datos públicos no protegidos)."
            >
              <div className="flex gap-2">
                <input id="rc" className="field uppercase" maxLength={20} value={form.cadastralRef} onChange={(e) => set("cadastralRef", e.target.value.toUpperCase().replace(/\s/g, ""))} />
                <Button type="button" variant="outline" onClick={lookupCatastro} disabled={!form.cadastralRef || catastro.status === "loading"} className="rounded-lg">
                  {catastro.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="hidden sm:inline">Catastro</span>
                </Button>
              </div>
            </Field>
            {catastro.status === "ok" && (
              <p className="mt-2 text-sm text-pine-600">
                {catastro.address} · uso {catastro.use}.{" "}
                <a href={catastro.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                  Ver en el mapa del Catastro <ExternalLink className="h-3 w-3" />
                </a>
                {catastro.use && catastro.use !== "Residencial" && <span className="block text-amber-700">Atención: el uso catastral no es residencial.</span>}
              </p>
            )}
            {catastro.status === "error" && <p className="mt-2 text-sm text-red-600">{catastro.message}</p>}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <h2 className="font-serif text-3xl font-medium text-ink-800">Características de la vivienda</h2>
          <Field label="Tipo de inmueble" error={errors.kind}>
            <ChoiceGroup
              name="Tipo de inmueble"
              options={(Object.keys(PROPERTY_KIND_LABELS) as PropertyKind[]).map((k) => ({ value: k, label: PROPERTY_KIND_LABELS[k] }))}
              value={form.kind}
              onChange={(v) => set("kind", v)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Superficie construida" htmlFor="sqm" error={errors.sqm}>
              <NumberInput id="sqm" value={form.sqm} onChange={(v) => set("sqm", v)} suffix="m²" />
            </Field>
            <Field label="Habitaciones" htmlFor="bedrooms" error={errors.bedrooms}>
              <NumberInput id="bedrooms" value={form.bedrooms} onChange={(v) => set("bedrooms", v)} />
            </Field>
            <Field label="Baños" htmlFor="bathrooms" error={errors.bathrooms}>
              <NumberInput id="bathrooms" value={form.bathrooms} onChange={(v) => set("bathrooms", v)} />
            </Field>
            <Field label="Planta" htmlFor="floor" optional hint="0 = bajo">
              <NumberInput id="floor" value={form.floor} onChange={(v) => set("floor", v)} min={-2} />
            </Field>
            <Field label="Año de construcción" htmlFor="year" optional>
              <NumberInput id="year" value={form.yearBuilt} onChange={(v) => set("yearBuilt", v)} min={1700} />
            </Field>
            <Field label="Ascensor" htmlFor="elevator" className="col-span-1">
              <select id="elevator" className="field" value={form.elevator} onChange={(e) => set("elevator", e.target.value as Form["elevator"])}>
                <option value="">No aplica / no sé</option>
                <option value="YES">Sí</option>
                <option value="NO">No</option>
              </select>
            </Field>
          </div>
          <Field label="Balcón, terraza o jardín">
            <ChoiceGroup
              name="Exterior"
              columns="grid-cols-2 sm:grid-cols-4"
              options={(Object.keys(OUTDOOR_LABELS) as Array<keyof typeof OUTDOOR_LABELS>).map((k) => ({ value: k, label: OUTDOOR_LABELS[k] }))}
              value={form.outdoor}
              onChange={(v) => set("outdoor", v)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Toggle label="Plaza de aparcamiento" checked={form.parking} onChange={(v) => set("parking", v)} />
            <Toggle label="Trastero" checked={form.storage} onChange={(v) => set("storage", v)} />
          </div>
          <Field label="Estado de conservación">
            <ChoiceGroup
              name="Estado"
              options={(Object.keys(CONDITION_LABELS) as Array<keyof typeof CONDITION_LABELS>).map((k) => ({ value: k, label: CONDITION_LABELS[k] }))}
              value={form.condition}
              onChange={(v) => set("condition", v)}
            />
          </Field>
          <Field label="Estado actual de la vivienda" error={errors.currentUse}>
            <ChoiceGroup
              name="Estado actual"
              options={(Object.keys(CURRENT_USE_LABELS) as CurrentUse[]).map((k) => ({ value: k, label: CURRENT_USE_LABELS[k] }))}
              value={form.currentUse}
              onChange={(v) => set("currentUse", v)}
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-serif text-3xl font-medium text-ink-800">Situación económica</h2>
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-sand-50 p-3 text-sm text-ink-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Todos los campos son opcionales. Si no conoces un importe, déjalo en blanco: usaremos una estimación marcada como «hipótesis» que podrás cambiar después.
            </p>
          </div>
          <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <legend className="col-span-full mb-1 text-sm font-semibold text-ink-700">Compra y reformas</legend>
            <Field label="Precio de compra" htmlFor="pp">
              <NumberInput id="pp" value={form.purchasePrice} onChange={(v) => set("purchasePrice", v)} suffix="€" />
            </Field>
            <Field label="Año de compra" htmlFor="py" error={errors.purchaseYear}>
              <NumberInput id="py" value={form.purchaseYear} onChange={(v) => set("purchaseYear", v)} min={1950} />
            </Field>
            <Field label="Gastos de compra" htmlFor="pc" hint="Impuestos, notaría…">
              <NumberInput id="pc" value={form.purchaseCosts} onChange={(v) => set("purchaseCosts", v)} suffix="€" />
            </Field>
            <Field label="Reformas realizadas" htmlFor="imp">
              <NumberInput id="imp" value={form.improvementsCost} onChange={(v) => set("improvementsCost", v)} suffix="€" />
            </Field>
          </fieldset>
          <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <legend className="col-span-full mb-1 text-sm font-semibold text-ink-700">Hipoteca</legend>
            <Field label="Capital pendiente" htmlFor="mb">
              <NumberInput id="mb" value={form.mortgageBalance} onChange={(v) => set("mortgageBalance", v)} suffix="€" />
            </Field>
            <Field label="Tipo de interés" htmlFor="mr">
              <NumberInput id="mr" value={form.mortgageRate} onChange={(v) => set("mortgageRate", v)} suffix="%" step="0.01" />
            </Field>
            <Field label="Años pendientes" htmlFor="my">
              <NumberInput id="my" value={form.mortgageYearsLeft} onChange={(v) => set("mortgageYearsLeft", v)} />
            </Field>
            <Field label="Cuota mensual" htmlFor="mm">
              <NumberInput id="mm" value={form.mortgageMonthlyPayment} onChange={(v) => set("mortgageMonthlyPayment", v)} suffix="€" />
            </Field>
          </fieldset>
          <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <legend className="col-span-full mb-1 text-sm font-semibold text-ink-700">Gastos anuales</legend>
            <Field label="Comunidad" htmlFor="cf">
              <NumberInput id="cf" value={form.communityFeesYear} onChange={(v) => set("communityFeesYear", v)} suffix="€/año" />
            </Field>
            <Field label="IBI" htmlFor="ibi">
              <NumberInput id="ibi" value={form.ibiYear} onChange={(v) => set("ibiYear", v)} suffix="€/año" />
            </Field>
            <Field label="Seguro" htmlFor="ins">
              <NumberInput id="ins" value={form.insuranceYear} onChange={(v) => set("insuranceYear", v)} suffix="€/año" />
            </Field>
            <Field label="Mantenimiento" htmlFor="mnt">
              <NumberInput id="mnt" value={form.maintenanceYear} onChange={(v) => set("maintenanceYear", v)} suffix="€/año" />
            </Field>
            <Field label="Otros" htmlFor="oth">
              <NumberInput id="oth" value={form.otherCostsYear} onChange={(v) => set("otherCostsYear", v)} suffix="€/año" />
            </Field>
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="col-span-full mb-1 text-sm font-semibold text-ink-700">Datos para impuestos y valoración</legend>
            <Field label="Valor catastral total" htmlFor="vct" hint="Recibo del IBI">
              <NumberInput id="vct" value={form.cadastralValueTotal} onChange={(v) => set("cadastralValueTotal", v)} suffix="€" />
            </Field>
            <Field label="Valor catastral del suelo" htmlFor="vcs" hint="Necesario para la plusvalía municipal" error={errors.cadastralValueLand}>
              <NumberInput id="vcs" value={form.cadastralValueLand} onChange={(v) => set("cadastralValueLand", v)} suffix="€" />
            </Field>
            <Field label="¿Tienes una valoración de la vivienda?" htmlFor="ovk">
              <select id="ovk" className="field" value={form.ownerValuationKind} onChange={(e) => set("ownerValuationKind", e.target.value as Form["ownerValuationKind"])}>
                <option value="">No</option>
                {(Object.keys(OWNER_VALUATION_LABELS) as Array<keyof typeof OWNER_VALUATION_LABELS>).map((k) => (
                  <option key={k} value={k}>
                    {OWNER_VALUATION_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            {form.ownerValuationKind && (
              <Field label="Importe de esa valoración" htmlFor="ovv" error={errors.ownerValuationValue}>
                <NumberInput id="ovv" value={form.ownerValuationValue} onChange={(v) => set("ownerValuationValue", v)} suffix="€" />
              </Field>
            )}
          </fieldset>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <h2 className="font-serif text-3xl font-medium text-ink-800">Tu situación</h2>
          <Field label="¿Qué te interesa más?" error={errors.goal}>
            <ChoiceGroup
              name="Objetivo"
              columns="grid-cols-1 sm:grid-cols-2"
              options={(Object.keys(GOAL_LABELS) as Array<keyof typeof GOAL_LABELS>).map((k) => ({ value: k, label: GOAL_LABELS[k] }))}
              value={form.goal}
              onChange={(v) => set("goal", v)}
            />
          </Field>
          <Field label="Horizonte temporal de la decisión">
            <ChoiceGroup
              name="Horizonte"
              columns="grid-cols-4"
              options={HORIZONS.map((h) => ({ value: String(h), label: `${h} ${h === 1 ? "año" : "años"}` }))}
              value={String(form.horizon)}
              onChange={(v) => set("horizon", Number(v))}
            />
          </Field>
          {form.currentUse === "RENTED" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Renta mensual actual" htmlFor="rent" error={errors.currentRent}>
                <NumberInput id="rent" value={form.currentRent} onChange={(v) => set("currentRent", v)} suffix="€/mes" />
              </Field>
              <Field label="¿Hay incidencias con el inquilino?" htmlFor="issue">
                <select id="issue" className="field" value={form.tenancyIssue} onChange={(e) => set("tenancyIssue", e.target.value as Form["tenancyIssue"])}>
                  {(Object.keys(TENANCY_ISSUE_LABELS) as Array<keyof typeof TENANCY_ISSUE_LABELS>).map((k) => (
                    <option key={k} value={k}>
                      {TENANCY_ISSUE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha de firma del contrato" htmlFor="cstart" optional hint="Determina la reducción del IRPF aplicable (contratos anteriores o posteriores al 26-05-2023).">
                <input id="cstart" type="month" className="field" value={form.rentalContractStart} onChange={(e) => set("rentalContractStart", e.target.value)} />
              </Field>
            </div>
          )}
          {form.currentUse !== "RENTED" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="¿Ha estado alquilada como vivienda habitual en los últimos 5 años?" htmlFor="r5" optional hint="En zona tensionada, la renta de un contrato nuevo puede quedar limitada a la del contrato anterior.">
                <select id="r5" className="field" value={form.rentedLast5Years} onChange={(e) => set("rentedLast5Years", e.target.value as Form["rentedLast5Years"])}>
                  <option value="UNKNOWN">No lo sé / prefiero no indicarlo</option>
                  <option value="YES">Sí</option>
                  <option value="NO">No</option>
                </select>
              </Field>
              {form.rentedLast5Years === "YES" && (
                <Field label="Renta mensual del último contrato" htmlFor="prent" optional>
                  <NumberInput id="prent" value={form.previousRent} onChange={(v) => set("previousRent", v)} suffix="€/mes" />
                </Field>
              )}
            </div>
          )}
          <Field label="¿Cuántas viviendas tienes en propiedad (para alquilar)?" htmlFor="landl" optional hint="Solo sirve para saber qué límite legal de renta podría aplicarse (grandes tenedores, Ley 12/2023).">
            <select id="landl" className="field max-w-sm" value={form.landlordBracket} onChange={(e) => set("landlordBracket", e.target.value as LandlordBracket)}>
              {(Object.keys(LANDLORD_LABELS) as LandlordBracket[]).map((k) => (
                <option key={k} value={k}>
                  {LANDLORD_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Residencia fiscal" htmlFor="res" hint="Cambia los impuestos de la venta y del alquiler.">
              <select id="res" className="field" value={form.taxResidence} onChange={(e) => set("taxResidence", e.target.value as TaxResidence)}>
                {(Object.keys(TAX_RESIDENCE_LABELS) as TaxResidence[]).map((k) => (
                  <option key={k} value={k}>
                    {TAX_RESIDENCE_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tu tipo marginal de IRPF" htmlFor="mrg" optional hint="Si no lo sabes, usaremos un 30 % como hipótesis.">
              <NumberInput id="mrg" value={form.marginalRate} onChange={(v) => set("marginalRate", v)} suffix="%" />
            </Field>
          </div>
          {form.taxResidence === "ES" && form.currentUse === "OWNER_PRIMARY" && (
            <Field
              label="¿Tienes 65 años o más?"
              optional
              hint="Solo se usa para comprobar la exención del IRPF al vender tu vivienda habitual (art. 33.4 de la Ley del IRPF). No la usamos para ningún otro fin ni para valorar riesgos."
            >
              <ChoiceGroup
                name="Mayor de 65"
                options={[
                  { value: "YES", label: "Sí" },
                  { value: "NO", label: "No" },
                  { value: "UNDISCLOSED", label: "Prefiero no indicarlo" },
                ]}
                value={form.over65}
                onChange={(v) => set("over65", v as Form["over65"])}
              />
            </Field>
          )}
          <p className="rounded-xl bg-sand-50 p-3 text-xs leading-relaxed text-ink-500">
            No te pedimos datos personales para generar el estudio. Guardamos los datos de la vivienda y los cálculos para mostrarte el resultado; solo tú puedes verlo desde este
            navegador. Si después solicitas una valoración profesional, te pediremos tus datos de contacto y tu consentimiento.
          </p>
          {errors.form && (
            <p className="text-sm text-red-600" role="alert">
              {errors.form}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-sand-200 pt-6">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4" /> Atrás
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" size="lg" onClick={next}>
            Continuar <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" size="lg" variant="accent" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Consultando fuentes oficiales…" : "Ver mi estudio"}
          </Button>
        )}
      </div>
    </div>
  );
}
