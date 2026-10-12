/* eslint-disable @next/next/no-img-element -- miniaturas ya optimizadas */
import Link from "next/link";
import { Plus, ImageOff, Anchor } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/db/client";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { INQUIRY_STATUSES, LISTING_STATUSES, LISTING_STATUS_TONES, OPERATIONS, formatPrice, photoUrl } from "@/services/listings/catalog";
import { listListings } from "@/services/listings/listings";
import { listAllInquiries } from "@/services/listings/inquiries";
import { listingCounts } from "@/services/listings/listingStats";
import { inquiryStatusAction } from "./actions";

export const metadata = { title: "Anuncios" };
export const dynamic = "force-dynamic";

type Search = { estado?: string; op?: string; q?: string; anunciante?: string; vista?: string; tipo?: string };

const TABS = [
  ["", "Todos"],
  ["REVIEW", "Pendientes de revisión"],
  ["DRAFT", "Borradores"],
  ["PUBLISHED", "Publicados"],
  ["RESERVED", "Reservados"],
  ["UNPUBLISHED", "Retirados"],
] as const;

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const actor = { kind: "admin" as const, id: user.id };

  if (sp.vista === "solicitudes") {
    const inquiries = await listAllInquiries({ own: true });
    return (
      <>
        <PageHeader title="Inmuebles" description="Solicitudes de información y visitas de los inmuebles publicados por FINCALIA360." />
        <Tabs current="solicitudes" />
        <Card className="overflow-x-auto">
          {inquiries.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-400">Todavía no hay solicitudes.</p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Inmueble</th>
                  <th>Persona</th>
                  <th>Mensaje</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((i) => (
                  <tr key={i.id}>
                    <td className="text-ink-500">{formatDateTime(i.createdAt)}</td>
                    <td>
                      <Link href={`/admin/inmuebles/${i.listing.id}`} className="font-medium text-ink-800 hover:underline">
                        {i.listing.reference}
                      </Link>
                    </td>
                    <td>
                      <p className="font-medium text-ink-800">{i.name}</p>
                      <p className="text-xs text-ink-500">
                        {i.email}
                        {i.phone ? ` · ${i.phone}` : ""}
                      </p>
                    </td>
                    <td className="max-w-xs whitespace-normal text-[13px] text-ink-600">
                      {i.wantsVisit && <Badge tone="terracotta">Quiere visitarlo</Badge>} {i.message}
                    </td>
                    <td>
                      <form action={inquiryStatusAction.bind(null, i.id)} className="flex items-center gap-2">
                        <select name="status" defaultValue={i.status} className="field h-8 py-0 text-[13px]">
                          {Object.entries(INQUIRY_STATUSES).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                        <button className="text-[13px] font-medium text-ink-700 hover:underline">Guardar</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </>
    );
  }

  const [listings, agencies, reviewCount] = await Promise.all([
    listListings(actor, { status: sp.estado, operation: sp.op, q: sp.q, agencyId: sp.anunciante, category: sp.tipo }),
    prisma.agency.findMany({ where: { crmAccess: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.listing.count({ where: { status: "REVIEW" } }),
  ]);
  const visits = await listingCounts(listings.map((l) => l.id));

  return (
    <>
      <PageHeader
        title="Anuncios"
        description="Viviendas, locales, oficinas, garajes, terrenos y amarres. Nada se publica sin pasar las comprobaciones."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/inmuebles/nuevo" variant="accent">
              <Plus className="h-4 w-4" /> Nuevo anuncio
            </ButtonLink>
            <ButtonLink href="/admin/inmuebles/nuevo?tipo=amarre" variant="outline">
              <Anchor className="h-4 w-4" /> Nuevo amarre
            </ButtonLink>
          </div>
        }
      />
      <Tabs current="" />
      <nav aria-label="Tipo de anuncio" className="mb-3 inline-flex rounded-full bg-sand-100 p-1 text-[13px] font-medium">
        {(
          [
            ["", "Todos"],
            ["HOME", "Inmuebles"],
            ["MOORING", "Amarres"],
          ] as const
        ).map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/inmuebles?${new URLSearchParams({ ...(k ? { tipo: k } : {}), ...(sp.estado ? { estado: sp.estado } : {}) }).toString()}`}
            className={(sp.tipo ?? "") === k ? "rounded-full bg-white px-4 py-1.5 text-ink-800 shadow-sm" : "rounded-full px-4 py-1.5 text-ink-500 hover:text-ink-800"}
          >
            {label}
          </Link>
        ))}
      </nav>
      <nav className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/inmuebles?${new URLSearchParams({ ...(k ? { estado: k } : {}), ...(sp.tipo ? { tipo: sp.tipo } : {}) }).toString()}`}
            className={(sp.estado ?? "") === k ? "rounded-full bg-ink-800 px-3 py-1.5 text-[13px] text-white" : "rounded-full bg-white px-3 py-1.5 text-[13px] text-ink-600 ring-1 ring-sand-200 hover:bg-sand-50"}
          >
            {label}
            {k === "REVIEW" && reviewCount > 0 && <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-ink-900">{reviewCount}</span>}
          </Link>
        ))}
      </nav>
      <form className="mb-4 flex flex-wrap gap-2">
        {sp.estado && <input type="hidden" name="estado" value={sp.estado} />}
        {sp.tipo && <input type="hidden" name="tipo" value={sp.tipo} />}
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Referencia, título, municipio o puerto" className="field h-10 max-w-xs py-0" />
        <select name="op" defaultValue={sp.op ?? ""} className="field h-10 w-auto py-0">
          <option value="">Venta y alquiler</option>
          {Object.entries(OPERATIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="anunciante" defaultValue={sp.anunciante ?? ""} className="field h-10 w-auto py-0">
          <option value="">Todos los anunciantes</option>
          <option value="OWN">FINCALIA360</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-full bg-ink-800 px-4 text-sm text-white">Filtrar</button>
      </form>

      <Card className="overflow-x-auto">
        {listings.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-ink-500">No hay inmuebles {sp.estado || sp.q || sp.op || sp.anunciante ? "con estos filtros" : "todavía"}.</p>
            <ButtonLink href="/admin/inmuebles/nuevo" variant="outline" className="mt-4">
              Crear el primero
            </ButtonLink>
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th></th>
                <th>Inmueble</th>
                <th>Precio</th>
                <th>Anunciante</th>
                <th>Estado</th>
                <th>Solicitudes</th>
                <th title="Visitas a la ficha (últimos 30 días / total) y veces compartido">Visitas</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="hover:bg-sand-50">
                  <td className="w-20">
                    <Link href={`/admin/inmuebles/${l.id}`}>
                      {l.photos[0] ? (
                        <img src={photoUrl(l.photos[0].key, true)} alt="" className="h-12 w-16 rounded-md object-cover" />
                      ) : (
                        <span className="flex h-12 w-16 items-center justify-center rounded-md bg-sand-100 text-ink-300">
                          <ImageOff className="h-4 w-4" />
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="max-w-sm whitespace-normal">
                    <Link href={`/admin/inmuebles/${l.id}`} className="font-medium text-ink-800 hover:underline">
                      {l.title}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {l.reference} · {l.category === "MOORING" ? "Amarre · " : ""}
                      {OPERATIONS[l.operation as keyof typeof OPERATIONS]} · {l.category === "MOORING" && l.portName ? `${l.portName}, ` : ""}
                      {l.municipality}
                    </p>
                  </td>
                  <td className="font-medium">{formatPrice(l.price, l.operation, l.rentPeriod)}</td>
                  <td className="text-ink-600">{l.agency?.name ?? "FINCALIA360"}</td>
                  <td>
                    <Badge tone={LISTING_STATUS_TONES[l.status]}>{LISTING_STATUSES[l.status as keyof typeof LISTING_STATUSES]}</Badge>
                  </td>
                  <td className="text-center">{l._count.inquiries}</td>
                  <td className="whitespace-nowrap text-center tabular-nums">
                    <span className="font-medium text-ink-800">{visits[l.id]?.views30 ?? 0}</span>
                    <span className="text-ink-400"> / {visits[l.id]?.views ?? 0}</span>
                    {(visits[l.id]?.shares ?? 0) > 0 && <p className="text-[11px] text-ink-400">{visits[l.id].shares} compartido</p>}
                  </td>
                  <td className="text-ink-500">{formatDateTime(l.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function Tabs({ current }: { current: "" | "solicitudes" }) {
  return (
    <div className="mb-5 flex gap-6 border-b border-sand-200 text-sm">
      <Link href="/admin/inmuebles" className={current === "" ? "-mb-px border-b-2 border-ink-800 pb-2 font-semibold text-ink-800" : "pb-2 text-ink-500 hover:text-ink-800"}>
        Anuncios
      </Link>
      <Link href="/admin/inmuebles?vista=solicitudes" className={current === "solicitudes" ? "-mb-px border-b-2 border-ink-800 pb-2 font-semibold text-ink-800" : "pb-2 text-ink-500 hover:text-ink-800"}>
        Solicitudes de interesados
      </Link>
      <Link href="/admin/solicitudes-publicacion" className="pb-2 text-ink-500 hover:text-ink-800">
        Solicitudes de publicación de propietarios
      </Link>
    </div>
  );
}
