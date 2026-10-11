import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleHelp, ExternalLink, XCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteSearchButton, SearchEditForm, SearchStatusButtons } from "@/components/admin/SearchRequestActions";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { PORTAL_PROVINCE_CODES, formatPrice } from "@/services/listings/catalog";
import { SEARCH_STATUSES, SEARCH_TONES, SEARCH_TYPES, splitMunicipalities } from "@/services/searchRequests/catalog";
import { findMatches, type MatchResult } from "@/services/searchRequests/matching";
import { SearchRequestError, contactDataIn, getSearchRequest } from "@/services/searchRequests/searchRequests";
import { PROVINCES, getProvince } from "@/services/study/geo";
import { deleteSearchRequestAction, searchStatusAction, updateSearchRequestAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitud Busco comprar" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b border-sand-100 py-2 text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-800">{value}</dd>
    </div>
  );
}

const ICON = { ok: CheckCircle2, no: XCircle, unknown: CircleHelp };
const COLOR = { ok: "text-pine-600", no: "text-red-600", unknown: "text-amber-600" };

function MatchCard({ m }: { m: MatchResult }) {
  const l = m.listing;
  return (
    <li className="rounded-xl border border-sand-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink-800">{l.title}</p>
          <p className="text-xs text-ink-500">
            {l.reference} · {l.municipality} · {formatPrice(l.price, l.operation)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${m.full ? "bg-pine-50 text-pine-700" : "bg-amber-50 text-amber-800"}`}>
          {m.full ? "Encaja completamente" : "Encaja parcialmente"} · {m.score} %
        </span>
      </div>
      <ul className="mt-3 grid gap-1 text-[13px] sm:grid-cols-2">
        {m.checks.map((c) => {
          const Icon = ICON[c.result];
          return (
            <li key={c.label} className="flex items-start gap-1.5">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${COLOR[c.result]}`} />
              <span>
                <span className="font-medium text-ink-700">{c.label}:</span> <span className="text-ink-600">{c.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
        <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-ink-800 underline">
          Ver anuncio <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <Link href={`/admin/inmuebles/${l.id}`} className="text-ink-500 underline">
          Abrir en el panel
        </Link>
      </div>
    </li>
  );
}

export default async function SearchRequestAdminPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const r = await getSearchRequest(id).catch((e) => {
    if (e instanceof SearchRequestError) notFound();
    throw e;
  });
  const matches = await findMatches(r);
  const full = matches.filter((m) => m.full);
  const partial = matches.filter((m) => !m.full);
  const places = splitMunicipalities(r.municipalities);
  const what = SEARCH_TYPES[r.propertyType as keyof typeof SEARCH_TYPES] ?? r.propertyType;
  const op = r.operation === "RENT" ? "Alquiler" : "Compra";
  const warnings = contactDataIn(r.publicText);
  const provinces = PROVINCES.filter((x) => PORTAL_PROVINCE_CODES.includes(x.code))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map(({ code, name }) => ({ code, name }));

  return (
    <div>
      <Link href="/admin/busco-piso" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Solicitudes Busco comprar
      </Link>
      <PageHeader title={`${what} · ${op} · ${places.join(", ")}`} description={`${r.reference} · recibida el ${formatDateTime(r.createdAt)}`} />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-sand-200 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-ink-800">Coincidencias con los inmuebles publicados</h2>
            <p className="mt-1 text-xs text-ink-500">
              Se comparan solo inmuebles publicados de la web. Obligatorio: misma operación, provincia, una de las poblaciones, precio dentro del presupuesto máximo y tipo igual o
              parecido. El porcentaje mide las preferencias cumplidas; lo que no consta en el anuncio cuenta como medio punto y se indica. No se contacta con nadie.
            </p>
            {matches.length === 0 ? (
              <p className="mt-4 rounded-xl bg-sand-50 p-4 text-sm text-ink-500">Ahora mismo no hay inmuebles publicados que cumplan los criterios obligatorios.</p>
            ) : (
              <div className="mt-4 space-y-5">
                {full.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-pine-700">Encajan completamente ({full.length})</h3>
                    <ul className="mt-2 space-y-3">
                      {full.map((m) => (
                        <MatchCard key={m.listing.id} m={m} />
                      ))}
                    </ul>
                  </div>
                )}
                {partial.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-amber-800">Encajan parcialmente ({partial.length})</h3>
                    <ul className="mt-2 space-y-3">
                      {partial.map((m) => (
                        <MatchCard key={m.listing.id} m={m} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-sand-200 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-ink-800">Revisar y editar</h2>
            <p className="mt-1 text-xs text-ink-500">Decide qué se publica: la ficha pública muestra la búsqueda y el «texto que se publica», nunca el nombre ni el contacto.</p>
            {warnings.length > 0 && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">El texto público contiene {warnings.join(" y ")}. Quítalo antes de publicar.</p>
            )}
            {r.description && contactDataIn(r.description).length > 0 && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">La descripción original contiene datos de contacto: no la copies tal cual al texto público.</p>
            )}
            <div className="mt-4">
              <SearchEditForm
                action={updateSearchRequestAction.bind(null, r.id)}
                provinces={provinces}
                r={{
                  operation: r.operation,
                  propertyType: r.propertyType,
                  provinceCode: r.provinceCode,
                  municipalities: places,
                  zone: r.zone,
                  minPrice: r.minPrice,
                  maxPrice: r.maxPrice,
                  minBedrooms: r.minBedrooms,
                  minBathrooms: r.minBathrooms,
                  minArea: r.minArea,
                  maxArea: r.maxArea,
                  terrace: r.terrace,
                  elevator: r.elevator,
                  parking: r.parking,
                  exterior: r.exterior,
                  condition: r.condition,
                  description: r.description,
                  publicText: r.publicText,
                  adminNote: r.adminNote,
                }}
              />
            </div>
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-2xl border border-sand-200 bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-ink-800">Estado</h2>
              <Badge tone={SEARCH_TONES[r.status as keyof typeof SEARCH_TONES] ?? "neutral"}>{SEARCH_STATUSES[r.status as keyof typeof SEARCH_STATUSES] ?? r.status}</Badge>
            </div>
            <dl className="mt-2">
              <Row label="Publicada el" value={r.publishedAt ? formatDateTime(r.publishedAt) : null} />
              <Row label="Resuelta el" value={r.resolvedAt ? formatDateTime(r.resolvedAt) : null} />
            </dl>
            <div className="mt-4">
              <SearchStatusButtons action={searchStatusAction.bind(null, r.id)} status={r.status} />
            </div>
            {r.status === "PUBLISHED" && (
              <a href={`/busco-piso/solicitudes#${r.reference}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[13px] text-ink-600 underline">
                Ver la ficha pública <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="rounded-2xl border border-sand-200 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-ink-800">Contacto (privado)</h2>
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
              <Row label="Idioma" value={r.lang.toUpperCase()} />
              <Row label="Comunicaciones comerciales" value={r.marketingConsent ? "Acepta" : "No acepta"} />
              <Row label="Provincia" value={getProvince(r.provinceCode)?.name} />
            </dl>
            <p className="mt-3 text-xs leading-snug text-ink-400">
              Consentimiento ({r.consentVersion}): «{r.consentText}»
            </p>
          </div>

          <div className="rounded-2xl border border-sand-200 bg-white p-5">
            <DeleteSearchButton action={deleteSearchRequestAction.bind(null, r.id)} />
            <p className="mt-1 text-xs text-ink-400">Úsalo si la persona pide borrar sus datos, si ya no procede o pasados 12 meses sin actividad.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
