import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { setStudyStatusAction } from "@/app/admin/studyActions";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { OriginBadge } from "@/components/study/charts";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CONTACT_LABELS, label } from "@/lib/labels";
import { formatDateTime, formatEUR } from "@/lib/utils";
import { COMMERCIAL_STATUSES, COMMERCIAL_STATUS_LABELS, getStudyAdmin } from "@/services/study/adminStudyService";
import { getCcaa, getProvince } from "@/services/study/geo";
import { buildStudyReport } from "@/services/study/reportModel";
import {
  CONFIDENCE_LABELS,
  CURRENT_USE_LABELS,
  GOAL_LABELS,
  PROPERTY_KIND_LABELS,
  TAX_RESIDENCE_LABELS,
  type Estimate,
} from "@/services/study/types";

export const metadata = { title: "Estudio" };

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-sand-100 py-2 text-sm last:border-0">
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-right text-ink-800">{v}</dd>
    </div>
  );
}

function EstimateBlock({ title, e, unit = "" }: { title: string; e: Estimate | null; unit?: string }) {
  if (!e) return <Row k={title} v="Sin estimación" />;
  return (
    <div className="border-b border-sand-100 py-2 text-sm last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink-500">{title}</span>
        <span className="flex items-center gap-2">
          <strong className="tabular-nums">
            {formatEUR(e.value)}
            {unit}
          </strong>
          <OriginBadge origin={e.origin} />
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-400">
        {e.method} · {e.source.name}
        {e.source.period ? ` (${e.source.period})` : ""} · confianza {CONFIDENCE_LABELS[e.confidence]}
      </p>
    </div>
  );
}

export default async function StudyAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const study = await getStudyAdmin(id);
  if (!study) notFound();
  const { input, snapshot, assumptions } = study;
  const report = buildStudyReport(input, snapshot, assumptions, input.owner.horizon);
  const sim = report.main;
  const eurOrNA = (v: number | null | undefined) => (v == null ? "No calculable" : formatEUR(v));

  return (
    <>
      <Link href="/admin/studies" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Estudios
      </Link>
      <PageHeader
        title={`${PROPERTY_KIND_LABELS[input.property.kind]} · ${input.location.municipalityName}`}
        description={`Creado el ${formatDateTime(study.createdAt)} · CP ${input.location.postalCode} · ${getProvince(input.location.provinceCode)?.name}, ${getCcaa(input.location.ccaaCode)?.name}`}
        actions={
          <a href={`/api/admin/studies/${id}/pdf`} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "outline" })}>
            <FileDown className="h-4 w-4" /> Informe PDF
          </a>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Inmueble (datos aportados)" />
            <CardBody>
              <dl>
                <Row k="Superficie" v={`${input.property.sqm} m² · ${input.property.bedrooms} hab. · ${input.property.bathrooms} baños`} />
                <Row k="Estado actual" v={CURRENT_USE_LABELS[input.property.currentUse]} />
                <Row k="Objetivo / horizonte" v={`${GOAL_LABELS[input.owner.goal]} · ${input.owner.horizon} años`} />
                <Row k="Residencia fiscal" v={TAX_RESIDENCE_LABELS[input.owner.taxResidence]} />
                <Row k="Referencia catastral" v={input.location.cadastralRef ?? "—"} />
                <Row k="Dirección" v={study.valuationRequested ? input.location.address ?? "—" : "Solo visible si solicita valoración"} />
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Valoración y resultados" description="Con las últimas hipótesis guardadas por el propietario" />
            <CardBody>
              <EstimateBlock title="Venta" e={snapshot.sale} />
              <EstimateBlock title="Alquiler (mercado o referencia)" e={report.rent.market ?? report.rent.statistical} unit="/mes" />
              <Row k="Renta usada en la simulación" v={report.rent.used == null ? "Ninguna" : `${formatEUR(report.rent.used)}/mes`} />
              <Row k="Neto si vende hoy" v={eurOrNA(sim.sellNow?.breakdown.net)} />
              <Row k={`Patrimonio A / B / C a ${input.owner.horizon} años`} v={`${eurOrNA(sim.sellNow?.wealth)} / ${eurOrNA(sim.rentThenSell?.wealth)} / ${eurOrNA(sim.keep?.wealth)}`} />
              <Row k="Zona tensionada" v={snapshot.tensioned.summary} />
              <Row k="Conclusión" v={report.headline} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Fuentes utilizadas en el informe" />
            <CardBody>
              <ul className="space-y-1.5 text-sm">
                {snapshot.sources.map((s, i) => (
                  <li key={i}>
                    <Badge tone={s.status === "OK" ? "green" : s.status === "STALE" ? "amber" : "neutral"}>{s.status}</Badge>{" "}
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                        {s.name}
                      </a>
                    ) : (
                      s.name
                    )}
                    <span className="text-xs text-ink-400">
                      {s.period ? ` · ${s.period}` : ""}
                      {s.retrievedAt ? ` · ${s.retrievedAt.slice(0, 10)}` : ""}
                      {s.note ? ` · ${s.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contacto y consentimientos" />
            <CardBody>
              {study.valuationRequested ? (
                <dl>
                  <Row k="Nombre" v={study.contactName} />
                  <Row k="Email" v={study.contactEmail} />
                  <Row k="Teléfono" v={study.contactPhone ?? "—"} />
                  <Row k="Medio preferido" v={label(CONTACT_LABELS, study.preferredContact)} />
                  <Row k="Comentarios" v={study.comments ?? "—"} />
                  <Row k="consent_contact" v={study.consentContact ? "Sí" : "No"} />
                  <Row k="consent_marketing" v={study.consentMarketing ? "Sí" : "No"} />
                  <Row k="consent_timestamp" v={study.consentTimestamp?.toISOString() ?? "—"} />
                  <Row k="consent_version" v={study.consentVersion ?? "—"} />
                  {study.lead && (
                    <Row
                      k="Lead en el CRM"
                      v={
                        <Link href={`/admin/leads/${study.lead.id}`} className="text-terracotta-600 hover:underline">
                          {study.lead.name} ({study.lead.status})
                        </Link>
                      }
                    />
                  )}
                </dl>
              ) : (
                <p className="text-sm text-ink-500">Estudio anónimo: el propietario no ha solicitado valoración ni ha dado datos de contacto.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Estado comercial" />
            <CardBody>
              <form action={setStudyStatusAction.bind(null, id)} className="flex flex-wrap gap-2">
                <select name="status" defaultValue={study.commercialStatus} className="field h-10 w-auto py-2">
                  {COMMERCIAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {COMMERCIAL_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <SubmitButton size="md" variant="primary">
                  Guardar
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
