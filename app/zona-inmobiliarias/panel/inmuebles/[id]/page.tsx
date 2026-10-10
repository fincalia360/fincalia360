import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ListingForm } from "@/components/listings/ListingForm";
import { AuthorizationDocUpload, PhotoManager } from "@/components/listings/PhotoManager";
import { StatusPanel } from "@/components/listings/StatusPanel";
import { prisma } from "@/db/client";
import { formatMadrid } from "@/lib/dates";
import { requireAgency } from "@/services/agency/auth";
import { PROVINCES } from "@/services/study/geo";
import { PUBLIC_STATUSES, listingPath, type ListingStatus } from "@/services/listings/catalog";
import { ListingError, availableTransitions, getListing, publishProblems, type ListingActor } from "@/services/listings/listings";
import { deleteListingAction, deletePhotoAction, mainPhotoAction, movePhotoAction, transitionAction, updateListingAction } from "../../actions";

const P = "/zona-inmobiliarias/panel";

export const metadata = { title: "Inmueble" };

export default async function AgencyListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string }> }) {
  const s = await requireAgency();
  const actor: ListingActor = { kind: "agency", agencyId: s.agencyId, userId: s.userId, userName: s.userName };
  const { id } = await params;
  const listing = await getListing(actor, id).catch((e) => {
    if (e instanceof ListingError) notFound();
    throw e;
  });
  const [owners, inquiries] = await Promise.all([
    prisma.agencyContact.findMany({ where: { agencyId: s.agencyId, kind: { in: ["OWNER_SELL", "OWNER_RENT"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.listingInquiry.findMany({ where: { listingId: listing.id, agencyId: s.agencyId }, orderBy: { createdAt: "desc" }, take: 50, include: { contact: { select: { id: true } } } }),
  ]);
  const provinces = [...PROVINCES].sort((a, b) => a.name.localeCompare(b.name, "es")).map(({ code, name }) => ({ code, name }));
  const isPublic = PUBLIC_STATUSES.includes(listing.status as ListingStatus);

  return (
    <div>
      <Link href={`${P}/inmuebles`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Inmuebles
      </Link>
      <PageHeader title={listing.title} description={listing.reference} />
      {(await searchParams).creado === "1" && <p className="mb-5 rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-700">Borrador creado. Ahora sube las fotos y el documento de autorización.</p>}
      {isPublic && (
        <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este anuncio está publicado. Si cambias sus datos o fotos, volverá a revisión de FINCALIA360 y dejará de verse hasta que se apruebe.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <PhotoManager
            photos={listing.photos.map((p) => ({ id: p.id, key: p.key, isMain: p.isMain }))}
            uploadUrl={`/api/zona/inmuebles/${listing.id}/fotos`}
            onMain={mainPhotoAction}
            onMove={movePhotoAction}
            onDelete={deletePhotoAction}
          />
          <AuthorizationDocUpload uploadUrl={`/api/zona/inmuebles/${listing.id}/autorizacion`} downloadUrl={`/api/zona/inmuebles/${listing.id}/autorizacion`} hasDoc={Boolean(listing.authorizationDoc)} />
          <ListingForm
            key={listing.updatedAt.toISOString()}
            action={updateListingAction.bind(null, listing.id)}
            values={listing}
            provinces={provinces}
            ownerContacts={owners}
            agencyMode
            submitLabel="Guardar cambios"
          />
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
            isAdmin={false}
            onDelete={deleteListingAction.bind(null, listing.id)}
          />
          <div className="rounded-2xl border border-sand-200 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-ink-800">Solicitudes recibidas ({inquiries.length})</h2>
            {inquiries.length === 0 ? (
              <p className="mt-2 text-[13px] text-ink-400">Ninguna todavía.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {inquiries.map((i) => (
                  <li key={i.id} className="border-b border-sand-100 pb-3 text-[13px] last:border-0">
                    {i.contact ? (
                      <Link href={`${P}/contactos/${i.contact.id}`} className="font-medium text-ink-800 hover:underline">
                        {i.name}
                      </Link>
                    ) : (
                      <p className="font-medium text-ink-800">{i.name}</p>
                    )}
                    {i.wantsVisit && <p className="text-terracotta-600">Quiere visitarlo</p>}
                    {i.message && <p className="text-ink-600">{i.message}</p>}
                    <p className="text-ink-400">{formatMadrid(i.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
