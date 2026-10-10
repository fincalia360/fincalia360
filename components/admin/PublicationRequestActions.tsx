"use client";
// Acciones sobre una solicitud de publicación: estado, crear el anuncio y eliminarla.
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import type { RequestFormState } from "@/app/admin/solicitudes-publicacion/actions";

type Action = (prev: RequestFormState, formData: FormData) => Promise<RequestFormState>;

export function RequestStatusForm({ action, status, note }: { action: Action; status: string; note: string | null }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="field-label">Estado</span>
        <select name="status" defaultValue={status === "CONVERTED" ? "IN_REVIEW" : status} className="field">
          <option value="NEW">Nueva</option>
          <option value="IN_REVIEW">En revisión</option>
          <option value="REJECTED">Descartada</option>
        </select>
      </label>
      <label className="block">
        <span className="field-label">Nota interna</span>
        <textarea name="note" rows={3} maxLength={1000} defaultValue={note ?? ""} className="field" />
      </label>
      <button disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink-800 px-4 text-sm font-medium text-white disabled:opacity-60">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && !pending && <p className="text-sm text-pine-600">Guardado</p>}
    </form>
  );
}

export function ConvertRequestForm({ action, title, price }: { action: Action; title: string; price: number | null }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="field-label">Título del anuncio</span>
        <input name="title" required minLength={10} maxLength={110} defaultValue={title} className="field" />
      </label>
      <label className="block">
        <span className="field-label">Precio (€)</span>
        <input name="price" type="number" min={1} required defaultValue={price ?? ""} className="field" />
      </label>
      <button
        disabled={pending}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-terracotta-500 px-4 text-sm font-medium text-white hover:bg-terracotta-600 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Crear borrador del anuncio
      </button>
      <p className="text-xs text-ink-400">Se crea como borrador con los datos y las fotos. Después completas la autorización y lo publicas.</p>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function DeleteRequestButton({ action }: { action: () => Promise<RequestFormState> }) {
  const [state, formAction, pending] = useActionState(async () => action(), {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar definitivamente la solicitud, sus datos y sus fotos? No se puede deshacer.")) e.preventDefault();
      }}
    >
      <button disabled={pending} className="text-[13px] text-red-600 hover:underline">
        Eliminar solicitud y sus fotos
      </button>
      {state.error && <p className="mt-1 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
