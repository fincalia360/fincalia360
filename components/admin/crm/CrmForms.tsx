"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CrmActionState } from "@/app/admin/crmActions";

type Action = (prev: CrmActionState, formData: FormData) => Promise<CrmActionState>;

/** Formulario con estado: muestra el error o la confirmación y se limpia al guardar. */
export function ActionForm({
  action,
  children,
  submitLabel,
  okLabel = "Guardado",
  variant = "primary",
  className,
  resetOnSuccess = true,
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel: string;
  okLabel?: string;
  variant?: "primary" | "accent" | "outline" | "danger";
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className ?? "space-y-3"}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {submitLabel}
        </Button>
        {state.error && (
          <p className="text-xs text-red-600" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && !pending && (
          <p className="text-xs text-pine-600" role="status">
            {okLabel}
          </p>
        )}
      </div>
    </form>
  );
}
