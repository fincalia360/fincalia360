import type { Metadata } from "next";
import { AuthShell } from "@/components/agency/AuthShell";
import { SetPasswordForm } from "@/components/agency/AuthForms";
import { setPasswordAction } from "../authActions";

export const metadata: Metadata = { title: "Activar cuenta · Zona inmobiliarias" };

export default function ActivatePage() {
  return (
    <AuthShell title="Activa tu cuenta" description="Crea la contraseña con la que entrarás en la Zona inmobiliarias.">
      <SetPasswordForm action={setPasswordAction.bind(null, "INVITE")} label="Crear contraseña" />
    </AuthShell>
  );
}
