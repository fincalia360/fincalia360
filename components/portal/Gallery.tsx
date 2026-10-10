/* eslint-disable @next/next/no-img-element -- las fotos ya se sirven optimizadas (WebP redimensionado) */
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { photoUrl } from "@/services/listings/catalog";

export function Gallery({ photos, title }: { photos: { key: string; width: number; height: number; alt: string | null }[]; title: string }) {
  const [i, setI] = useState(0);
  if (!photos.length) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-sand-100 text-ink-300">
        <ImageOff className="h-10 w-10" />
      </div>
    );
  }
  const go = (d: number) => setI((v) => (v + d + photos.length) % photos.length);
  const p = photos[i];
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-ink-900">
        <img src={photoUrl(p.key)} alt={p.alt ?? `${title} · foto ${i + 1}`} width={p.width} height={p.height} className="aspect-[16/10] w-full object-contain" />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-800 shadow hover:bg-white">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Foto siguiente" className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-800 shadow hover:bg-white">
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {i + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {photos.map((ph, n) => (
            <button
              key={ph.key}
              type="button"
              onClick={() => setI(n)}
              aria-label={`Ver foto ${n + 1}`}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 ${n === i ? "ring-terracotta-500" : "ring-transparent opacity-80 hover:opacity-100"}`}
            >
              <img src={photoUrl(ph.key, true)} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
