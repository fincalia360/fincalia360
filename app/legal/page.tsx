import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/LegalPage";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Aviso legal (demo)" };

export default async function LegalNoticePage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = await getRequestLanguage((await searchParams).lang);
  const dict = getDictionary(lang);
  return (
    <LegalPage dict={dict} lang={lang} basePath="/legal" title="Aviso legal">
      <h2>Titular del sitio</h2>
      <p>[Razón social, NIF, domicilio, datos registrales y email de contacto — PENDIENTE].</p>
      <h2>Objeto</h2>
      <p>
        Este sitio permite a propietarios de viviendas en la Costa Brava solicitar una valoración orientativa y, si lo desean, ser
        puestos en contacto con un especialista o inmobiliaria local.
      </p>
      <h2>Valoraciones orientativas</h2>
      <p>
        Las estimaciones mostradas son orientativas, se calculan automáticamente con datos de referencia y no sustituyen una tasación
        oficial ni una valoración profesional. En esta demo los precios de referencia son ficticios.
      </p>
      <h2>Intermediación</h2>
      <p>[Descripción de la relación con las inmobiliarias colaboradoras y, en su caso, de la remuneración — PENDIENTE].</p>
      <h2>Propiedad intelectual</h2>
      <p>[PENDIENTE]. &quot;Tramontana&quot; es una marca ficticia utilizada únicamente para esta demostración.</p>
      <h2>Legislación aplicable</h2>
      <p>[PENDIENTE — revisar con asesoría jurídica].</p>
    </LegalPage>
  );
}
