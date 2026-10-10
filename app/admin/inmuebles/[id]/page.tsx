import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ListingForm } from "@/components/listings/ListingForm";
import { AuthorizationDocUpload, PhotoManager } from "@/components/listings/PhotoManager";
import { StatusPanel } from "@/components/listings/StatusPanel";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/db/client";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { PROVINCES } from "@/services/study/geo";
import { INQUIRY_STATUSES, PUBLIC_STATUSES, listingPath, type ListingStatus } from "@/services/listings/catalog";
import { ListingError, availableTransitions, getListing, publishProblems } from "@/services/listings/listings";
import { deleteListingAction, deletePhotoAction, mainPhotoAction, movePhotoAction, transitionAction, updateListingAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inmueble" };

export default async function AdminListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const actor = { kind: "admin" as const, id: user.id };
  const listing = await getListing(actor, id).catch((e) => {
    if (e instanceof ListingError) notFound();
    throw e;
  });
  const created = (await searchParams).creado === "1";
  const [inquiries, inquiryCount] = await Promise.all([
    // Las solicitudes de anuncios de inmobiliarias las gestiona la inmobiliaria (datos de su CRM)
    listing.agencyId ? Promise.resolve([]) : prisma.listingInquiry.findMany({ where: { listingId: listing.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.listingInquiry.count({ where: { listingId: listing.id } }),
  ]);
  const provinces = [...PROVINCES].sort((a, b) => a.name.localeCompare(b.name, "es")).map(({ code, name }) => ({ code, name }));
  const isPublic = PUBLIC_STATUSES.includes(listing.status as ListingStatus);

  return (
    <div>
      <Link href="/admin/inmuebles" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Inmuebles
      </Link>
      <PageHeader title={listing.title} description={`${listing.reference} · Anunciante: ${listing.agency?.name ?? "FINCALIA360"}`} />
      {created && <p className="mb-5 rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-700">Borrador creado. Ahora sube las fotos y el documento de autorización.</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <PhotoManager
            photos={listing.photos.map((p) => ({ id: p.id, key: p.key, isMain: p.isMain }))}
            uploadUrl={`/api/admin/inmuebles/${listing.id}/fotos`}
            onMain={mainPhotoAction}
            onMove={movePhotoAction}
            onDelete={deletePhotoAction}
          />
          <AuthorizationDocUpload uploadUrl={`/api/admin/inmuebles/${listing.id}/autorizacion`} downloadUrl={`/api/admin/inmuebles/${listing.id}/autorizacion`} hasDoc={Boolean(listing.authorizationDoc)} />
          <ListingForm key={listing.updatedAt.toISOString()} action={updateListingAction.bind(null, listing.id)} values={listing} provinces={provinces} submitLabel="Guardar cambios" />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <StatusPanel
            status={listing.status}
            operation={listing.operation}
            problems={publishProblems(listing, listing.photos.length)}
            transitions={availableTransitions(actor, listing.status)}
            action={transitionAction.bind(null, listing.id)}
            publicUrl={isPublic ? listingPath(listing) : null}
            reviewNote={listing.reviewNote}
            isAdmin
            onDelete={deleteListingAction.bind(null, listing.id)}
          />
          <div className="rounded-2xl border border-sand-200 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-ink-800">Solicitudes recibidas ({inquiryCount})</h2>
            {listing.agencyId ? (
              <p className="mt-2 text-[13px] text-ink-500">Las gestiona {listing.agency?.name} desde su CRM.</p>
            ) : inquiries.length === 0 ? (
              <p className="mt-2 text-[13px] text-ink-400">Ninguna todavía.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {inquiries.map((i) => (
                  <li key={i.id} className="border-b border-sand-100 pb-3 text-[13px] last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-ink-800">{i.name}</p>
                      <Badge tone={i.status === "NEW" ? "blue" : "neutral"}>{INQUIRY_STATUSES[i.status as keyof typeof INQUIRY_STATUSES]}</Badge>
                    </div>
                    <p className="text-ink-500">
                      {i.email}
                      {i.phone ? ` · ${i.phone}` : ""}
                    </p>
                    {i.wantsVisit && <p className="text-terracotta-600">Quiere visitarlo</p>}
                    {i.message && <p className="mt-1 text-ink-600">{i.message}</p>}
                    <p className="mt-1 text-ink-400">{formatDateTime(i.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
            {!listing.agencyId && inquiries.length > 0 && (
              <Link href="/admin/inmuebles?vista=solicitudes" className="mt-2 inline-block text-[13px] font-medium text-ink-700 underline">
                Gestionar solicitudes
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
