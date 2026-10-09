import type { Metadata } from "next";
import Link from "next/link";
import { L, LegalPage } from "@/components/landing/LegalPage";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Condiciones de uso" };

export default async function TermsPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = await getRequestLanguage((await searchParams).lang);
  const dict = getDictionary(lang);
  return (
    <LegalPage dict={dict} lang={lang} basePath="/condiciones" title="Condiciones de uso">
      <h2>1. El servicio</h2>
      <p>
        FINCALIA360 ofrece gratuitamente un estudio orientativo sobre una vivienda: valor de venta estimado, referencias de alquiler, situación respecto
        a las zonas de mercado residencial tensionado, impuestos y costes estimados, y una comparativa entre vender, alquilar o mantener.
      </p>

      <h2>2. Qué es y qué no es el estudio</h2>
      <ul>
        <li>
          Es una <strong>estimación automática</strong> con estadísticas oficiales (Catastro, INE, Ministerio de Vivienda, SERPAVI, Generalitat de
          Catalunya, BOE) y con los datos que aportas. Cada cifra indica su fuente, su fecha y si es un dato oficial, una estimación o una hipótesis.
        </li>
        <li>
          <strong>No es una tasación</strong> (Orden ECO/805/2003) ni sirve para hipotecas, herencias o procedimientos que exijan una tasación oficial.
        </li>
        <li>
          <strong>No es asesoramiento</strong> financiero, fiscal ni jurídico. Los impuestos y el alquiler máximo legal se calculan con reglas
          generales; tu caso puede tener circunstancias que cambien el resultado.
        </li>
        <li>
          Cuando faltan datos, el estudio lo indica en lugar de inventar cifras. Las estimaciones basadas en medias del municipio o de la provincia no
          recogen las características concretas de la vivienda.
        </li>
      </ul>

      <h2>3. Tu uso de la web</h2>
      <p>
        Te comprometes a facilitar datos veraces y a usar la web solo para estudiar viviendas sobre las que tengas un interés legítimo. No está
        permitido el uso automatizado masivo de la web ni de sus consultas a fuentes oficiales.
      </p>

      <h2>4. Valoración profesional</h2>
      <p>
        Solo si la solicitas, un especialista te contactará para una valoración presencial. Es gratuita y sin compromiso; tu estudio y tu informe son
        tuyos tanto si la solicitas como si no.
      </p>

      <h2>5. Responsabilidad</h2>
      <p>
        Los estudios se ofrecen tal cual, con la información disponible en la fecha de consulta. El titular no responde de las decisiones tomadas
        únicamente a partir de ellos ni de errores o cambios de las fuentes públicas. Para decisiones importantes, consulta a un profesional.
      </p>

      <h2>6. Contacto</h2>
      <p>
        Para cualquier consulta: <L k="contactEmail" />. Datos del titular en el <Link href="/legal">aviso legal</Link>; tratamiento de datos en la{" "}
        <Link href="/privacy">política de privacidad</Link>.
      </p>
    </LegalPage>
  );
}
