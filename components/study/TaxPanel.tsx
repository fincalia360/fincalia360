"use client";

import { useStudyT } from "@/components/study/StudyI18n";
import { useState } from "react";
import { fmtEur } from "@/services/study/format";
import type { StudyReport } from "@/services/study/reportModel";
import { REDUCTION_BY_CONDITION, TAX_RULES_VERSION, TAX_STATUS_LABELS, annualAmortization, imputedIncomeTax, inheritanceGuidance, type TaxLine } from "@/services/study/taxes";
import { NEW_CONTRACT_CONDITIONS, type NewContractCondition, type StudyAssumptions, type StudyInput } from "@/services/study/types";

function Line({ t: line }: { t: TaxLine }) {
  const t = useStudyT();
  return (
    <div className="border-b border-sand-100 py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink-800">
          {t(line.label)} <span className="ml-1 rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-normal text-ink-500">{t(TAX_STATUS_LABELS[line.status])}</span>
        </p>
        <p className="font-semibold tabular-nums">{line.amount == null ? <span className="text-amber-700">{t("No calculable")}</span> : fmtEur(line.amount)}</p>
      </div>
      {line.formula && <p className="mt-1 font-mono text-[11.5px] text-ink-500">{line.formula}</p>}
      {line.basis && <p className="mt-1 text-xs text-ink-500">{line.basis}</p>}
      {line.missing.length > 0 && (
        <p className="mt-1 text-xs text-amber-700">
          {t("Necesitamos:")} {line.missing.join(" · ")}
        </p>
      )}
      {line.notes.map((n) => (
        <p key={n} className="mt-1 text-xs text-ink-400">
          {n}
        </p>
      ))}
    </div>
  );
}

