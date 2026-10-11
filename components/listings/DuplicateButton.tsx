"use client";
// Duplicar un anuncio: crea un borrador nuevo con los mismos datos y fotos.
import { useActionState } from "react";
import { Copy, Loader2 } from "lucide-react";
import type { FormState } from "./ListingForm";

export function DuplicateButton({ action }: { action: () => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState<FormState>(async () => action(), {});
  return (
    <form action={formAction} className="rounded-2xl border border-sand-200 bg-white p-4">
      <button disabled={pending} className="inline-flex items-center gap-2 text-sm font-medium text-ink-700 hover:underline disabled:opacity-60">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Duplicar anuncio
      </button>
      <p className="mt-1 text-xs text-ink-400">Crea un borrador nuevo con estos datos y fotos (por ejemplo, para otra plaza o un piso igual).</p>
      {state.error && <p className="mt-1 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
