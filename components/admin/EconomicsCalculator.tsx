"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn, formatEUR, formatNumber, formatPercent } from "@/lib/utils";
import { calculateEconomics, type EconomicsInput } from "@/services/economicsService";

type Field = { key: keyof EconomicsInput; label: string; suffix: string; step: number; percent?: boolean; hint?: string };

const FIELDS: Field[] = [
  { key: "adBudget", label: "Presupuesto anuncios", suffix: "€ / mes", step: 50 },
  { key: "toolsCost", label: "Herramientas y software", suffix: "€ / mes", step: 10 },
  { key: "cpl", label: "CPL (coste por lead)", suffix: "€", step: 1, hint: "Hipótesis 15–25 €" },
  { key: "leadToAppointment", label: "Conversión lead → cita", suffix: "%", step: 1, percent: true, hint: "Hipótesis 15–20 %" },
  { key: "appointmentToOpportunity", label: "Conversión cita → oportunidad", suffix: "%", step: 1, percent: true },
  { key: "pricePerAppointment", label: "Precio por cita", suffix: "€", step: 5 },
  { key: "agencies", label: "Número de inmobiliarias", suffix: "", step: 1 },
  { key: "monthlyFee", label: "Cuota mensual por inmobiliaria", suffix: "€ / mes", step: 10 },
];

export function EconomicsCalculator({ initial }: { initial: EconomicsInput }) {
  const [values, setValues] = useState<EconomicsInput>(initial);
  const result = useMemo(() => calculateEconomics(values), [values]);

  const set = (key: keyof EconomicsInput, raw: string, percent?: boolean) => {
    const n = Number(raw.replace(",", "."));
    setValues((v) => ({ ...v, [key]: Number.isFinite(n) ? (percent ? n / 100 : n) : 0 }));
  };

  const positive = result.margin >= 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-ink-800">Hipótesis (editables)</p>
          <Button variant="ghost" size="sm" onClick={() => setValues(initial)}>
            <RotateCcw className="h-3.5 w-3.5" /> Restablecer
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={f.key} className="field-label">
                {f.label}
              </label>
              <div className="relative">
                <input
                  id={f.key}
                  type="number"
                  min={0}
                  step={f.step}
                  value={f.percent ? Math.round(values[f.key] * 1000) / 10 : values[f.key]}
                  onChange={(e) => set(f.key, e.target.value, f.percent)}
                  className="field pr-16 tabular-nums"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-400">{f.suffix}</span>
              </div>
              {f.hint && <p className="mt-1 text-[11.5px] text-ink-400">{f.hint}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ["Leads", formatNumber(result.leads, 1), `${formatEUR(values.adBudget)} / ${formatEUR(values.cpl)}`],
            ["Citas", formatNumber(result.appointments, 1), `${formatNumber(result.leads, 0)} × ${formatPercent(values.leadToAppointment, 0)}`],
            ["Oportunidades", formatNumber(result.opportunities, 1), `${formatPercent(values.appointmentToOpportunity, 0)} de las citas`],
            ["Coste total", formatEUR(result.totalCost), "Anuncios + herramientas"],
            ["Ingresos", formatEUR(result.revenue), `${formatEUR(result.revenueAppointments)} citas + ${formatEUR(result.revenueFees)} cuotas`],
            ["Coste por cita", formatEUR(result.costPerAppointment), "Coste total / citas"],
          ].map(([k, v, hint]) => (
            <div key={k} className="rounded-2xl border border-sand-200 bg-white p-4 shadow-soft">
              <p className="text-[12px] font-medium uppercase tracking-wider text-ink-400">{k}</p>
              <p className="mt-1.5 font-serif text-[28px] leading-none tabular-nums text-ink-800">{v}</p>
              <p className="mt-1.5 text-[11.5px] text-ink-400">{hint}</p>
            </div>
          ))}
        </div>

        <div className={cn("rounded-2xl border p-5", positive ? "border-pine-100 bg-pine-50" : "border-red-200 bg-red-50")}>
          <p className="text-[12px] font-medium uppercase tracking-wider text-ink-500">Margen mensual</p>
          <p className={cn("mt-1 font-serif text-5xl tabular-nums", positive ? "text-pine-600" : "text-red-700")}>{formatEUR(result.margin)}</p>
          <p className="mt-1 text-sm text-ink-500">{result.marginPct === null ? "Sin ingresos" : `${formatPercent(result.marginPct)} sobre ingresos`}</p>
        </div>

        <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
          <p className="font-semibold text-ink-800">Break-even</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            <li className="flex justify-between gap-4">
              <span>Citas necesarias al precio actual</span>
              <span className="font-semibold tabular-nums text-ink-800">{result.breakEvenAppointments === null ? "—" : formatNumber(result.breakEvenAppointments, 1)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Precio por cita necesario con el volumen actual</span>
              <span className="font-semibold tabular-nums text-ink-800">{formatEUR(result.breakEvenPricePerAppointment)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>CPL máximo sostenible</span>
              <span className="font-semibold tabular-nums text-ink-800">{result.breakEvenCpl === null ? "Cubierto por cuotas" : formatEUR(result.breakEvenCpl)}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
