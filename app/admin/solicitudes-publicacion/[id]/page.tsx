/* eslint-disable @next/next/no-img-element -- fotos privadas servidas por la ruta del panel */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ConvertRequestForm, DeleteRequestButton, RequestStatusForm } from "@/components/admin/PublicationRequestActions";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { BUSINESS_TYPES, OPERATIONS, PROPERTY_TYPES, PUBLICATION_REQUEST_STATUSES, formatMeters, formatPrice } from "@/services/listings/catalog";
import { PublicationRequestError, getPublicationRequest } from "@/services/listings/publicationRequests";
import { getProvince } from "@/services/study/geo";
import { convertRequestAction, deleteRequestAction, requestStatusAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitud de publicación" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b border-sand-100 py-2 text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-800">{value}</dd>
    </div>
  );
}

export default async function PublicationRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const r = await getPublicationRequest(id).catch((e) => {
    if (e instanceof PublicationRequestError) notFound();
    throw e;
  });
  const mooring = r.category === "MOORING";
  const photos = r.photos.split(",").filter(Boolean);
  const business = r.category === "BUSINESS";
  const what = mooring ? "Amarre" : business ? `Traspaso · ${BUSINESS_TYPES[r.propertyType as keyof typeof BUSINESS_TYPES] ?? r.propertyType}` : (PROPERTY_TYPES[r.propertyType as keyof typeof PROPERTY_TYPES] ?? r.propertyType);
  const op = OPERATIONS[r.operation as keyof typeof OPERATIONS];
  const suggestedTitle = business
    ? (r.title ?? `Traspaso de ${(BUSINESS_TYPES[r.propertyType as keyof typeof BUSINESS_TYPES] ?? "negocio").toLowerCase()} en ${r.municipality}`)
    : mooring
    ? `Amarre${r.berthLength ? ` de ${formatMeters(r.berthLength)}` : ""} en ${r.portName ?? r.municipality}`
    : `${what} en ${r.operation === "RENT" ? "alquiler" : "venta"} en ${r.municipality}`;
  const tone = r.status === "CONVERTED" ? "green" : r.status === "NEW" ? "blue" : r.status === "IN_REVIEW" ? "amber" : "neutral";

  return (
    <div>
      <Link href="/admin/solicitudes-publicacion" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Solicitudes de publicación
      </Link>
      <PageHeader title={`${what} · ${op} · ${r.municipality}`} description={`Recibida el ${formatDateTime(r.createdAt)}`} />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-sand-200 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-ink-800">Fotografías ({photos.length})</h2>
            {photos.length === 0 ? (
              <p className="mt-2 text-sm text-ink-400">No ha enviado fotos.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.map((key, i) => (
                  <a
                    key={key}
                    href={`/api/admin/solicitudes-publicacion/foto/${key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-[4/3] overflow-hidden rounded-xl bg-sand-100"
                  >
                    <img src={`/api/admin/solicitudes-publicacion/foto/${key}`} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-ink-400">Fotos privadas (sin metadatos). Solo las ve el administrador hasta que crees el anuncio.</p>
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-sand-200 bg-white p-5">
              <h2 className="text-[15px] font-semibold text-ink-800">{mooring ? "Amarre" : "Inmueble"}</h2>
              <dl className="mt-2">
                <Row label="Operación" value={op} />
                <Row label="Tipo" value={what} />
                <Row label="Nombre del negocio" value={r.title} />
                <Row label="Puerto" value={r.portName} />
                <Row label="Municipio" value={`${r.municipality} (${getProvince(r.provinceCode)?.name ?? r.provinceCode})`} />
                <Row label={mooring ? "Ubicación en el puerto" : "Zona"} value={r.zone} />
                <Row label={mooring ? "Nº de amarre (privado)" : "Dirección (privada)"} value={r.address} />
                <Row label={business ? "Precio del traspaso" : "Precio indicado"} value={r.price ? formatPrice(r.price, r.operation) : "Sin indicar"} />
                <Row label="Alquiler del local" value={r.premisesRent ? `${formatPrice(r.premisesRent, "SALE")}/mes` : null} />
                <Row label="Superficie" value={r.builtArea ? `${r.builtArea} m²` : null} />
                <Row label="Habitaciones" value={r.bedrooms} />
                <Row label="Baños" value={r.bathrooms} />
                <Row label="Medidas" value={r.berthLength ? `${formatMeters(r.berthLength)} × ${formatMeters(r.berthWidth)}` : null} />
              </dl>
            </div>
            <div className="rounded-2xl border border-sand-200 bg-white p-5">
              <h2 className="text-[15px] font-semibold text-ink-800">Propietario</h2>
              <dl className="mt-2">
                <Row label="Nombre" value={r.name} />
                <Row
                  label="Email"
                  value={
                    <a href={`mailto:${r.email}`} className="underline">
                      {r.email}
                    </a>
                  }
                />
                <Row
                  label="Teléfono"
                  value={
                    r.phone ? (
                      <a href={`tel:${r.phone}`} className="underline">
                        {r.phone}
                      </a>
                    ) : (
                      "No indicado"
                    )
                  }
                />
                <Row label="Comunicaciones comerciales" value={r.marketingConsent ? "Acepta" : "No acepta"} />
              </dl>
              <p className="mt-3 text-xs leading-snug text-ink-400">
                Consentimiento ({r.consentVersion}): «{r.consentText}»
              </p>
            </div>
          </section>

          {r.description && (
            <section className="rounded-2xl border border-sand-200 bg-white p-5">
              <h2 className="text-[15px] font-semibold text-ink-800">Descripción del propietario</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-600">{r.description}</p>
            </section>
          )}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-2xl border border-sand-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink-800">Estado</h2>
              <Badge tone={tone}>{PUBLICATION_REQUEST_STATUSES[r.status as keyof typeof PUBLICATION_REQUEST_STATUSES]}</Badge>
            </div>
            <div className="mt-4">
              <RequestStatusForm action={requestStatusAction.bind(null, r.id)} status={r.status} note={r.adminNote} />
            </div>
          </div>
          <div className="rounded-2xl border border-sand-200 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-ink-800">Anuncio</h2>
            {r.listingId ? (
              <Link href={`/admin/inmuebles/${r.listingId}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-800 underline">
                Ver el anuncio creado <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <div className="mt-3">
                <ConvertRequestForm action={convertRequestAction.bind(null, r.id)} title={suggestedTitle} price={r.price} />
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-sand-200 bg-white p-5">
            <DeleteRequestButton action={deleteRequestAction.bind(null, r.id)} />
            <p className="mt-1 text-xs text-ink-400">Úsalo si el propietario pide borrar sus datos o si la solicitud no procede.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
