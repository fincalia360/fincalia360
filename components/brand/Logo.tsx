import { cn } from "@/lib/utils";

/**
 * Logotipo de FINCALIA360. Imágenes extraídas de la lámina de marca facilitada,
 * sin redibujar (public/brand). `light` = versión para fondos oscuros.
 */
export function LogoMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/fincalia360-symbol.png" alt="" aria-hidden="true" className={cn("h-8 w-auto", className)} />;
}

export function Logo({ tagline, className, light }: { tagline?: string; className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex flex-col items-start leading-none", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={light ? "/brand/fincalia360-logo-white.png" : "/brand/fincalia360-logo.png"}
        alt="FINCALIA360"
        width={light ? 296 : 810}
        height={light ? 83 : 187}
        className="h-8 w-auto sm:h-9"
      />
      {tagline && (
        <span className={cn("mt-1 text-[9.5px] font-medium uppercase tracking-[0.2em]", light ? "text-ink-200" : "text-ink-400")}>{tagline}</span>
      )}
    </span>
  );
}
