"use client";
// Menú del móvil y la tableta: se abre con el botón, se cierra con la X, con Escape, al tocar fuera
// o al elegir una opción. Venta y Alquiler despliegan sus tipos de inmueble.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";

export interface MenuGroup {
  label: string;
  all: { label: string; href: string };
  items: { label: string; href: string }[];
}

export function MobileMenu({ groups, links, cta }: { groups: MenuGroup[]; links: { label: string; href: string }[]; cta: { label: string; href: string } }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
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

  const item = "flex min-h-11 items-center rounded-lg px-3 text-[15px] text-ink-700 hover:bg-sand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-terracotta-500";
  return (
    <div ref={ref} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="menu-movil"
        aria-label={open ? "Cerrar el menú" : "Abrir el menú"}
        className="grid h-10 w-10 place-items-center rounded-full border border-sand-300 text-ink-700 hover:bg-sand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-terracotta-500"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <nav id="menu-movil" aria-label="Principal" className="absolute right-0 top-12 z-40 max-h-[80vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-sand-200 bg-white p-2 shadow-xl">
          <Link href="/" onClick={() => setOpen(false)} className={item}>
            Inicio
          </Link>
          {groups.map((g) => (
            <div key={g.label}>
              <button
                type="button"
                onClick={() => setSection((s) => (s === g.label ? null : g.label))}
                aria-expanded={section === g.label}
                className={`${item} w-full justify-between`}
              >
                {g.label} <ChevronDown className={`h-4 w-4 text-ink-400 transition ${section === g.label ? "rotate-180" : ""}`} />
              </button>
              {section === g.label && (
                <div className="mb-1 ml-3 border-l border-sand-200 pl-2">
                  {g.items.map((i) => (
                    <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className={`${item} min-h-10 text-[14px] text-ink-600`}>
                      {i.label}
                    </Link>
                  ))}
                  <Link href={g.all.href} onClick={() => setOpen(false)} className={`${item} min-h-10 text-[14px] font-semibold text-ink-800`}>
                    {g.all.label}
                  </Link>
                </div>
              )}
            </div>
          ))}
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={item}>
              {l.label}
            </Link>
          ))}
          <Link
            href={cta.href}
            onClick={() => setOpen(false)}
            className="mt-2 flex min-h-11 items-center justify-center rounded-full bg-terracotta-500 px-4 text-[15px] font-semibold text-white hover:bg-terracotta-600"
          >
            {cta.label}
          </Link>
        </nav>
      )}
    </div>
  );
}
