"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = React.ComponentProps<typeof Button> & { pendingLabel?: string };

/** Botón de formulario con estado "enviando" (server actions). */
export function SubmitButton({ children, pendingLabel, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
