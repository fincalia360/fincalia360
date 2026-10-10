import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/agency/AuthShell";
import { LoginForm } from "@/components/agency/AuthForms";
import { getAgencySession } from "@/services/agency/auth";
import { loginAction } from "./authActions";

export const metadata: Metadata = { title: "Zona inmobiliarias", description: "Acceso para inmobiliarias colaboradoras de FINCALIA360: CRM privado y publicación de inmuebles." };
export const dynamic = "force-dynamic";

const POINTS = [
  "Tu propio CRM: contactos, seguimiento, próximas tareas y visitas.",
  "Publica tus inmuebles en el portal de FINCALIA360 (con revisión previa).",
  "Recibe en tu CRM las solicitudes de tus anuncios y las oportunidades que te enviemos.",
  "Tus datos son solo tuyos: ninguna otra inmobiliaria puede verlos.",
];

export default async function AgencyLoginPage() {
  if (await getAgencySession()) redirect("/zona-inmobiliarias/panel");
  return (
    <AuthShell
      title="Accede a tu espacio"
      description="Con el email y la contraseña de tu cuenta."
      aside={
        <div className="max-w-lg">
          <h2 className="font-serif text-[32px] font-medium leading-tight tracking-tight text-ink-800 sm:text-4xl">El espacio privado de las inmobiliarias colaboradoras</h2>
          <ul className="mt-6 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-2.5 text-[15px] text-ink-600">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-pine-600" /> {p}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-ink-500">
            ¿Eres una inmobiliaria y quieres colaborar? Escríbenos desde la página de <a href="/legal" className="underline">contacto del aviso legal</a>. Las cuentas las crea FINCALIA360.
          </p>
        </div>
      }
    >
      <LoginForm action={loginAction} />
    </AuthShell>
  );
}
