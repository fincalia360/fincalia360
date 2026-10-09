import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDateTime, formatEUR } from "@/lib/utils";
import { COMMERCIAL_STATUS_LABELS, listStudies, type CommercialStatus } from "@/services/study/adminStudyService";
import { CONFIDENCE_LABELS, PROPERTY_KIND_LABELS, type Confidence, type PropertyKind } from "@/services/study/types";

export const metadata = { title: "Estudios vender/alquilar" };

const TENSIONED: Record<string, string> = { DECLARED: "Sí", PARTIAL: "Parcial", EXPIRED: "Vencida", NOT_FOUND: "No", UNKNOWN: "Sin verificar" };

export default async function StudiesPage({ searchParams }: { searchParams: Promise<{ requested?: string }> }) {
  const { requested } = await searchParams;
  const studies = await listStudies({ requested: requested === "1" });
  const requestedCount = studies.filter((s) => s.valuationRequested).length;

  return (
    <>
      <PageHeader
        title="Estudios vender / alquilar"
        description="Estudios generados por propietarios. Los datos de contacto solo existen si el propietario solicitó una valoración y dio su consentimiento."
        actions={
          <a href="/api/admin/studies/export" className={buttonClasses({ variant: "outline" })}>
            <Download className="h-4 w-4" /> Exportar CSV (datos autorizados)
          </a>
        }
      />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/admin/studies" className={buttonClasses({ variant: requested === "1" ? "ghost" : "primary", size: "sm" })}>
          Todos
        </Link>
        <Link href="/admin/studies?requested=1" className={buttonClasses({ variant: requested === "1" ? "primary" : "ghost", size: "sm" })}>
          Con valoración solicitada {requested !== "1" && `(${requestedCount})`}
        </Link>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Municipio</th>
                <th>Inmueble</th>
                <th className="text-right">Venta est.</th>
                <th className="text-right">Alquiler est.</th>
                <th>Confianza</th>
                <th>Zona tens.</th>
                <th>Valoración</th>
                <th>Contacto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {studies.map((s) => (
                <tr key={s.id} className="hover:bg-sand-50">
                  <td className="tabular-nums text-ink-500">
                    <Link href={`/admin/studies/${s.id}`} className="text-ink-800 hover:text-terracotta-600">
                      {formatDateTime(s.createdAt)}
                    </Link>
                  </td>
                  <td>
                    {s.municipalityName} <span className="text-ink-400">{s.postalCode}</span>
                  </td>
                  <td>
                    {PROPERTY_KIND_LABELS[s.propertyType as PropertyKind] ?? s.propertyType} · {s.sqm} m²
                  </td>
                  <td className="text-right tabular-nums">{formatEUR(s.saleEstimate)}</td>
                  <td className="text-right tabular-nums">{s.rentEstimate ? `${formatEUR(s.rentEstimate)}/mes` : "—"}</td>
                  <td>{CONFIDENCE_LABELS[s.confidence as Confidence] ?? s.confidence}</td>
                  <td>{TENSIONED[s.tensionedStatus] ?? s.tensionedStatus}</td>
                  <td>{s.valuationRequested ? <Badge tone="terracotta">Solicitada</Badge> : <span className="text-ink-400">—</span>}</td>
                  <td>{s.consentContact ? `${s.contactName} · ${s.contactEmail}` : <span className="text-ink-400">Anónimo</span>}</td>
                  <td>{COMMERCIAL_STATUS_LABELS[s.commercialStatus as CommercialStatus] ?? s.commercialStatus}</td>
                </tr>
              ))}
              {studies.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-ink-400">
                    Todavía no hay estudios. Se crean desde <Link href="/estudio" className="underline">/estudio</Link>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
