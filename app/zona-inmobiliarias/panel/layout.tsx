import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { AgencyMobileNav, AgencySidebarNav } from "@/components/agency/AgencyNav";
import { getAgencySession } from "@/services/agency/auth";
import { logoutAction } from "../authActions";

export const metadata: Metadata = { title: { default: "CRM", template: "%s · Zona inmobiliarias" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AgencyPanelLayout({ children }: { children: React.ReactNode }) {
  // Validación real de la sesión (base de datos): usuario activo e inmobiliaria con acceso
  const s = await getAgencySession();
  if (!s) redirect("/zona-inmobiliarias");
  const initials = s.userName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="min-h-screen bg-sand-50 lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-ink-900 px-4 py-5 lg:flex">
        <Link href="/zona-inmobiliarias/panel" className="px-2">
          <Logo tagline="Zona inmobiliarias" light />
        </Link>
        <p className="mt-6 truncate px-3 text-[11px] font-semibold uppercase tracking-wider text-sand-300/70" title={s.agencyName}>
          {s.agencyName}
        </p>
        <div className="mt-2 flex-1">
          <AgencySidebarNav />
        </div>
        <div className="space-y-3 border-t border-white/10 pt-4 text-[13px] text-sand-300">
          <div className="flex items-center gap-2.5 px-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">{initials}</span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-white">{s.userName}</p>
              <form action={logoutAction}>
                <button className="inline-flex items-center gap-1 text-[11px] text-sand-300/80 hover:text-white">
                  <LogOut className="h-3 w-3" /> Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <div className="sticky top-0 z-20 bg-ink-900 lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/zona-inmobiliarias/panel">
            <Logo tagline={s.agencyName} light className="origin-left scale-90" />
          </Link>
          <form action={logoutAction}>
            <button className="text-xs text-sand-300">Salir</button>
          </form>
        </div>
        <AgencyMobileNav />
      </div>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</div>
      </main>
    </div>
  );
}
