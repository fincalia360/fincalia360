/* eslint-disable @next/next/no-img-element -- miniaturas ya optimizadas */
import Link from "next/link";
import { ImageOff, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/db/client";
import { formatMadrid } from "@/lib/dates";
import { requireAgency } from "@/services/agency/auth";
import { ACTIVE_STATUSES, LISTING_STATUSES, LISTING_STATUS_TONES, OPERATIONS, formatPrice, photoUrl } from "@/services/listings/catalog";
import { listListings } from "@/services/listings/listings";

export const metadata = { title: "Inmuebles" };

const P = "/zona-inmobiliarias/panel";
const TABS = [
  ["", "Todos"],
  ["DRAFT", "Borradores"],
  ["REVIEW", "En revisión"],
  ["PUBLISHED", "Publicados"],
  ["RESERVED", "Reservados"],
  ["UNPUBLISHED", "Retirados"],
  ["SOLD", "Vendidos"],
  ["RENTED", "Alquilados"],
] as const;

export default async function AgencyListingsPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const s = await requireAgency();
  const sp = await searchParams;
  const [listings, agency, active] = await Promise.all([
    listListings({ kind: "agency", agencyId: s.agencyId, userId: s.userId, userName: s.userName }, { status: sp.estado }),
    prisma.agency.findUniqueOrThrow({ where: { id: s.agencyId }, select: { maxListings: true } }),
    prisma.listing.count({ where: { agencyId: s.agencyId, status: { in: ACTIVE_STATUSES } } }),
  ]);

  return (
    <>
      <PageHeader
        title="Inmuebles"
        description={`Tus anuncios en el portal de FINCALIA360. Antes de publicarse, FINCALIA360 los revisa. Activos: ${active} de ${agency.maxListings}.`}
        actions={
          active < agency.maxListings ? (
            <ButtonLink href={`${P}/inmuebles/nuevo`} variant="accent">
              <Plus className="h-4 w-4" /> Nuevo inmueble
            </ButtonLink>
          ) : (
            <span className="text-sm text-amber-700">Has llegado al límite de inmuebles activos de tu plan.</span>
          )
        }
      />
      <nav className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map(([k, label]) => (
          <Link
            key={k}
            href={`${P}/inmuebles${k ? `?estado=${k}` : ""}`}
            className={(sp.estado ?? "") === k ? "rounded-full bg-ink-800 px-3 py-1.5 text-[13px] text-white" : "rounded-full bg-white px-3 py-1.5 text-[13px] text-ink-600 ring-1 ring-sand-200 hover:bg-sand-50"}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Card className="overflow-x-auto">
        {listings.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-ink-500">{sp.estado ? "No hay inmuebles en este estado." : "Todavía no has creado ningún inmueble."}</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th></th>
                <th>Inmueble</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Solicitudes</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="hover:bg-sand-50">
                  <td className="w-20">
                    <Link href={`${P}/inmuebles/${l.id}`}>
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
                    <Link href={`${P}/inmuebles/${l.id}`} className="font-medium text-ink-800 hover:underline">
                      {l.title}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {l.reference} · {OPERATIONS[l.operation as keyof typeof OPERATIONS]} · {l.municipality}
                    </p>
                  </td>
                  <td className="font-medium">{formatPrice(l.price, l.operation)}</td>
                  <td>
                    <Badge tone={LISTING_STATUS_TONES[l.status]}>{LISTING_STATUSES[l.status as keyof typeof LISTING_STATUSES]}</Badge>
                  </td>
                  <td className="text-center">{l._count.inquiries}</td>
                  <td className="text-ink-500">{formatMadrid(l.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
