"use client";

import { useActionState } from "react";
import type { FormState } from "@/components/listings/ListingForm";

/** Botón que pide confirmación antes de ejecutar una acción irreversible. */
export function ConfirmAction({ action, confirmText, children, className }: { action: () => Promise<FormState>; confirmText: string; children: React.ReactNode; className?: string }) {
  const [state, formAction, pending] = useActionState<FormState>(async () => action(), {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <button type="submit" disabled={pending} className={className ?? "text-[13px] font-medium text-red-600 hover:underline disabled:opacity-50"}>
        {children}
      </button>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
