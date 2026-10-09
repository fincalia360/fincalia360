import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { addRevenueAction } from "@/app/admin/crmActions";
import { ActionForm } from "@/components/admin/crm/CrmForms";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/db/client";
import { INTEREST_LABELS } from "@/lib/labels";
import { cn, formatEUR } from "@/lib/utils";
import { getServices } from "@/services/crm/catalog";
import { countFollowUp } from "@/services/crm/contacts";
import { METRIC_DEFINITIONS, getBusinessMetrics, periodFromPreset, type MetricKey } from "@/services/crm/metrics";
import { emailConfig } from "@/services/email/emailService";

export const metadata = { title: "Negocio" };

const PRESETS = [
  ["7", "7 días"],
  ["30", "30 días"],
  ["90", "90 días"],
  ["365", "12 meses"],
  ["all", "Todo"],
] as const;

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`);
const labelOf = (k: MetricKey) => METRIC_DEFINITIONS.find((d) => d.key === k)!.label;

export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ p?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const custom = sp.from && sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) && /^\d{4}-\d{2}-\d{2}$/.test(sp.to);
  const period = custom ? { from: new Date(`${sp.from}T00:00:00Z`), to: new Date(`${sp.to}T23:59:59Z`), preset: "custom" } : periodFromPreset(sp.p);
  const [m, followUp, services, partners] = await Promise.all([
    getBusinessMetrics(period),
    countFollowUp(),
    getServices(),
    prisma.agency.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const email = emailConfig();
  const realContacts = await prisma.lead.count({ where: { isDemo: false } });

  return (
    <>
      <PageHeader title="Negocio" description="Indicadores reales de captación y conversión. Los datos de demostración no se cuentan nunca." />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PRESETS.map(([k, v]) => (
          <Link
            key={k}
            href={`/admin/negocio?p=${k}`}
            className={cn("rounded-full border px-3 py-1.5 text-sm", period.preset === k ? "border-ink-800 bg-ink-800 text-white" : "border-sand-300 text-ink-600 hover:border-ink-300")}
          >
            {v}
          </Link>
        ))}
        <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
          <input type="date" name="from" defaultValue={custom ? sp.from : ""} className="field h-9 w-auto py-1" aria-label="Desde" />
          <span className="text-ink-400">a</span>
          <input type="date" name="to" defaultValue={custom ? sp.to : ""} className="field h-9 w-auto py-1" aria-label="Hasta" />
          <button className="rounded-full border border-sand-300 px-3 py-1.5 text-ink-600 hover:border-ink-300">Aplicar</button>
        </form>
      </div>

      {(followUp > 0 || !email.configured) && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {followUp > 0 && (
            <Link href="/admin/leads?followUp=1" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 hover:border-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" /> <strong>{followUp}</strong> contacto(s) requieren seguimiento ahora.
            </Link>
          )}
          {!email.configured && (
            <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <Info className="h-4 w-4 shrink-0" /> El correo no está configurado (falta {email.missing.join(", ")}): no se envían avisos ni informes por email.
            </p>
          )}
        </div>
      )}

      {realContacts === 0 && (
        <p className="mb-6 rounded-xl border border-sand-200 bg-white p-4 text-sm text-ink-500">
          Todavía no hay contactos reales. Las cifras se llenarán a medida que los propietarios usen el estudio.
        </p>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {METRIC_DEFINITIONS.map((d) => (
          <div key={d.key} className="rounded-2xl border border-sand-200 bg-white p-4 shadow-soft" title={d.def}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{d.label}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-ink-800">{d.key === "revenue" ? formatEUR(m.values.revenue) : m.values[d.key].toLocaleString("es-ES")}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Conversión entre etapas" description="En el mismo periodo (no por cohortes)." />
          <CardBody>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">Sobre</th>
                  <th className="text-right">Conversión</th>
                </tr>
              </thead>
              <tbody>
                {m.conversions.map((c) => (
                  <tr key={c.key}>
                    <td className="whitespace-normal">{labelOf(c.key)}</td>
                    <td className="text-right tabular-nums">{m.values[c.key]}</td>
                    <td className="whitespace-normal text-right text-ink-500">
                      {m.values[c.from]} {labelOf(c.from).toLowerCase()}
                    </td>
                    <td className="text-right font-semibold tabular-nums">{pct(c.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Solicitudes por interés" />
            <CardBody>
              {Object.keys(m.byInterest).length === 0 ? (
                <p className="text-sm text-ink-400">Sin solicitudes en el periodo.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {Object.entries(m.byInterest).map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span>{INTEREST_LABELS[k] ?? k}</span>
                      <span className="font-semibold tabular-nums">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Registrar un ingreso" description="Ingresos reales no asociados a un contacto (para los de un contacto, usa su ficha)." />
            <CardBody>
              <ActionForm action={addRevenueAction.bind(null, null)} submitLabel="Registrar ingreso" okLabel="Ingreso registrado">
                <div className="grid gap-2 sm:grid-cols-[110px_150px_1fr]">
                  <input name="amount" type="number" min={1} step={1} required placeholder="€" className="field h-9 py-1.5 text-sm" />
                  <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="field h-9 py-1.5 text-sm" />
                  <input name="description" required maxLength={200} placeholder="Concepto" className="field h-9 py-1.5 text-sm" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select name="serviceCode" defaultValue="" className="field h-9 py-1.5 text-sm">
                    <option value="">Servicio (opcional)</option>
                    {services.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select name="agencyId" defaultValue="" className="field h-9 py-1.5 text-sm">
                    <option value="">Colaborador (opcional)</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Cómo se calcula cada indicador" />
        <CardBody>
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            {METRIC_DEFINITIONS.map((d) => (
              <div key={d.key}>
                <dt className="font-semibold text-ink-800">{d.label}</dt>
                <dd className="text-ink-500">{d.def}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </>
  );
}
