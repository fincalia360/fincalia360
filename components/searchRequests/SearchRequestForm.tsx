"use client";
// Formulario «Busco comprar». Valida en el navegador (el servidor vuelve a validar todo) y envía la
// solicitud, que queda pendiente de revisión. Los consentimientos nunca van marcados de antemano.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { searchTexts } from "@/lib/i18n/searchRequests";
import { FORM_SEARCH_TYPES, isDwellingSearch } from "@/services/searchRequests/catalog";

const PREFS = ["ANY", "YES", "NO"] as const;
const MAX_MUNICIPALITIES = 10;

type Errors = Partial<Record<string, string>>;

function Field({
  label,
  hint,
  error,
  children,
  wide,
  htmlFor,
}: {
  label: React.ReactNode;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  wide?: boolean;
  htmlFor?: string;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={htmlFor} className="field-label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>
      )}
    </div>
  );
}

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export function SearchRequestForm({ lang, provinces }: { lang: string; provinces: { code: string; name: string }[] }) {
  const t = searchTexts(lang);
  const openedAt = useRef(Date.now());
  const [operation, setOperation] = useState<"SALE" | "RENT" | "">("");
  const [propertyType, setPropertyType] = useState("");
  // Habitaciones, baños, terraza, ascensor, exterior y estado solo para viviendas; superficie, salvo en amarres
  const dwelling = !propertyType || isDwellingSearch(propertyType);
  const showArea = propertyType !== "AMARRE";
  const [provinceCode, setProvinceCode] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [reference, setReference] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const rent = operation === "RENT";

  // Municipios oficiales (INE) de la provincia elegida, para autocompletar
  useEffect(() => {
    setOptions([]);
    if (!provinceCode) return;
    let cancelled = false;
    fetch(`/api/estudio/municipios?provincia=${provinceCode}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { municipalities?: { name: string }[] } | null) => {
        if (!cancelled && d?.municipalities) setOptions(d.municipalities.map((m) => m.name));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [provinceCode]);

  function addMunicipality() {
    const name = draft.trim().replace(/\|/g, " ");
    if (name.length < 2 || municipalities.length >= MAX_MUNICIPALITIES) return;
    const known = options.find((o) => o.toLowerCase() === name.toLowerCase());
    const value = known ?? name;
    if (!municipalities.some((m) => m.toLowerCase() === value.toLowerCase())) setMunicipalities([...municipalities, value]);
    setDraft("");
    setErrors((e) => ({ ...e, municipalities: undefined }));
  }

  function validate(f: FormData): Errors {
    const e: Errors = {};
    if (!operation) e.operation = t.errors.operation;
    if (!f.get("propertyType")) e.propertyType = t.errors.propertyType;
    if (!provinceCode) e.provinceCode = t.errors.province;
    if (!municipalities.length && draft.trim().length < 2) e.municipalities = t.errors.municipality;
    const min = num(String(f.get("minPrice") ?? ""));
    const max = num(String(f.get("maxPrice") ?? ""));
    if (max == null) e.maxPrice = t.errors.maxPrice;
    else if (!Number.isFinite(max) || max <= 0 || (min != null && (!Number.isFinite(min) || min < 0))) e.maxPrice = t.errors.amount;
    else if (min != null && min > max) e.minPrice = t.errors.minOverMax;
    else if (rent && max > 100_000) e.maxPrice = t.errors.rentMonthly;
    const minA = num(String(f.get("minArea") ?? ""));
    const maxA = num(String(f.get("maxArea") ?? ""));
    if ((minA != null && (!Number.isFinite(minA) || minA < 0)) || (maxA != null && (!Number.isFinite(maxA) || maxA < 0))) e.minArea = t.errors.amount;
    else if (minA != null && maxA != null && minA > maxA) e.minArea = t.errors.area;
    if (String(f.get("name") ?? "").trim().length < 2) e.name = t.errors.name;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.get("email") ?? "").trim())) e.email = t.errors.email;
    const phone = String(f.get("phone") ?? "").trim();
    if (phone && !/^[+\d][\d\s().-]{6,19}$/.test(phone)) e.phone = t.errors.phone;
    if (f.get("privacy") !== "on") e.privacy = t.errors.privacy;
    return e;
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setServerError(null);
    const f = new FormData(ev.currentTarget);
    const list = municipalities.length ? municipalities : draft.trim() ? [draft.trim()] : [];
    const e = validate(f);
    setErrors(e);
    if (Object.keys(e).length) {
      const first = formRef.current?.querySelector('[role="alert"]');
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/busco-piso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          propertyType: f.get("propertyType"),
          provinceCode,
          municipalities: list,
          zone: f.get("zone"),
          minPrice: num(String(f.get("minPrice") ?? "")),
          maxPrice: num(String(f.get("maxPrice") ?? "")),
          minBedrooms: f.get("minBedrooms"),
          minBathrooms: f.get("minBathrooms"),
          minArea: num(String(f.get("minArea") ?? "")),
          maxArea: num(String(f.get("maxArea") ?? "")),
          terrace: f.get("terrace"),
          elevator: f.get("elevator"),
          parking: f.get("parking"),
          exterior: f.get("exterior"),
          condition: f.get("condition"),
          description: f.get("description"),
          name: f.get("name"),
          email: f.get("email"),
          phone: f.get("phone"),
          privacy: f.get("privacy") === "on",
          marketing: f.get("marketing") === "on",
          consentText: t.privacyConsent,
          lang,
          website: f.get("website"),
          elapsedMs: Date.now() - openedAt.current,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; reference?: string };
      if (!res.ok) throw new Error(data.error ?? t.error);
      setReference(data.reference ?? "");
      setState("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setServerError((err as Error).message || t.error);
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-pine-100 bg-white p-8 text-center shadow-soft" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-pine-600" />
        <h2 className="mt-4 text-2xl font-semibold text-ink-800">{t.sentTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-500">{t.sentText(reference)}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/busco-piso/solicitudes" className="inline-flex h-11 items-center rounded-full bg-ink-800 px-5 font-medium text-white hover:bg-ink-900">
            {t.seeList}
          </Link>
          <button
            type="button"
            onClick={() => location.reload()}
            className="inline-flex h-11 items-center rounded-full border border-sand-300 px-5 font-medium text-ink-700 hover:bg-sand-50"
          >
            {t.another}
          </button>
        </div>
      </div>
    );
  }

  const section = "rounded-2xl border border-sand-200 bg-white p-5 sm:p-6";
  const h2 = "text-[17px] font-semibold text-ink-800";
  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset className={section}>
        <legend className="sr-only">{t.step1}</legend>
        <h2 className={h2}>{t.step1}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t.operation} error={errors.operation}>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.operation}>
              {(["SALE", "RENT"] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  role="radio"
                  aria-checked={operation === op}
                  onClick={() => {
                    setOperation(op);
                    setErrors((e) => ({ ...e, operation: undefined }));
                  }}
                  className={`h-11 rounded-xl border text-[15px] font-medium transition ${operation === op ? "border-ink-800 bg-ink-800 text-white" : "border-sand-300 bg-white text-ink-700 hover:border-ink-400"}`}
                >
                  {op === "SALE" ? t.buy : t.rent}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t.propertyType} htmlFor="bp-type" error={errors.propertyType}>
            <select
              id="bp-type"
              name="propertyType"
              value={propertyType}
              onChange={(e) => {
                setPropertyType(e.target.value);
                setErrors((er) => ({ ...er, propertyType: undefined }));
              }}
              className="field"
            >
              <option value="" disabled>
                —
              </option>
              {FORM_SEARCH_TYPES.map((k) => (
                <option key={k} value={k}>
                  {t.types[k]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className={section}>
        <legend className="sr-only">{t.step2}</legend>
        <h2 className={h2}>{t.step2}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t.province} htmlFor="bp-province" error={errors.provinceCode}>
            <select
              id="bp-province"
              value={provinceCode}
              onChange={(e) => {
                setProvinceCode(e.target.value);
                setMunicipalities([]);
                setErrors((er) => ({ ...er, provinceCode: undefined }));
              }}
              className="field"
            >
              <option value="">{t.chooseProvince}</option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.municipalities} htmlFor="bp-muni" error={errors.municipalities} hint={t.municipalitiesHint(MAX_MUNICIPALITIES)}>
            <div className="flex gap-2">
              <input
                id="bp-muni"
                value={draft}
                disabled={!provinceCode || municipalities.length >= MAX_MUNICIPALITIES}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMunicipality();
                  }
                }}
                list="bp-muni-list"
                maxLength={80}
                autoComplete="off"
                placeholder={t.municipalityPlaceholder(Boolean(provinceCode))}
                className="field min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={addMunicipality}
                disabled={!provinceCode || draft.trim().length < 2}
                className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl border border-sand-300 px-3 text-sm font-medium text-ink-700 hover:bg-sand-50 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> {t.add}
              </button>
              <datalist id="bp-muni-list">
                {options.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            {municipalities.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {municipalities.map((m) => (
                  <li key={m} className="inline-flex items-center gap-1 rounded-full bg-sand-100 py-1 pl-3 pr-1 text-sm text-ink-700">
                    {m}
                    <button
                      type="button"
                      aria-label={t.remove(m)}
                      onClick={() => setMunicipalities(municipalities.filter((x) => x !== m))}
                      className="grid h-6 w-6 place-items-center rounded-full hover:bg-sand-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
          <Field
            label={
              <>
                {t.zone} <span className="font-normal text-ink-400">{t.optional}</span>
              </>
            }
            htmlFor="bp-zone"
            wide
          >
            <input id="bp-zone" name="zone" maxLength={120} className="field" />
          </Field>
        </div>
      </fieldset>

      <fieldset className={section}>
        <legend className="sr-only">{t.step3}</legend>
        <h2 className={h2}>{t.step3}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label={
              <>
                {t.minPrice(rent)} <span className="font-normal text-ink-400">{t.optional}</span>
              </>
            }
            htmlFor="bp-min"
            error={errors.minPrice}
          >
            <input id="bp-min" name="minPrice" type="number" inputMode="numeric" min={0} step={rent ? 50 : 1000} className="field" />
          </Field>
          <Field label={t.maxPrice(rent)} htmlFor="bp-max" error={errors.maxPrice}>
            <input id="bp-max" name="maxPrice" type="number" inputMode="numeric" min={1} step={rent ? 50 : 1000} required className="field" />
          </Field>
        </div>
      </fieldset>

      <fieldset className={section}>
        <legend className="sr-only">{t.step4}</legend>
        <h2 className={h2}>{t.step4}</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">{t.step4Hint}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {dwelling && (
            <>
              <Field label={t.bedrooms} htmlFor="bp-bed">
                <select id="bp-bed" name="minBedrooms" defaultValue="" className="field">
                  <option value="">{t.prefs.ANY}</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}+
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.bathrooms} htmlFor="bp-bath">
                <select id="bp-bath" name="minBathrooms" defaultValue="" className="field">
                  <option value="">{t.prefs.ANY}</option>
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}+
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          {showArea && (
            <>
              <Field label={t.minArea} htmlFor="bp-mina" error={errors.minArea}>
                <input id="bp-mina" name="minArea" type="number" inputMode="numeric" min={0} className="field" />
              </Field>
              <Field label={t.maxArea} htmlFor="bp-maxa">
                <input id="bp-maxa" name="maxArea" type="number" inputMode="numeric" min={0} className="field" />
              </Field>
            </>
          )}
          {dwelling && (
            <>
              {(["terrace", "elevator", "parking", "exterior"] as const).map((k) => (
                <Field key={k} label={t[k]} htmlFor={`bp-${k}`}>
                  <select id={`bp-${k}`} name={k} defaultValue="ANY" className="field">
                    {PREFS.map((p) => (
                      <option key={p} value={p}>
                        {t.prefs[p]}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
              <Field label={t.condition} htmlFor="bp-cond" wide>
                <select id="bp-cond" name="condition" defaultValue="ANY" className="field">
                  {(["ANY", "NEW", "GOOD", "TO_REFORM"] as const).map((c) => (
                    <option key={c} value={c}>
                      {t.conditions[c]}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>
        <div className="mt-4">
          <Field
            label={
              <>
                {t.description} <span className="font-normal text-ink-400">{t.optional}</span>
              </>
            }
            htmlFor="bp-desc"
            hint={t.descriptionHint}
          >
            <textarea id="bp-desc" name="description" rows={4} maxLength={2000} placeholder={t.descriptionPlaceholder} className="field" />
          </Field>
        </div>
      </fieldset>

      <fieldset className={section}>
        <legend className="sr-only">{t.step5}</legend>
        <h2 className={h2}>{t.step5}</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">{t.step5Hint}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t.name} htmlFor="bp-name" error={errors.name}>
            <input id="bp-name" name="name" maxLength={100} autoComplete="name" required className="field" />
          </Field>
          <Field label={t.email} htmlFor="bp-email" error={errors.email}>
            <input id="bp-email" name="email" type="email" maxLength={150} autoComplete="email" required className="field" />
          </Field>
          <Field
            label={
              <>
                {t.phone} <span className="font-normal text-ink-400">{t.optional}</span>
              </>
            }
            htmlFor="bp-phone"
            error={errors.phone}
            hint={t.phoneHint}
          >
            <input id="bp-phone" name="phone" type="tel" maxLength={20} autoComplete="tel" className="field" />
          </Field>
        </div>
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

        <div className="mt-5 rounded-xl bg-sand-50 p-4 text-[13px] leading-relaxed text-ink-600">
          <p className="font-semibold text-ink-800">{t.privacyTitle}</p>
          <dl className="mt-2 space-y-1.5">
            {t.privacyItems.map(([k, v]) => (
              <div key={k}>
                <dt className="inline font-medium text-ink-700">{k}: </dt>
                <dd className="inline">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy" target="_blank" className="font-medium underline">
              {t.privacyLink}
            </Link>
            <Link href="/legal" target="_blank" className="underline">
              {t.legalNotice}
            </Link>
            <Link href="/contacto" target="_blank" className="underline">
              {t.contactPage}
            </Link>
          </p>
        </div>

        <div className="mt-4 space-y-3 text-[13.5px] text-ink-700">
          <label className="flex items-start gap-2.5">
            <input type="checkbox" name="privacy" className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand-300" />
            <span>
              {t.privacyConsent}{" "}
              <Link href="/privacy" target="_blank" className="underline">
                {t.privacyLink}
              </Link>
            </span>
          </label>
          {errors.privacy && (
            <p className="text-xs text-red-600" role="alert">
              {errors.privacy}
            </p>
          )}
          <label className="flex items-start gap-2.5">
            <input type="checkbox" name="marketing" className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand-300" />
            <span>{t.marketingConsent}</span>
          </label>
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-500">{t.free}</p>
        <button
          type="submit"
          disabled={state === "sending"}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-terracotta-500 px-7 text-[15px] font-semibold text-white hover:bg-terracotta-600 disabled:opacity-60"
        >
          {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />} {state === "sending" ? t.sending : t.cta}
        </button>
      </div>
      {serverError && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          {serverError}
        </p>
      )}
    </form>
  );
}
