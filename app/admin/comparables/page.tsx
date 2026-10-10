import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm } from "@/components/admin/crm/CrmForms";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/db/client";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { PROVINCES } from "@/services/study/geo";
import { PROPERTY_KIND_LABELS, PROPERTY_KINDS } from "@/services/study/types";
import { createComparableAction, deleteComparableAction } from "./actions";

export const metadata = { title: "Comparables de alquiler" };
export const dynamic = "force-dynamic";

export default async function ComparablesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = (await searchParams).q?.trim();
  const rows = await prisma.rentComparable.findMany({
    where: q ? { municipalityName: { contains: q } } : {},
    orderBy: { observedAt: "desc" },
    take: 300,
  });
  const provinces = [...PROVINCES].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Comparables de alquiler"
        description="Anuncios de alquiler que consultas tú (portal, inmobiliaria…), con su enlace y la fecha de consulta. El informe PDF los muestra en «Estimación del precio de alquiler» con su fuente. No cambian la renta que usa el simulador."
      />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="self-start">
          <CardHeader title="Registrar un anuncio" description="Copia los datos del anuncio tal como aparecen. Son precios de oferta, no rentas firmadas." />
          <CardBody>
            <ActionForm action={createComparableAction} submitLabel="Guardar comparable" okLabel="Guardado">
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 block">
                  <span className="field-label">Provincia</span>
                  <select name="provinceCode" required className="field" defaultValue="">
                    <option value="">Elige la provincia</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="field-label">Municipio</span>
                  <input name="municipalityName" required maxLength={80} className="field" />
                </label>
                <label className="block">
                  <span className="field-label">Código INE (opcional)</span>
                  <input name="municipalityCode" inputMode="numeric" maxLength={5} placeholder="17152" className="field" />
                </label>
                <label className="block">
                  <span className="field-label">Zona o barrio</span>
                  <input name="zone" maxLength={80} className="field" />
                </label>
                <label className="block">
                  <span className="field-label">Tipo</span>
                  <select name="propertyKind" className="field" defaultValue="">
                    <option value="">Sin indicar</option>
                    {PROPERTY_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {PROPERTY_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="field-label">Renta anunciada (€/mes)</span>
                  <input name="monthlyRent" type="number" min={50} required className="field" />
                </label>
                <label className="block">
                  <span className="field-label">m² construidos</span>
                  <input name="builtArea" type="number" min={1} className="field" />
                </label>
                <label className="block">
                  <span className="field-label">m² útiles (si constan)</span>
                  <input name="usefulArea" type="number" min={1} className="field" />
                </label>
                <label className="block">
                  <span className="field-label">Amueblado</span>
                  <select name="furnished" className="field" defaultValue="">
                    <option value="">Sin indicar</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </label>
                <label className="block">
                  <span className="field-label">Habitaciones</span>
                  <input name="bedrooms" type="number" min={0} className="field" />
                </label>
                <label className="block">
                  <span className="field-label">Baños</span>
                  <input name="bathrooms" type="number" min={0} className="field" />
                </label>
                <label className="col-span-2 block">
                  <span className="field-label">Características</span>
                  <input name="features" maxLength={300} placeholder="Ascensor, terraza, garaje…" className="field" />
                </label>
                <label className="block">
                  <span className="field-label">Fuente</span>
                  <input name="sourceName" required maxLength={80} placeholder="Portal o inmobiliaria" className="field" />
                </label>
                <label className="block">
                  <span className="field-label">Fecha de consulta</span>
                  <input name="observedAt" type="date" required defaultValue={today} max={today} className="field" />
                </label>
                <label className="col-span-2 block">
                  <span className="field-label">Enlace al anuncio</span>
                  <input name="url" type="url" maxLength={500} placeholder="https://…" className="field" />
                </label>
                <label className="col-span-2 block">
                  <span className="field-label">Notas</span>
                  <input name="notes" maxLength={500} className="field" />
                </label>
              </div>
            </ActionForm>
          </CardBody>
        </Card>

        <Card className="overflow-x-auto">
          <CardHeader
            title={`Registrados (${rows.length})`}
            description="El informe usa los del mismo municipio, tipo y tamaño parecido (±35 %) consultados en los últimos 12 meses; con 3 o más da un rango."
            action={
              <form className="flex gap-2">
                <input name="q" defaultValue={q ?? ""} placeholder="Municipio" className="field h-9 w-40 py-0 text-sm" />
                <button className="h-9 rounded-full bg-ink-800 px-3 text-sm text-white">Buscar</button>
              </form>
            }
          />
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-400">Todavía no hay comparables registrados.</p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Municipio</th>
                  <th>Renta</th>
                  <th>m²</th>
                  <th>€/m²</th>
                  <th>Fuente</th>
                  <th>Consulta</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <p className="font-medium text-ink-800">{r.municipalityName}</p>
                      <p className="text-xs text-ink-400">{[r.zone, r.propertyKind ? PROPERTY_KIND_LABELS[r.propertyKind as keyof typeof PROPERTY_KIND_LABELS] : null].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="font-medium">{r.monthlyRent.toLocaleString("es-ES")} €</td>
                    <td>{r.builtArea ?? "—"}</td>
                    <td>{r.builtArea ? (r.monthlyRent / r.builtArea).toLocaleString("es-ES", { maximumFractionDigits: 2 }) : "—"}</td>
                    <td className="text-ink-600">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer" className="underline">
                          {r.sourceName}
                        </a>
                      ) : (
                        r.sourceName
                      )}
                    </td>
                    <td className="text-ink-500">{formatDate(r.observedAt)}</td>
                    <td>
                      <form action={deleteComparableAction.bind(null, r.id)}>
                        <button className="text-[12px] text-red-600 hover:underline">Borrar</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