export function TaxPanel({
  report,
  input,
  ccaaName,
  onChange,
}: {
  report: StudyReport;
  input: StudyInput;
  ccaaName: string;
  onChange: (key: keyof StudyAssumptions, value: NewContractCondition) => void;
}) {
  const t = useStudyT();
  const [relationship, setRelationship] = useState<string>("");
  const a = report.assumptions;
  const e = input.economics;
  const b = report.main.sellNow?.breakdown;
  const red = report.reduction;
  const amort = annualAmortization({
    purchasePrice: e.purchasePrice,
    purchaseCosts: e.purchaseCosts,
    improvements: e.improvementsCost,
    cadastralLand: e.cadastralValueLand,
    cadastralTotal: e.cadastralValueTotal,
  });
  const y1 = report.main.rental?.rows[0];
  const inh = inheritanceGuidance({
    ccaaName,
    relationship: relationship || null,
    propertyValue: report.sale.used,
  });
  const tensioned = report.rent.regime.source.scope.startsWith("Municipio") || report.rent.regime.source.scope.startsWith("Parte");

  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
      <p className="text-sm font-semibold text-ink-800">{t("Venta hoy: precio, ganancia, impuestos y dinero neto")}</p>
      {b ? (
        <>
          <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <dt className="text-ink-500">{t("Precio de venta")}</dt>
              <dd className="tabular-nums">{fmtEur(b.salePrice)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-500">{t("Ganancia patrimonial")}</dt>
              <dd className="tabular-nums">{b.gainTax.gain == null ? t("No calculable") : fmtEur(b.gainTax.gain)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-500">{t("Gastos de la operación")}</dt>
              <dd className="tabular-nums">{fmtEur(b.transactionCosts)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-500">{t("Impuestos calculados")}</dt>
              <dd className="tabular-nums">{fmtEur(b.taxesTotal)}</dd>
            </div>
            <div className="flex justify-between gap-2 font-semibold sm:col-span-2">
              <dt>{t("Dinero neto que recibirías")}</dt>
              <dd className="tabular-nums">
                {fmtEur(b.net)}
                {b.complete ? "" : t(" (incompleto)")}
              </dd>
            </div>
          </dl>
          <Line t={b.plusvalia} />
          <Line t={b.gainTax} />
        </>
      ) : (
        <p className="mt-2 text-sm text-amber-700">{t("Sin valor de venta no se calculan los impuestos de la venta.")}</p>
      )}

      <div className="mt-4 border-t border-sand-200 pt-4">
        <p className="text-sm font-semibold text-ink-800">{t("Alquiler: reducción, amortización e impuestos")}</p>
        <div className="mt-2 rounded-xl bg-sand-50 p-3 text-sm">
          <p>
            {t("Reducción aplicable:")} <strong>{red.pct == null ? t("no determinada") : `${red.pct} %`}</strong> · {red.label}{" "}
            <span className="text-xs text-ink-400">
              ({red.status === "ASSUMED" ? "supuesta" : red.status === "DETERMINED" ? "determinada" : red.status === "NOT_APPLICABLE" ? t("no aplica") : t("faltan datos")})
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-500">{red.basis}</p>
          {red.missing.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              {t("Necesitamos:")} {red.missing.join(" · ")}
            </p>
          )}
          {input.owner.taxResidence === "ES" && input.property.currentUse !== "RENTED" && (
            <label className="mt-3 block max-w-md text-[13px] text-ink-700">
              {t("Condiciones del nuevo contrato")}
              <select className="field mt-1" value={a.newContractCondition} onChange={(ev) => onChange("newContractCondition", ev.target.value as NewContractCondition)}>
                {NEW_CONTRACT_CONDITIONS.filter((c) => tensioned || (c !== "TENSIONED_YOUNG" && c !== "TENSIONED_DECREASE")).map((c) => (
                  <option key={c} value={c}>
                    {t(REDUCTION_BY_CONDITION[c].label)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11.5px] text-ink-400">{t(REDUCTION_BY_CONDITION[a.newContractCondition].requires)}</span>
            </label>
          )}
        </div>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-500">{t("Amortización fiscal anual")}</dt>
            <dd className="tabular-nums">{amort.known ? fmtEur(amort.amount) : <span className="text-amber-700">{t("No calculada")}</span>}</dd>
          </div>
          <p className="font-mono text-[11.5px] text-ink-400">{amort.formula}</p>
          {y1 && (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-500">{t("Impuestos del alquiler en el año 1 (incluye imputación del periodo vacío)")}</dt>
              <dd className="tabular-nums">{fmtEur(y1.incomeTax)}</dd>
            </div>
          )}
          <p className="text-xs text-ink-400">
            {t(
              "Residentes: (renta cobrada − gastos del periodo alquilado − amortización) × (1 − reducción) × tipo marginal. Intereses y reparaciones limitados a los ingresos del año. UE/EEE: 19 % del neto. Otros países: 24 % de los ingresos íntegros.",
            )}
          </p>
        </dl>
        {["EMPTY", "SECOND_HOME"].includes(input.property.currentUse) && (
          <Line
            t={imputedIncomeTax({
              cadastralTotal: e.cadastralValueTotal,
              residence: input.owner.taxResidence,
              marginalRatePct: a.marginalRatePct,
            })}
          />
        )}
      </div>

      <div className="mt-4 border-t border-sand-200 py-3">
        <p className="text-sm font-medium text-ink-800">{inh.title}</p>
        <p className="mt-1 text-sm text-ink-600">{inh.summary}</p>
        <label className="mt-3 block max-w-xs text-[13px] text-ink-700">
          {t("Parentesco del posible heredero o donatario")}
          <select className="field mt-1" value={relationship} onChange={(ev) => setRelationship(ev.target.value)}>
            <option value="">{t("Sin indicar")}</option>
            <option value="CONYUGE">{t("Cónyuge")}</option>
            <option value="DESCENDIENTE">{t("Hijo o descendiente")}</option>
            <option value="ASCENDIENTE">{t("Padre o ascendiente")}</option>
            <option value="COLATERAL">{t("Hermano, sobrino u otro colateral")}</option>
            <option value="OTRO">{t("Sin parentesco")}</option>
          </select>
        </label>
        <p className="mt-3 text-xs font-semibold text-ink-500">{t("Datos necesarios antes de dar una cifra:")}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink-500">
          {inh.missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
      <p className="mt-2 rounded-xl bg-sand-50 p-3 text-xs text-ink-500">
        {t("Estimaciones orientativas según la {0}. No constituyen asesoramiento fiscal vinculante.", [TAX_RULES_VERSION.toLowerCase()])}
      </p>
    </div>
  );
}
