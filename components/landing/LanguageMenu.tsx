"use client";
// Selector de idioma de la web (ES · CA · EN · DE · FR). Al elegir uno se guarda y se vuelve a la misma página.
import { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { SITE_LANGUAGES, SITE_LANGUAGE_NAMES, type SiteLang } from "@/lib/i18n/site";

export function LanguageMenu({ current, label }: { current: SiteLang; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${label}: ${SITE_LANGUAGE_NAMES[current]}`}
        className="inline-flex h-10 items-center gap-1 rounded-full border border-sand-300 px-2.5 text-[13px] font-semibold uppercase text-ink-700 hover:bg-sand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-terracotta-500"
      >
        <Globe className="h-4 w-4" aria-hidden /> {current}
      </button>
      {open && (
        <ul role="menu" aria-label={label} className="absolute right-0 top-12 z-40 w-40 rounded-2xl border border-sand-200 bg-white p-1.5 shadow-xl">
          {SITE_LANGUAGES.map((l) => (
            <li key={l} role="none">
              <a
                role="menuitem"
                href={`?lang=${l}`}
                hrefLang={l}
                lang={l}
                aria-current={l === current ? "true" : undefined}
                className={`flex min-h-10 items-center justify-between rounded-lg px-3 text-[14px] hover:bg-sand-50 focus-visible:bg-sand-50 focus-visible:outline-none ${
                  l === current ? "font-semibold text-ink-800" : "text-ink-600"
                }`}
              >
                {SITE_LANGUAGE_NAMES[l]} <span className="text-[11px] uppercase text-ink-400">{l}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
