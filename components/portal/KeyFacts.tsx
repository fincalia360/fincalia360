// Datos esenciales de una ficha en bloques con icono (se ven antes que la descripción) y barra de
// contacto fija en el móvil, para que el precio y el botón de contacto estén siempre a mano.
import type { LucideIcon } from "lucide-react";
import { MessageSquare } from "lucide-react";

export function KeyFacts({ items }: { items: Array<{ icon: LucideIcon; label: string; value: string | null | undefined }> }) {
  const shown = items.filter((i) => i.value);
  if (!shown.length) return null;
  return (
    <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {shown.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-3 rounded-xl border border-sand-200 bg-white px-3.5 py-3">
          <Icon className="h-5 w-5 shrink-0 text-terracotta-600" aria-hidden />
          <div className="min-w-0">
            <dt className="text-[12px] font-medium uppercase tracking-wide text-ink-400">{label}</dt>
            <dd className="truncate text-[15px] font-semibold text-ink-800">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

export function MobileContactBar({ price, label = "Contactar" }: { price: string; label?: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-sand-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(20,43,69,0.25)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <p className="truncate text-lg font-semibold tracking-tight text-ink-800">{price}</p>
        <a
          href="#contacto"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-terracotta-500 px-5 font-semibold text-white hover:bg-terracotta-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-500"
        >
          <MessageSquare className="h-4 w-4" /> {label}
        </a>
      </div>
    </div>
  );
}
