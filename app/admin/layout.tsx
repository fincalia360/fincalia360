import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AdminMobileNav, AdminSidebarNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/brand/Logo";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/admin/studyActions";

export const metadata: Metadata = { title: { default: "CRM", template: "%s · CRM Tramontana" } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-screen bg-sand-50 lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-ink-900 px-4 py-5 lg:flex">
        <Link href="/admin" className="px-2">
          <Logo tagline="CRM · Demo" light />
        </Link>
        <div className="mt-8 flex-1">
          <AdminSidebarNav />
        </div>
        <div className="space-y-3 border-t border-white/10 pt-4 text-[13px] text-sand-300">
          <Link href="/" className="flex items-center gap-2 px-3 hover:text-white">
            <ExternalLink className="h-3.5 w-3.5" /> Ver landing pública
          </Link>
          <div className="flex items-center gap-2.5 px-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">AD</span>
            <div className="leading-tight">
              <p className="text-white">{user.name}</p>
              {user.demo ? (
                <p className="text-[11px] text-amber-300">Sin contraseña (solo desarrollo)</p>
              ) : (
                <form action={logoutAction}>
                  <button className="text-[11px] text-sand-300/80 hover:text-white">Cerrar sesión</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="sticky top-0 z-20 bg-ink-900 lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/admin">
            <Logo tagline="CRM · Demo" light className="scale-90 origin-left" />
          </Link>
          <Link href="/" className="text-xs text-sand-300">Landing ↗</Link>
        </div>
        <AdminMobileNav />
      </div>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</div>
      </main>
    </div>
  );
}
