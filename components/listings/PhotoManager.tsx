/* eslint-disable @next/next/no-img-element -- las fotos ya se sirven optimizadas (WebP redimensionado) */
"use client";

// Fotos del inmueble: subida múltiple, foto principal, orden y borrado.
// En el navegador se reducen las fotos muy grandes antes de subirlas (más rápido en el móvil);
// el servidor vuelve a procesarlas siempre y elimina sus metadatos (incluido el GPS).
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Star, Trash2, Upload } from "lucide-react";
import { MAX_PHOTOS, photoUrl } from "@/services/listings/catalog";

type Photo = { id: string; key: string; isMain: boolean };
type Result = { error?: string } | void;

async function shrink(file: File): Promise<Blob> {
  if (file.size < 3 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function PhotoManager({
  photos,
  uploadUrl,
  onMain,
  onMove,
  onDelete,
}: {
  photos: Photo[];
  uploadUrl: string;
  onMain: (photoId: string) => Promise<Result>;
  onMove: (photoId: string, direction: -1 | 1) => Promise<Result>;
  onDelete: (photoId: string) => Promise<Result>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    for (const [n, file] of list.entries()) {
      setProgress(`Subiendo ${n + 1} de ${list.length}…`);
      const body = new FormData();
      body.append("file", await shrink(file), file.name);
      const res = await fetch(uploadUrl, { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(`${file.name}: ${data.error ?? "no se ha podido subir"}`);
        break;
      }
    }
    setProgress(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  function run(fn: () => Promise<Result>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r && r.error) setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink-800">Fotografías</h2>
          <p className="text-[13px] text-ink-400">
            {photos.length} de {MAX_PHOTOS}. JPG, PNG o WebP. La marcada con ★ es la principal.
          </p>
        </div>
        <label className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-ink-800 px-4 text-sm font-medium text-white hover:bg-ink-700 ${progress || photos.length >= MAX_PHOTOS ? "pointer-events-none opacity-50" : ""}`}>
          {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {progress ?? "Subir fotos"}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {photos.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-sand-300 px-4 py-8 text-center text-sm text-ink-400">Aún no hay fotos. Sube al menos una para poder publicar.</p>
      ) : (
        <ul className={`mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${pending ? "opacity-60" : ""}`}>
          {photos.map((p, i) => (
            <li key={p.id} className={`overflow-hidden rounded-xl border ${p.isMain ? "border-terracotta-500 ring-2 ring-terracotta-200" : "border-sand-200"}`}>
              <img src={photoUrl(p.key, true)} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center justify-between gap-1 bg-sand-50 px-1.5 py-1">
                <button type="button" title="Foto principal" aria-label="Marcar como foto principal" onClick={() => run(() => onMain(p.id))} className={`rounded p-1.5 ${p.isMain ? "text-terracotta-500" : "text-ink-400 hover:text-ink-800"}`}>
                  <Star className="h-4 w-4" fill={p.isMain ? "currentColor" : "none"} />
                </button>
                <div className="flex">
                  <button type="button" aria-label="Mover a la izquierda" disabled={i === 0} onClick={() => run(() => onMove(p.id, -1))} className="rounded p-1.5 text-ink-400 hover:text-ink-800 disabled:opacity-30">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Mover a la derecha" disabled={i === photos.length - 1} onClick={() => run(() => onMove(p.id, 1))} className="rounded p-1.5 text-ink-400 hover:text-ink-800 disabled:opacity-30">
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Eliminar foto"
                  onClick={() => {
                    if (confirm("¿Eliminar esta foto?")) run(() => onDelete(p.id));
                  }}
                  className="rounded p-1.5 text-ink-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Documento de autorización del propietario (privado). */
export function AuthorizationDocUpload({ uploadUrl, downloadUrl, hasDoc }: { uploadUrl: string; downloadUrl: string; hasDoc: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(uploadUrl, { method: "POST", body });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "No se ha podido subir");
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-5">
      <h2 className="text-[15px] font-semibold text-ink-800">Documento de autorización</h2>
      <p className="mt-0.5 text-[13px] text-ink-400">Hoja de encargo o autorización firmada (PDF, JPG o PNG). Es privado: nunca se publica.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-sand-300 px-4 text-sm font-medium text-ink-700 hover:bg-sand-50 ${busy ? "pointer-events-none opacity-50" : ""}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {hasDoc ? "Sustituir documento" : "Subir documento"}
          <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {hasDoc && (
          <a href={downloadUrl} target="_blank" className="text-sm font-medium text-ink-700 underline">
            Ver documento
          </a>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
