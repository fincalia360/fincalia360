"use client";

// Estado del inmueble, lo que falta para publicar y las acciones disponibles.
import { useActionState } from "react";
import { useActionForm } from "@/lib/useActionForm";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LISTING_STATUSES, LISTING_STATUS_TONES } from "@/services/listings/catalog";
import type { FormState } from "./ListingForm";

const LABELS: Record<string, string> = {
  submit: "Enviar a revisión",
  publish: "Publicar",
  reject: "Devolver a borrador",
  reserve: "Marcar reservado",
  unreserve: "Quitar reserva",
  close: "Vendido / alquilado",
  unpublish: "Retirar (despublicar)",
  archive: "Archivar",
  reopen: "Reabrir como borrador",
};
const PRIMARY = new Set(["publish", "submit"]);
const DANGER = new Set(["unpublish", "archive"]);

export function StatusPanel({
  status,
  operation,
  problems,
  transitions,
  action,
  publicUrl,
  reviewNote,
  isAdmin,
  onDelete,
}: {
  status: string;
  operation: string;
  problems: string[];
  transitions: string[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  publicUrl: string | null;
  reviewNote: string | null;
  isAdmin: boolean;
  onDelete?: () => Promise<FormState>;
}) {
  const [state, onSubmit, pending] = useActionForm(action, {});
  const [delState, delAction, deleting] = useActionState<FormState>(async () => (onDelete ? onDelete() : {}), {});
  const closeLabel = operation === "RENT" ? "Marcar alquilado" : "Marcar vendido";

  return (
    <div className="space-y-4 rounded-2xl border border-sand-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink-800">Estado</h2>
        <Badge tone={LISTING_STATUS_TONES[status] ?? "neutral"}>{LISTING_STATUSES[status as keyof typeof LISTING_STATUSES] ?? status}</Badge>
      </div>
      {publicUrl && (
        <Link href={publicUrl} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700 underline">
          Ver anuncio publicado <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
      {status === "REVIEW" && !isAdmin && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">FINCALIA360 está revisando el anuncio. Te avisaremos cuando se publique.</p>}
      {reviewNote && status === "DRAFT" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          <strong>Devuelto por FINCALIA360:</strong> {reviewNote}
        </p>
      )}
      {["DRAFT", "REVIEW", "UNPUBLISHED"].includes(status) &&
        (problems.length ? (
          <div className="rounded-xl bg-sand-50 p-3">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-700">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Para publicar falta:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink-600">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-pine-600">
            <CheckCircle2 className="h-4 w-4" /> Comprobaciones completas: {isAdmin ? "se puede publicar" : "se puede enviar a revisión"}.
          </p>
        ))}

      {transitions.length > 0 && (
        <form onSubmit={onSubmit} className="space-y-3">
          {isAdmin && transitions.includes("reject") && (
            <label className="block">
              <span className="field-label">Motivo si lo devuelves</span>
              <input name="note" maxLength={500} className="field" placeholder="Ej.: falta la hoja de encargo firmada" />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {transitions.map((t) => (
              <Button key={t} type="submit" name="transition" value={t} size="sm" variant={PRIMARY.has(t) ? "accent" : DANGER.has(t) ? "danger" : "outline"} disabled={pending || (PRIMARY.has(t) && problems.length > 0)}>
                {t === "close" ? closeLabel : LABELS[t]}
              </Button>
            ))}
          </div>
          {pending && <Loader2 className="h-4 w-4 animate-spin text-ink-400" />}
          {state.error && (
            <p className="text-sm text-red-600" role="alert">
              {state.error}
            </p>
          )}
        </form>
      )}

      {onDelete && (status === "DRAFT" || (isAdmin && (status === "UNPUBLISHED" || status === "ARCHIVED"))) && (
        <form
          action={delAction}
          onSubmit={(e) => {
            if (!confirm("¿Eliminar definitivamente este anuncio y sus fotos? No se puede deshacer.")) e.preventDefault();
          }}
          className="border-t border-sand-100 pt-3"
        >
          <button type="submit" disabled={deleting} className="text-[13px] text-red-600 hover:underline">
            {status === "DRAFT" ? "Eliminar borrador" : "Eliminar anuncio"}
          </button>
          {delState.error && <p className="mt-1 text-sm text-red-600">{delState.error}</p>}
        </form>
      )}
    </div>
  );
}
