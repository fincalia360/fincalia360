"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Inbox, LayoutDashboard, UserCog, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const P = "/zona-inmobiliarias/panel";
export const AGENCY_NAV = [
  { href: P, label: "Inicio", icon: LayoutDashboard },
  { href: `${P}/contactos`, label: "Contactos", icon: Users },
  { href: `${P}/inmuebles`, label: "Inmuebles", icon: Home },
  { href: `${P}/solicitudes`, label: "Solicitudes", icon: Inbox },
  { href: `${P}/visitas`, label: "Visitas", icon: CalendarDays },
  { href: `${P}/cuenta`, label: "Mi cuenta", icon: UserCog },
];

const active = (path: string, href: string) => (href === P ? path === P : path.startsWith(href));

export function AgencySidebarNav() {
  const path = usePathname();
  return (
    <nav className="space-y-0.5">
      {AGENCY_NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors", active(path, href) ? "bg-white/10 font-medium text-white" : "text-sand-300 hover:bg-white/5 hover:text-white")}
        >
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
    </nav>
  );
}

export function AgencyMobileNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-none">
      {AGENCY_NAV.map(({ href, label }) => (
        <Link key={href} href={href} className={cn("shrink-0 rounded-full px-3 py-1.5 text-[13px]", active(path, href) ? "bg-white text-ink-800" : "text-sand-200 hover:text-white")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
