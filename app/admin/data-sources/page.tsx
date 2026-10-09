import { RefreshCcw, Trash2 } from "lucide-react";
import {
  addMarketReferenceAction,
  clearOfficialCacheAction,
  deleteMarketReferenceAction,
  importTensionedAction,
} from "@/app/admin/studyActions";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/utils";
import { getDataSourcesStatus } from "@/services/study/adminStudyService";
import { exampleDataEnabled } from "@/services/study/exampleData";
import { getComparablesProvider } from "@/services/study/sources/idealista";
import { getSerpaviMeta } from "@/services/study/sources/serpavi";
import { MIVAU_TENSIONED_URL } from "@/services/study/sources/tensionedAreas";

export const metadata = { title: "Fuentes de datos" };

export default async function DataSourcesPage({ searchParams }: { searchParams: Promise<{ imported?: string; error?: string }> }) {
  const params = await searchParams;
  const { declarations, cache, refs } = await getDataSourcesStatus();
  const serpavi = getSerpaviMeta();
  const comparables = getComparablesProvider();

  const status: Array<[string, string, "green" | "amber" | "neutral" | "red", string]> = [
    ["INE · API Tempus3 (población, IPVA, IPV, viviendas turísticas)", "Pública, sin clave", "green", "https://servicios.ine.es/wstempus/js"],
    ["Catastro · servicios web de datos no protegidos", "Pública, sin clave", "green", "https://www.sedecatastro.gob.es/"],
    ["Ministerio de Vivienda · zonas tensionadas", declarations.length ? `${declarations.length} declaraciones importadas` : "Sin importar", declarations.length ? "green" : "amber", MIVAU_TENSIONED_URL],
    ["SERPAVI · rentas declaradas por municipio", serpavi ? `Importado ${serpavi.importedAt}` : "No importado", serpavi ? "green" : "amber", serpavi?.sourceUrl ?? ""],
    ["Idealista API (comparables, precios de anuncio)", comparables.isConfigured() ? "Credenciales configuradas" : "Requiere acuerdo y credenciales", comparables.isConfigured() ? "green" : "neutral", "https://developers.idealista.com/access-request"],
    ["Fotocasa Research", "Sin API pública: requiere acuerdo comercial", "neutral", ""],
    ["Portales estadísticos autonómicos y municipales", "Pendiente de integrar por fuente", "neutral", ""],
    ["Datos de EJEMPLO (STUDY_EXAMPLE_DATA)", exampleDataEnabled() ? "ACTIVADOS: no usar en producción" : "Desactivados", exampleDataEnabled() ? "red" : "green", ""],
  ];

  return (
    <>
      <PageHeader title="Fuentes de datos" description="Estado de las integraciones, declaraciones oficiales de zonas tensionadas y referencias de mercado cargadas por el equipo." />
      {params.imported && <p className="mb-4 rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-600">Declaraciones actualizadas desde la fuente oficial.</p>}
      {params.error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{params.error}</p>}

      <Card className="mb-6">
        <CardHeader title="Integraciones" />
        <CardBody>
          <ul className="divide-y divide-sand-100 text-sm">
            {status.map(([name, value, tone, url]) => (
              <li key={name} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="text-ink-800 hover:underline">
                    {name}
                  </a>
                ) : (
                  <span className="text-ink-800">{name}</span>
                )}
                <Badge tone={tone}>{value}</Badge>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Zonas de mercado residencial tensionado"
            description={declarations[0] ? `Importado el ${formatDateTime(declarations[0].importedAt)} · se actualiza automáticamente cada 7 días` : "Aún no importado"}
            action={
              <form action={importTensionedAction}>
                <SubmitButton size="sm" variant="outline" pendingLabel="Importando…">
                  <RefreshCcw className="h-3.5 w-3.5" /> Actualizar
                </SubmitButton>
              </form>
            }
          />
          <div className="max-h-[480px] overflow-y-auto">
            <ul className="divide-y divide-sand-100 text-sm">
              {declarations.map((d) => (
                <li key={d.id} className="px-5 py-3">
                  <p className="font-medium text-ink-800">
                    {d.ccaa}{" "}
                    <span className="text-xs font-normal text-ink-400">
                      {d.validFrom?.toLocaleDateString("es-ES")} – {d.validTo?.toLocaleDateString("es-ES")}
                    </span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-500">{d.municipalitiesText}</p>
                  <p className="mt-1 text-[11px] text-ink-400">{d.bulletin}</p>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Referencias de mercado del equipo" description="Valores €/m² con fuente verificable (p. ej. estadística notarial con licencia, valor tasado del Ministerio). Se usan antes que los modelos." />
            <CardBody>
              <form action={addMarketReferenceAction} className="grid grid-cols-2 gap-2 text-sm">
                <input name="municipalityCode" required placeholder="Código INE (17152)" className="field" />
                <input name="municipalityName" required placeholder="Municipio" className="field" />
                <select name="kind" className="field">
                  <option value="SALE_M2">Venta €/m²</option>
                  <option value="RENT_M2">Alquiler €/m²/mes</option>
                </select>
                <select name="dataType" className="field">
                  <option value="CLOSED_TRANSACTIONS">Compraventas cerradas</option>
                  <option value="OFFICIAL">Estadística oficial</option>
                  <option value="APPRAISAL">Tasaciones</option>
                  <option value="ASKING_PRICES">Precios de anuncio</option>
                </select>
                <input name="value" required type="number" step="any" placeholder="Valor" className="field" />
                <input name="period" required placeholder="Periodo (2026-T2)" className="field" />
                <input name="low" type="number" step="any" placeholder="Mínimo (opcional)" className="field" />
                <input name="high" type="number" step="any" placeholder="Máximo (opcional)" className="field" />
                <input name="sourceName" required placeholder="Fuente" className="field col-span-2" />
                <input name="sourceUrl" placeholder="URL de la fuente" className="field col-span-2" />
                <input name="notes" placeholder="Notas / licencia" className="field col-span-2" />
                <SubmitButton size="sm" className="col-span-2 justify-self-start">
                  Añadir referencia
                </SubmitButton>
              </form>
              <ul className="mt-4 divide-y divide-sand-100 text-sm">
                {refs.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-2">
                    <span>
                      {r.municipalityName} · {r.kind === "SALE_M2" ? "Venta" : "Alquiler"} {r.value} €/m² · {r.period}
                      <span className="block text-xs text-ink-400">
                        {r.sourceName} · {r.dataType}
                      </span>
                    </span>
                    <form action={deleteMarketReferenceAction.bind(null, r.id)}>
                      <button className="text-ink-400 hover:text-red-600" aria-label="Eliminar referencia">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </li>
                ))}
                {refs.length === 0 && <li className="py-2 text-ink-400">Sin referencias cargadas.</li>}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Caché de fuentes oficiales"
              description={`${cache.length} consultas guardadas`}
              action={
                <form action={clearOfficialCacheAction}>
                  <SubmitButton size="sm" variant="ghost">
                    Vaciar caché
                  </SubmitButton>
                </form>
              }
            />
            <div className="max-h-64 overflow-y-auto">
              <ul className="divide-y divide-sand-100 text-xs">
                {cache.map((c) => (
                  <li key={c.key} className="flex justify-between gap-3 px-5 py-2">
                    <span className="font-mono text-ink-600">{c.key}</span>
                    <span className="whitespace-nowrap text-ink-400">{formatDateTime(c.fetchedAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
