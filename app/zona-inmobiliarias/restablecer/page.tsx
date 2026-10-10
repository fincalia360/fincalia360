import type { Metadata } from "next";
import { AuthShell } from "@/components/agency/AuthShell";
import { SetPasswordForm } from "@/components/agency/AuthForms";
import { setPasswordAction } from "../authActions";

export const metadata: Metadata = { title: "Nueva contraseña · Zona inmobiliarias" };

export default function ResetPage() {
  return (
    <AuthShell title="Crea una contraseña nueva" description="Al guardarla se cerrarán las sesiones abiertas en otros dispositivos.">
      <SetPasswordForm action={setPasswordAction.bind(null, "RESET")} label="Guardar contraseña" />
    </AuthShell>
  );
}
