"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SettingsFormState } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import type { BusinessSettings } from "@/services/settingsService";

const FIELDS: Array<{ key: keyof BusinessSettings; label: string; suffix: string; percent?: boolean }> = [
  { key: "cpl", label: "CPL objetivo", suffix: "€" },
  { key: "leadToAppointment", label: "Conversión lead → cita", suffix: "%", percent: true },
  { key: "appointmentToOpportunity", label: "Conversión cita → oportunidad", suffix: "%", percent: true },
  { key: "pricePerAppointment", label: "Precio por cita", suffix: "€" },
  { key: "adBudget", label: "Presupuesto anuncios", suffix: "€/mes" },
  { key: "toolsCost", label: "Herramientas", suffix: "€/mes" },
  { key: "agencies", label: "Inmobiliarias de pago", suffix: "" },
  { key: "monthlyFee", label: "Cuota mensual", suffix: "€/mes" },
];

export function SettingsForm({ settings }: { settings: BusinessSettings }) {
  const [state, action] = useActionState<SettingsFormState, FormData>(saveSettingsAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="field-label">
              {f.label}
            </label>
            <div className="relative">
              <input
                id={f.key}
                name={f.key}
                type="number"
                step="any"
                min={0}
                defaultValue={f.percent ? Math.round(settings[f.key] * 1000) / 10 : settings[f.key]}
                className="field pr-14 tabular-nums"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-400">{f.suffix}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Guardando…">Guardar hipótesis</SubmitButton>
        {state?.saved && <span className="text-sm text-pine-600">Guardado.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
