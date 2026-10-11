import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { PORTAL_PROVINCE_CODES } from "@/services/listings/catalog";
import { SEARCH_STATUSES, SEARCH_TONES, SEARCH_TYPES, splitMunicipalities } from "@/services/searchRequests/catalog";
import { listSearchRequestsAdmin } from "@/services/searchRequests/searchRequests";
import { PROVINCES, getProvince } from "@/services/study/geo";

export const metadata = { title: "Solicitudes Busco piso" };
export const dynamic = "force-dynamic";

const YEAR_MS = 365 * 24 * 3600 * 1000;

type Params = { estado?: string; op?: string; prov?: string; pob?: string; desde?: string; hasta?: string };
const amount = (v?: string) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

export default async function SearchRequestsAdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const p = await searchParams;
  const estado = p.estado && p.estado in SEARCH_STATUSES ? p.estado : undefined;
  const filters = {
    status: estado,
    operation: p.op === "SALE" || p.op === "RENT" ? p.op : undefined,
    provinceCode: p.prov && PORTAL_PROVINCE_CODES.includes(p.prov) ? p.prov : undefined,
    municipality: p.pob?.trim() || undefined,
    budgetMin: amount(p.desde),
    budgetMax: amount(p.hasta),
  };
  const requests = await listSearchRequestsAdmin(filters);
  const provinces = PROVINCES.filter((x) => PORTAL_PROVINCE_CODES.includes(x.code)).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ op: p.op, prov: p.prov, pob: p.pob, desde: p.desde, hasta: p.hasta, ...extra })) if (v) q.set(k, v);
    const s = q.toString();
    return `/admin/busco-piso${s ? `?${s}` : ""}`;
  };
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Solicitudes Busco piso"
        description="Personas que buscan vivienda en compra o alquiler. Llegan pendientes de revisión: solo se ven en la web cuando las apruebas, y nunca con sus datos de contacto."
      />
      <nav className="mb-4 flex flex-wrap gap-1.5">
        {[["", "Todas"], ...Object.entries(SEARCH_STATUSES)].map(([k, label]) => (
          <Link
            key={k}
            href={keep({ estado: k })}
            className={(estado ?? "") === k ? "rounded-full bg-ink-800 px-3 py-1.5 text-[13px] text-white" : "rounded-full bg-white px-3 py-1.5 text-[13px] text-ink-600 ring-1 ring-sand-200 hover:bg-sand-50"}
          >
            {label}
          </Link>
        ))}
      </nav>
      <form method="get" className="mb-4 grid gap-3 rounded-2xl border border-sand-200 bg-white p-4 sm:grid-cols-3 xl:grid-cols-[1fr_1fr_1.3fr_1fr_1fr_auto] xl:items-end">
        {estado && <input type="hidden" name="estado" value={estado} />}
        <label className="block">
          <span className="field-label">Operación</span>
          <select name="op" defaultValue={filters.operation ?? ""} className="field">
            <option value="">Todas</option>
            <option value="SALE">Compra</option>
            <option value="RENT">Alquiler</option>
          </select>
        </label>
        <label className="block">
          <span className="field-label">Provincia</span>
          <select name="prov" defaultValue={filters.provinceCode ?? ""} className="field">
            <option value="">Todas</option>
            {provinces.map((x) => (
              <option key={x.code} value={x.code}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Población</span>
          <input name="pob" defaultValue={filters.municipality ?? ""} maxLength={80} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Presupuesto máx. desde (€)</span>
          <input name="desde" type="number" min={0} defaultValue={filters.budgetMin ?? ""} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Presupuesto máx. hasta (€)</span>
          <input name="hasta" type="number" min={0} defaultValue={filters.budgetMax ?? ""} className="field" />
        </label>
        <div className="flex items-center gap-3">
          <button className="inline-flex h-11 items-center rounded-full bg-ink-800 px-5 text-sm font-medium text-white">Filtrar</button>
          <Link href={estado ? `/admin/busco-piso?estado=${estado}` : "/admin/busco-piso"} className="text-sm text-ink-500 underline">
            Limpiar
          </Link>
        </div>
      </form>
      <Card className="overflow-x-auto">
        {requests.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-ink-400">No hay solicitudes{estado || filters.operation || filters.provinceCode || filters.municipality ? " con estos filtros" : " todavía"}.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Recibida</th>
                <th>Busca</th>
                <th>Dónde</th>
                <th>Presupuesto máx.</th>
                <th>Contacto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const old = now - r.updatedAt.getTime() > YEAR_MS;
                return (
                  <tr key={r.id} className="hover:bg-sand-50">
                    <td className="text-ink-500">
                      <Link href={`/admin/busco-piso/${r.id}`} className="hover:underline">
                        {formatDateTime(r.createdAt)}
                      </Link>
                      <p className="text-xs text-ink-400">{r.reference}</p>
                    </td>
                    <td>
                      <Link href={`/admin/busco-piso/${r.id}`} className="font-medium text-ink-800 hover:underline">
                        {SEARCH_TYPES[r.propertyType as keyof typeof SEARCH_TYPES] ?? r.propertyType}
                      </Link>
                      <p className="text-xs text-ink-400">{r.operation === "RENT" ? "Alquiler" : "Compra"}</p>
                    </td>
                    <td className="text-ink-600">
                      {splitMunicipalities(r.municipalities).join(", ")}
                      <p className="text-xs text-ink-400">{getProvince(r.provinceCode)?.name}</p>
                    </td>
                    <td className="tabular-nums">
                      {r.maxPrice.toLocaleString("es-ES")} €{r.operation === "RENT" ? "/mes" : ""}
                    </td>
                    <td>
                      <p className="font-medium text-ink-800">{r.name}</p>
                      <p className="text-xs text-ink-500">{r.email}</p>
                    </td>
                    <td>
                      <Badge tone={SEARCH_TONES[r.status as keyof typeof SEARCH_TONES] ?? "neutral"}>{SEARCH_STATUSES[r.status as keyof typeof SEARCH_STATUSES] ?? r.status}</Badge>
                      {old && <p className="mt-1 text-xs text-amber-700">Más de 12 meses sin cambios: valora eliminarla</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
