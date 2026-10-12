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
import { isPortalProvince } from "@/services/listings/catalog";
import { INQUIRY_STATUSES, PUBLIC_STATUSES, listingPath, type ListingStatus } from "@/services/listings/catalog";
import { ListingError, availableTransitions, getListing, publishProblems } from "@/services/listings/listings";
import { DuplicateButton } from "@/components/listings/DuplicateButton";
import { TranslationsPanel } from "@/components/listings/TranslationsPanel";
import { listingStatsDetail } from "@/services/listings/listingStats";
import { GEO_ATTRIBUTION } from "@/services/geo/ipLocation";
import { TRANSLATABLE, parseStored, sourceTexts, translationsFresh } from "@/services/listings/translations";
import {
  aiCopyAction,
  deleteListingAction,
  deletePhotoAction,
  duplicateListingAction,
  mainPhotoAction,
  saveTranslationsAction,
  translateListingAction,
  movePhotoAction,
  transitionAction,
  updateListingAction,
} from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inmueble" };

export default async function AdminListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string; duplicado?: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const actor = { kind: "admin" as const, id: user.id };
  const listing = await getListing(actor, id).catch((e) => {
    if (e instanceof ListingError) notFound();
    throw e;
  });
  const sp = await searchParams;
  const created = sp.creado === "1";
  const duplicated = sp.duplicado === "1";
  const [inquiries, inquiryCount] = await Promise.all([
    // Las solicitudes de anuncios de inmobiliarias las gestiona la inmobiliaria (datos de su CRM)
    listing.agencyId ? Promise.resolve([]) : prisma.listingInquiry.findMany({ where: { listingId: listing.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.listingInquiry.count({ where: { listingId: listing.id } }),
  ]);
  const provinces = PROVINCES.filter((p) => isPortalProvince(p.code)).sort((a, b) => a.name.localeCompare(b.name, "es")).map(({ code, name }) => ({ code, name }));
  const isPublic = PUBLIC_STATUSES.includes(listing.status as ListingStatus);
  const stored = parseStored(listing.translations);
  const translationStatus = !stored ? "none" : translationsFresh(listing) ? "fresh" : "stale";
  const translatedFields = TRANSLATABLE.filter((f) => f in sourceTexts(listing));

  return (
    <div>
      <Link href="/admin/inmuebles" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Anuncios
      </Link>
      <PageHeader
        title={listing.title}
        description={`${listing.category === "MOORING" ? "Amarre" : "Vivienda o inmueble"} · ${listing.reference} · Anunciante: ${listing.agency?.name ?? "FINCALIA360"}`}
      />
      {created && <p className="mb-5 rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-700">Borrador creado. Ahora sube las fotos y el documento de autorización.</p>}
      {duplicated && (
        <p className="mb-5 rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-700">
          Copia creada como borrador, con las mismas fotos. Cambia lo que haga falta, revisa la autorización y publícala cuando esté lista.
        </p>
      )}

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
          <ListingForm key={listing.updatedAt.toISOString()} action={updateListingAction.bind(null, listing.id)} values={listing}
            provinces={provinces}
            submitLabel="Guardar cambios"
            category={listing.category === "MOORING" ? "MOORING" : "HOME"}
            aiAction={async (raw, mode) => {
              "use server";
              return aiCopyAction(raw, mode, listing.id);
            }}
          />
          {!listing.agencyId && (
            <TranslationsPanel
              status={translationStatus}
              langs={stored?.langs ?? {}}
              fields={translatedFields}
              onTranslate={translateListingAction.bind(null, listing.id)}
              onSave={saveTranslationsAction.bind(null, listing.id)}
            />
          )}
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
          <DuplicateButton action={duplicateListingAction.bind(null, listing.id)} />
          <ListingStatsCard stats={await listingStatsDetail(listing.id)} />
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

const CHANNELS: Record<string, string> = { whatsapp: "WhatsApp", facebook: "Facebook", x: "X", email: "Email", copy: "Enlace copiado", native: "Menú del móvil" };

/** Visitas a la ficha pública y veces compartido (estadística propia, anónima). */
function ListingStatsCard({ stats }: { stats: Awaited<ReturnType<typeof listingStatsDetail>> }) {
  const max = Math.max(1, ...stats.byDay.map((d) => d.views));
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-5">
      <h2 className="text-[15px] font-semibold text-ink-800">Visitas a la ficha</h2>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ["7 días", stats.last7],
            ["30 días", stats.last30],
            ["Total", stats.total],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-xl bg-sand-50 py-2">
            <dd className="text-xl font-semibold tabular-nums text-ink-800">{v}</dd>
            <dt className="text-[11.5px] text-ink-500">{k}</dt>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex h-12 items-end gap-[2px]" aria-label="Visitas por día, últimos 30 días">
        {stats.byDay.map((d) => (
          <span key={d.date} title={`${d.date}: ${d.views}`} className="flex-1 rounded-sm bg-terracotta-500/80" style={{ height: `${Math.max(4, (d.views / max) * 100)}%`, opacity: d.views ? 1 : 0.15 }} />
        ))}
      </div>
      <p className="mt-3 text-[13px] text-ink-600">
        Compartido <strong>{stats.shares}</strong> {stats.shares === 1 ? "vez" : "veces"}
        {stats.shares > 0 && (
          <span className="text-ink-400">
            {" "}
            ({Object.entries(stats.byChannel)
              .map(([c, n]) => `${CHANNELS[c] ?? c}: ${n}`)
              .join(", ")})
          </span>
        )}
      </p>
      {stats.byPlace.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[13px] font-semibold text-ink-700">De dónde vienen las visitas (aprox.)</h3>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {stats.byPlace.slice(0, 10).map((p) => (
              <li key={p.place} className="flex items-center gap-2">
                <span className="w-32 shrink-0 truncate text-ink-600" title={p.place}>
                  {p.place}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand-100">
                  <span className="block h-full rounded-full bg-ink-700" style={{ width: `${(p.views / Math.max(1, stats.total)) * 100}%` }} />
                </span>
                <span className="w-8 text-right tabular-nums text-ink-800">{p.views}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-snug text-ink-400">
            Estimado a partir de la IP, que no se guarda. Con datos móviles suele aparecer la ciudad del operador.{" "}
            <a href={GEO_ATTRIBUTION.url} target="_blank" rel="noreferrer" className="underline">
              {GEO_ATTRIBUTION.text}
            </a>
          </p>
        </div>
      )}
      <p className="mt-2 text-[11.5px] leading-snug text-ink-400">Una visita por persona cada 30 minutos; no cuenta robots ni tus visitas al panel. Sin cookies.</p>
    </div>
  );
}
