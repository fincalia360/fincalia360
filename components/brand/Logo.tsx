import { cn } from "@/lib/utils";

/** Marca ficticia de demostración ("Tramontana", el viento del Empordà). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("h-8 w-8", className)}>
      <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      <path d="M6 18.5c3.2-2.6 6.4-2.6 9.6 0s6.4 2.6 9.6 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 13.5c2.5-2 5-2 7.5 0s5 2 7.5 0" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <path d="M16 3.5 17.4 9 16 8.2 14.6 9Z" fill="#B5562F" />
    </svg>
  );
}

export function Logo({ tagline, className, light }: { tagline?: string; className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", light ? "text-white" : "text-ink-800", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[22px] font-semibold tracking-tight">Tramontana</span>
        {tagline && (
          <span className={cn("mt-0.5 text-[9.5px] font-medium uppercase tracking-[0.2em]", light ? "text-sand-300" : "text-ink-400")}>
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
