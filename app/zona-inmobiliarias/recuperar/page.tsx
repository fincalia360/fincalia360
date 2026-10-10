import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/agency/AuthShell";
import { ResetRequestForm } from "@/components/agency/AuthForms";
import { requestResetAction } from "../authActions";

export const metadata: Metadata = { title: "Recuperar contraseña · Zona inmobiliarias" };

export default function RecoverPage() {
  return (
    <AuthShell title="Recuperar la contraseña" description="Te enviaremos un enlace para crear una contraseña nueva.">
      <ResetRequestForm action={requestResetAction} />
      <p className="mt-5 text-center text-sm">
        <Link href="/zona-inmobiliarias" className="text-ink-600 underline">
          Volver al acceso
        </Link>
      </p>
    </AuthShell>
  );
}
