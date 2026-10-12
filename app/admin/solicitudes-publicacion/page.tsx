import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { BUSINESS_TYPES, OPERATIONS, PROPERTY_TYPES, PUBLICATION_REQUEST_STATUSES } from "@/services/listings/catalog";
import { listPublicationRequests } from "@/services/listings/publicationRequests";

export const metadata = { title: "Solicitudes de publicación" };
export const dynamic = "force-dynamic";

const TONES = { NEW: "blue", IN_REVIEW: "amber", CONVERTED: "green", REJECTED: "neutral" } as const;

export default async function PublicationRequestsPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  await requireAdmin();
  const estado = (await searchParams).estado;
  const requests = await listPublicationRequests(estado && estado in PUBLICATION_REQUEST_STATUSES ? estado : undefined);

  return (
    <>
      <PageHeader
        title="Solicitudes de publicación"
        description="Propietarios que piden publicar gratis su vivienda o su amarre. Revísalas, contacta con ellos y crea el anuncio desde la solicitud."
      />
      <nav className="mb-4 flex flex-wrap gap-1.5">
        {[["", "Todas"], ...Object.entries(PUBLICATION_REQUEST_STATUSES)].map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/solicitudes-publicacion${k ? `?estado=${k}` : ""}`}
            className={(estado ?? "") === k ? "rounded-full bg-ink-800 px-3 py-1.5 text-[13px] text-white" : "rounded-full bg-white px-3 py-1.5 text-[13px] text-ink-600 ring-1 ring-sand-200 hover:bg-sand-50"}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Card className="overflow-x-auto">
        {requests.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-ink-400">No hay solicitudes{estado ? " en este estado" : " todavía"}.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Recibida</th>
                <th>Qué</th>
                <th>Dónde</th>
                <th>Propietario</th>
                <th>Fotos</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-sand-50">
                  <td className="text-ink-500">
                    <Link href={`/admin/solicitudes-publicacion/${r.id}`} className="hover:underline">
                      {formatDateTime(r.createdAt)}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/admin/solicitudes-publicacion/${r.id}`} className="font-medium text-ink-800 hover:underline">
                      {r.category === "MOORING"
                        ? "Amarre"
                        : r.category === "BUSINESS"
                          ? `Negocio · ${BUSINESS_TYPES[r.propertyType as keyof typeof BUSINESS_TYPES] ?? r.propertyType}`
                          : (PROPERTY_TYPES[r.propertyType as keyof typeof PROPERTY_TYPES] ?? r.propertyType)}
                    </Link>
                    <p className="text-xs text-ink-400">{OPERATIONS[r.operation as keyof typeof OPERATIONS]}</p>
                  </td>
                  <td className="text-ink-600">{[r.portName, r.municipality].filter(Boolean).join(", ")}</td>
                  <td>
                    <p className="font-medium text-ink-800">{r.name}</p>
                    <p className="text-xs text-ink-500">{r.email}</p>
                  </td>
                  <td className="text-center">{r.photos.split(",").filter(Boolean).length}</td>
                  <td>
                    <Badge tone={TONES[r.status as keyof typeof TONES] ?? "neutral"}>{PUBLICATION_REQUEST_STATUSES[r.status as keyof typeof PUBLICATION_REQUEST_STATUSES]}</Badge>
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
