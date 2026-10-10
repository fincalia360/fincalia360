"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Calculator,
  CalendarDays,
  Database,
  Home,
  Scale,
  FileBarChart,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ADMIN_NAV = [
  { href: "/admin/negocio", label: "Negocio", icon: TrendingUp },
  { href: "/admin/leads", label: "Contactos", icon: Users },
  { href: "/admin/inmuebles", label: "Inmuebles", icon: Home },
  { href: "/admin/studies", label: "Estudios", icon: FileBarChart },
  { href: "/admin/comparables", label: "Comparables de alquiler", icon: Scale },
  { href: "/admin/appointments", label: "Citas", icon: CalendarDays },
  { href: "/admin/agencies", label: "Colaboradores e inmobiliarias", icon: Building2 },
  { href: "/admin/servicios", label: "Servicios y estados", icon: ListChecks },
  { href: "/admin", label: "Resumen (demo)", icon: LayoutDashboard },
  { href: "/admin/campaigns", label: "Campañas (simulación)", icon: Megaphone },
  { href: "/admin/economics", label: "Economía (simulación)", icon: Calculator },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/data-sources", label: "Fuentes de datos", icon: Database },
  { href: "/admin/settings", label: "Configuración", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5">
      {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            isActive(pathname, href) ? "bg-white/10 font-medium text-white" : "text-sand-300 hover:bg-white/5 hover:text-white",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-none">
      {ADMIN_NAV.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-[13px]",
            isActive(pathname, href) ? "bg-white text-ink-800" : "text-sand-200 hover:text-white",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
