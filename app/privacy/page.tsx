import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/LegalPage";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/i18n/server";
import { CONSENT_VERSION } from "@/services/leadService";

export const metadata: Metadata = { title: "Política de privacidad (demo)" };

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = await getRequestLanguage((await searchParams).lang);
  const dict = getDictionary(lang);
  return (
    <LegalPage dict={dict} lang={lang} basePath="/privacy" title="Política de privacidad">
      <p>
        Versión del texto: <code>{CONSENT_VERSION}</code>. Esta versión es la que se guarda junto a cada consentimiento (campo{" "}
        <code>consent_version</code>), con su fecha y hora (<code>consent_timestamp</code>).
      </p>
      <h2>1. Responsable del tratamiento</h2>
      <p>[Razón social, NIF, domicilio y email de contacto del responsable — PENDIENTE].</p>
      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>Datos de contacto que nos facilitas: nombre, email, teléfono e idioma preferido.</li>
        <li>Datos de la vivienda: ubicación aproximada, tipo, superficie, características y situación.</li>
        <li>Tu intención y plazo de venta, y las conversaciones con nuestra asistente virtual.</li>
      </ul>
      <h2>3. Finalidades y base jurídica</h2>
      <ul>
        <li>Responder a tu solicitud de valoración y contactarte sobre la posible venta: consentimiento (consent_contact).</li>
        <li>Ponerte en contacto con una inmobiliaria colaboradora de la zona, si así lo aceptas: consentimiento.</li>
        <li>Enviarte información de mercado: consentimiento opcional e independiente (consent_marketing).</li>
      </ul>
      <h2>4. Origen de los datos</h2>
      <p>
        Únicamente los datos que tú mismo nos facilitas a través de nuestros formularios o conversaciones. No obtenemos datos de portales
        inmobiliarios ni de terceros, ni contactamos a personas que no lo hayan solicitado.
      </p>
      <h2>5. Destinatarios</h2>
      <p>[Inmobiliarias colaboradoras y encargados del tratamiento (hosting, CRM, mensajería) — PENDIENTE].</p>
      <h2>6. Conservación</h2>
      <p>[Plazos de conservación — PENDIENTE].</p>
      <h2>7. Tus derechos</h2>
      <p>
        Puedes acceder, rectificar, suprimir, oponerte, limitar el tratamiento, solicitar la portabilidad y retirar tu consentimiento en
        cualquier momento escribiendo a [email — PENDIENTE]. También puedes reclamar ante la autoridad de control competente.
      </p>
      <h2>8. Asistente virtual</h2>
      <p>
        La conversación inicial la atiende una asistente virtual automatizada. Puedes pedir hablar con una persona en cualquier momento.
      </p>
    </LegalPage>
  );
}
