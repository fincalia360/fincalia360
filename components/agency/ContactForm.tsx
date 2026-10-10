"use client";

import { useActionForm } from "@/lib/useActionForm";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { FormState } from "@/components/listings/ListingForm";
import { CONTACT_KINDS } from "@/services/agency/catalog";

export function ContactForm({
  action,
  values = {},
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  values?: { kind?: string; name?: string; email?: string | null; phone?: string | null; notes?: string | null };
  submitLabel: string;
}) {
  const [state, onSubmit, pending] = useActionForm(action, {});
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Tipo de contacto</span>
          <select name="kind" defaultValue={values.kind ?? "BUYER"} className="field">
            {Object.entries(CONTACT_KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Nombre</span>
          <input name="name" required maxLength={80} defaultValue={values.name ?? ""} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Email</span>
          <input name="email" type="email" maxLength={120} defaultValue={values.email ?? ""} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Teléfono</span>
          <input name="phone" type="tel" maxLength={30} defaultValue={values.phone ?? ""} className="field" />
        </label>
      </div>
      <label className="block">
        <span className="field-label">Notas</span>
        <textarea name="notes" rows={3} maxLength={2000} defaultValue={values.notes ?? ""} className="field" placeholder="Qué busca, qué vende, presupuesto, preferencias…" />
      </label>
      <p className="text-xs text-ink-400">Registra solo los datos necesarios y con el conocimiento del contacto. Eres responsable de los datos de tus clientes.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}
        </Button>
        {state.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && !pending && <p className="text-sm text-pine-600">Guardado</p>}
      </div>
    </form>
  );
}
