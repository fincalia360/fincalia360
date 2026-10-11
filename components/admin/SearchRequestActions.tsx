"use client";
// Panel «Busco comprar»: edición de la solicitud, cambios de estado y eliminación.
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import type { SearchFormState } from "@/app/admin/busco-piso/actions";
import { SEARCH_TYPES } from "@/services/searchRequests/catalog";

type Action = (prev: SearchFormState, formData: FormData) => Promise<SearchFormState>;

const TYPES: Record<string, string> = SEARCH_TYPES;
const PREFS = { ANY: "Indiferente", YES: "Sí", NO: "No" };
const CONDITIONS = { ANY: "Indiferente", NEW: "A estrenar", GOOD: "Buen estado", TO_REFORM: "Para reformar" };

export interface EditableSearch {
  operation: string;
  propertyType: string;
  provinceCode: string;
  municipalities: string[];
  zone: string | null;
  minPrice: number | null;
  maxPrice: number;
  minBedrooms: number | null;
  minBathrooms: number | null;
  minArea: number | null;
  maxArea: number | null;
  terrace: string;
  elevator: string;
  parking: string;
  exterior: string;
  condition: string;
  description: string;
  publicText: string | null;
  adminNote: string | null;
}

function Feedback({ state, pending }: { state: SearchFormState; pending: boolean }) {
  if (pending) return null;
  if (state.error)
    return (
      <p className="text-sm text-red-600" role="alert">
        {state.error}
      </p>
    );
  if (state.ok) return <p className="text-sm text-pine-600">{state.message ?? "Guardado"}</p>;
  return null;
}

export function SearchEditForm({ action, r, provinces }: { action: Action; r: EditableSearch; provinces: { code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(action, {});
  const num = (v: number | null) => (v == null ? "" : String(v));
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="field-label">Operación</span>
          <select name="operation" defaultValue={r.operation} className="field">
            <option value="SALE">Compra</option>
            <option value="RENT">Alquiler</option>
          </select>
        </label>
        <label className="block">
          <span className="field-label">Tipo de inmueble</span>
          <select name="propertyType" defaultValue={r.propertyType} className="field">
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Provincia</span>
          <select name="provinceCode" defaultValue={r.provinceCode} className="field">
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="field-label">Poblaciones (una por línea)</span>
          <textarea name="municipalities" rows={3} defaultValue={r.municipalities.join("\n")} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Zona o barrio</span>
          <input name="zone" defaultValue={r.zone ?? ""} maxLength={120} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Presupuesto mínimo (€{r.operation === "RENT" ? "/mes" : ""})</span>
          <input name="minPrice" type="number" min={0} defaultValue={num(r.minPrice)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Presupuesto máximo (€{r.operation === "RENT" ? "/mes" : ""})</span>
          <input name="maxPrice" type="number" min={1} required defaultValue={num(r.maxPrice)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Habitaciones (mín.)</span>
          <input name="minBedrooms" type="number" min={0} max={20} defaultValue={num(r.minBedrooms)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Baños (mín.)</span>
          <input name="minBathrooms" type="number" min={0} max={20} defaultValue={num(r.minBathrooms)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Superficie mín. (m²)</span>
          <input name="minArea" type="number" min={0} defaultValue={num(r.minArea)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Superficie máx. (m²)</span>
          <input name="maxArea" type="number" min={0} defaultValue={num(r.maxArea)} className="field" />
        </label>
        {(
          [
            ["terrace", "Terraza"],
            ["elevator", "Ascensor"],
            ["parking", "Parking"],
            ["exterior", "Exterior"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="block">
            <span className="field-label">{label}</span>
            <select name={k} defaultValue={r[k]} className="field">
              {Object.entries(PREFS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="block">
          <span className="field-label">Estado</span>
          <select name="condition" defaultValue={r.condition} className="field">
            {Object.entries(CONDITIONS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="field-label">Descripción original (privada)</span>
        <textarea name="description" rows={3} maxLength={2000} defaultValue={r.description} className="field" />
      </label>
      <label className="block">
        <span className="field-label">Texto que se publica en la web</span>
        <textarea name="publicText" rows={4} maxLength={2000} defaultValue={r.publicText ?? ""} className="field" placeholder="Vacío = la ficha pública se muestra sin descripción" />
        <span className="mt-1 block text-xs text-ink-400">
          Revísalo antes de publicar: sin nombres, teléfonos, emails ni direcciones exactas. Si contiene un email, un teléfono o una web, no se podrá publicar.
        </span>
      </label>
      <label className="block">
        <span className="field-label">Nota interna</span>
        <textarea name="adminNote" rows={2} maxLength={2000} defaultValue={r.adminNote ?? ""} className="field" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink-800 px-5 text-sm font-medium text-white disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cambios
        </button>
        <Feedback state={state} pending={pending} />
      </div>
    </form>
  );
}

const BUTTONS: Record<string, Array<[string, string, string]>> = {
  // [acción, texto, estilo]
  PENDING: [
    ["publish", "Aprobar y publicar", "bg-pine-600 text-white hover:bg-pine-700"],
    ["reject", "Rechazar", "bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50"],
  ],
  PUBLISHED: [
    ["hide", "Ocultar / retirar de la web", "bg-white text-ink-700 ring-1 ring-sand-300 hover:bg-sand-50"],
    ["resolve", "Marcar como resuelta", "bg-ink-800 text-white hover:bg-ink-900"],
  ],
  HIDDEN: [
    ["publish", "Volver a publicar", "bg-pine-600 text-white hover:bg-pine-700"],
    ["resolve", "Marcar como resuelta", "bg-ink-800 text-white hover:bg-ink-900"],
    ["pending", "Devolver a pendiente", "bg-white text-ink-700 ring-1 ring-sand-300 hover:bg-sand-50"],
  ],
  REJECTED: [["pending", "Devolver a pendiente", "bg-white text-ink-700 ring-1 ring-sand-300 hover:bg-sand-50"]],
  RESOLVED: [["pending", "Reabrir (pendiente)", "bg-white text-ink-700 ring-1 ring-sand-300 hover:bg-sand-50"]],
};

export function SearchStatusButtons({ action, status }: { action: Action; status: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-2">
        {(BUTTONS[status] ?? []).map(([value, label, cls]) => (
          <button key={value} name="action" value={value} disabled={pending} className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium disabled:opacity-60 ${cls}`}>
            {label}
          </button>
        ))}
      </div>
      {pending && <Loader2 className="h-4 w-4 animate-spin text-ink-400" />}
      <Feedback state={state} pending={pending} />
    </form>
  );
}

export function DeleteSearchButton({ action }: { action: () => Promise<SearchFormState> }) {
  const [state, formAction, pending] = useActionState(async () => action(), {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar definitivamente la solicitud y sus datos de contacto? No se puede deshacer.")) e.preventDefault();
      }}
    >
      <button disabled={pending} className="text-[13px] text-red-600 hover:underline">
        Eliminar solicitud y sus datos
      </button>
      {state.error && <p className="mt-1 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
