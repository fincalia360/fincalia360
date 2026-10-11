"use client";
// Solicitud gratuita de publicación. Las fotos se reducen en el navegador antes de enviarlas
// (más rápido con el móvil) y el servidor las vuelve a procesar y les quita los metadatos.
// Los consentimientos nunca van marcados de antemano.
/* eslint-disable @next/next/no-img-element -- vista previa local de las fotos elegidas */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { PROPERTY_TYPES } from "@/services/listings/catalog";
import { portalDict, toSiteLang } from "@/lib/i18n/site";

const MAX_PHOTOS = 15;
const MAX_TOTAL_BYTES = 9.5 * 1024 * 1024;

/** Reduce la foto a 1600 px como máximo (JPEG). Si el navegador no puede, se envía la original. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
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

export function PublishRequestForm({
  initialCategory,
  provinces,
  types,
  lang,
}: {
  initialCategory: "HOME" | "MOORING";
  provinces: { code: string; name: string }[];
  /** Tipos de inmueble traducidos (código → nombre). */
  types: Record<string, string>;
  lang: string;
}) {
  // Textos en el idioma de la página (se toman aquí: el diccionario tiene funciones).
  const t = portalDict(toSiteLang(lang)).publish;
  const openedAt = useRef(Date.now());
  const [category, setCategory] = useState(initialCategory);
  const [operation, setOperation] = useState<"SALE" | "RENT">("SALE");
  const [provinceCode, setProvinceCode] = useState("");
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [state, setState] = useState<"idle" | "preparing" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const mooring = category === "MOORING";

  useEffect(() => {
    setMunicipalities([]);
    if (!provinceCode) return;
    let cancelled = false;
    fetch(`/api/estudio/municipios?provincia=${provinceCode}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { municipalities?: { name: string }[] } | null) => {
        if (!cancelled && d?.municipalities) setMunicipalities(d.municipalities.map((m) => m.name));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [provinceCode]);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return setError(t.maxPhotos(MAX_PHOTOS));
    setState("preparing");
    const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    const shrunk = await Promise.all(picked.map(async (f) => ({ blob: await shrink(f), url: "" })));
    setPhotos((prev) => [...prev, ...shrunk.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) }))]);
    if (files.length > room) setError(t.onlyAdded(room, MAX_PHOTOS));
    setState("idle");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const total = photos.reduce((s, p) => s + p.blob.size, 0);
    if (total > MAX_TOTAL_BYTES) return setError(t.tooBig);
    const form = new FormData(e.currentTarget);
    form.delete("photoPicker");
    form.set("category", category);
    form.set("operation", operation);
    form.set("elapsedMs", String(Date.now() - openedAt.current));
    form.set("lang", lang);
    photos.forEach((p, i) => form.append("photos", p.blob, `foto-${i + 1}.jpg`));
    setState("sending");
    try {
      const res = await fetch("/api/publicar", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t.error);
      setState("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-pine-100 bg-white p-8 text-center shadow-soft" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-pine-600" />
        <h2 className="mt-4 text-2xl font-semibold text-ink-800">{t.sentTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-500">
          {t.sentText(mooring)}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="rounded-full border border-sand-300 px-5 py-2.5 text-sm font-medium text-ink-700 hover:bg-sand-50">
            {t.backHome}
          </Link>
          <Link href="/estudio" className="rounded-full bg-terracotta-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-terracotta-600">
            {t.valuate}
          </Link>
        </div>
      </div>
    );
  }

  const busy = state === "sending" || state === "preparing";
  const segment = (active: boolean) => `cursor-pointer rounded-full px-5 py-2 text-center ${active ? "bg-white text-ink-800 shadow-sm" : "text-ink-500"}`;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate={false}>
      <fieldset className="rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
        <legend className="sr-only">{t.step1}</legend>
        <h2 className="text-[17px] font-semibold text-ink-800">{t.step1}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="field-label">{t.kind}</span>
            <div className="grid grid-cols-2 rounded-full bg-sand-100 p-1 text-sm font-medium">
              <button type="button" onClick={() => setCategory("HOME")} className={segment(!mooring)} aria-pressed={!mooring}>
                {t.property}
              </button>
              <button type="button" onClick={() => setCategory("MOORING")} className={segment(mooring)} aria-pressed={mooring}>
                {t.mooring}
              </button>
            </div>
          </div>
          <div>
            <span className="field-label">{t.operation}</span>
            <div className="grid grid-cols-2 rounded-full bg-sand-100 p-1 text-sm font-medium">
              <button type="button" onClick={() => setOperation("SALE")} className={segment(operation === "SALE")} aria-pressed={operation === "SALE"}>
                {t.sell}
              </button>
              <button type="button" onClick={() => setOperation("RENT")} className={segment(operation === "RENT")} aria-pressed={operation === "RENT"}>
                {t.let}
              </button>
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
        <legend className="sr-only">{t.step2(mooring)}</legend>
        <h2 className="text-[17px] font-semibold text-ink-800">{t.step2(mooring)}</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">{t.onlyCatalonia}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {mooring ? (
            <Field label={t.port} wide hint={t.portHint}>
              <input name="portName" required maxLength={100} className="field" />
            </Field>
          ) : (
            <Field label={t.propertyType}>
              <select name="propertyType" required defaultValue="PISO" className="field">
                {Object.keys(PROPERTY_TYPES).map((k) => (
                  <option key={k} value={k}>
                    {types[k] ?? k}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t.province}>
            <select name="provinceCode" required value={provinceCode} onChange={(e) => setProvinceCode(e.target.value)} className="field">
              <option value="">{t.chooseProvince}</option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.municipality}>
            <input name="municipality" required maxLength={80} list="municipios-publicar" autoComplete="off" className="field" placeholder={t.municipalityPlaceholder(Boolean(provinceCode))} />
            <datalist id="municipios-publicar">
              {municipalities.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field label={t.zone(mooring)} hint={t.optional}>
            <input name="zone" maxLength={80} className="field" />
          </Field>
          <Field label={t.address(mooring)} hint={t.addressHint}>
            <input name="address" maxLength={160} className="field" />
          </Field>
          <Field label={t.price(operation === "RENT", mooring)} hint={t.priceHint}>
            <input name="price" type="number" min={0} step={1} className="field" />
          </Field>
          {mooring ? (
            <>
              <Field label={t.berthLength}>
                <input name="berthLength" inputMode="decimal" required className="field" />
              </Field>
              <Field label={t.berthWidth}>
                <input name="berthWidth" inputMode="decimal" required className="field" />
              </Field>
              <p className="text-xs text-ink-400 sm:col-span-2">{t.mooringTypesHint}</p>
            </>
          ) : (
            <>
              <Field label={t.size} hint={t.optional}>
                <input name="builtArea" type="number" min={0} className="field" />
              </Field>
              <Field label={t.rooms} hint={t.optional}>
                <input name="bedrooms" type="number" min={0} max={50} className="field" />
              </Field>
              <Field label={t.baths} hint={t.optional}>
                <input name="bathrooms" type="number" min={0} max={50} className="field" />
              </Field>
            </>
          )}
          <Field label={t.description} wide hint={t.descriptionHint}>
            <textarea name="description" rows={5} maxLength={4000} className="field" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
        <legend className="sr-only">{t.step3}</legend>
        <h2 className="text-[17px] font-semibold text-ink-800">{t.step3}</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">{t.photosHint(MAX_PHOTOS)}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {photos.map((p, i) => (
            <div key={p.url} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sand-100">
              <img src={p.url} alt={t.photo(i + 1)} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((x) => x !== p))}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink-700 shadow"
                aria-label={t.removePhoto(i + 1)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sand-300 text-[13px] text-ink-500 hover:border-ink-300">
              {state === "preparing" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              {t.addPhotos}
              <input name="photoPicker" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files).then(() => (e.target.value = ""))} />
            </label>
          )}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
        <legend className="sr-only">{t.step4}</legend>
        <h2 className="text-[17px] font-semibold text-ink-800">{t.step4}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t.name}>
            <input name="name" required maxLength={100} autoComplete="name" className="field" />
          </Field>
          <Field label={t.phone} hint={t.phoneHint}>
            <input name="phone" type="tel" maxLength={20} autoComplete="tel" className="field" />
          </Field>
          <Field label={t.email} wide>
            <input name="email" type="email" required maxLength={150} autoComplete="email" className="field" />
          </Field>
        </div>
        {/* Campo trampa para robots: las personas no lo ven */}
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <div className="mt-5 space-y-3 text-[13.5px] text-ink-700">
          <label className="flex items-start gap-2.5">
            <input type="checkbox" name="isOwner" required className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand-300" />
            <span>{t.ownerConsent}</span>
          </label>
          <label className="flex items-start gap-2.5">
            <input type="checkbox" name="privacy" required className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand-300" />
            <span>
              {t.privacyConsent}{" "}
              <Link href="/privacy" target="_blank" className="underline">
                {t.privacyLink}
              </Link>
            </span>
          </label>
          <label className="flex items-start gap-2.5">
            <input type="checkbox" name="marketing" className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand-300" />
            <span>{t.marketingConsent}</span>
          </label>
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="submit" disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-terracotta-500 px-7 font-semibold text-white hover:bg-terracotta-600 disabled:opacity-60">
          {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />} {t.submit}
        </button>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
