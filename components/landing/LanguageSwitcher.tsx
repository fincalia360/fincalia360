import Link from "next/link";
import { LANGUAGES, type Language } from "@/types";
import { cn } from "@/lib/utils";

/** Selector ES / CA / EN / FR / DE / NL / IT / PT. Usa ?lang= (el middleware lo guarda en cookie). */
export function LanguageSwitcher({ current, basePath = "/", light }: { current: Language; basePath?: string; light?: boolean }) {
  return (
    <nav aria-label="Idioma" className="-mx-1 flex max-w-full items-center overflow-x-auto scrollbar-none">
      {LANGUAGES.map((lang) => (
        <Link
          key={lang}
          href={`${basePath}?lang=${lang}`}
          hrefLang={lang}
          aria-current={lang === current ? "true" : undefined}
          className={cn(
            "rounded-full px-2 py-1 text-[11.5px] font-semibold tracking-wider transition-colors",
            lang === current
              ? light
                ? "bg-white text-ink-800"
                : "bg-ink-800 text-white"
              : light
                ? "text-sand-200 hover:text-white"
                : "text-ink-400 hover:text-ink-800",
          )}
        >
          {lang.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
