import type { Metadata } from "next";
import Link from "next/link";
import { L, LegalPage } from "@/components/landing/LegalPage";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/i18n/server";
import { legalValue } from "@/lib/legal";

export const metadata: Metadata = { title: "Aviso legal" };

export default async function LegalNoticePage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = await getRequestLanguage((await searchParams).lang);
  const dict = getDictionary(lang);
  return (
    <LegalPage dict={dict} lang={lang} basePath="/legal" title="Aviso legal">
      <h2>1. Titular de la web</h2>
      <p>En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI):</p>
      <ul>
        <li>
          Titular: <L k="ownerName" />
        </li>
        <li>
          NIF/CIF: <L k="ownerId" />
        </li>
        <li>
          Domicilio: <L k="ownerAddress" />
        </li>
        <li>
          Email de contacto: <L k="contactEmail" />
        </li>
        {legalValue("registry") && <li>Datos registrales: {legalValue("registry")}</li>}
      </ul>
      <p>FINCALIA360 es el nombre comercial de la plataforma.</p>

      <h2>2. Objeto</h2>
      <p>
        Esta web permite a propietarios de viviendas de toda España obtener un estudio orientativo gratuito: valor de venta estimado, referencias de
        alquiler, situación respecto a las zonas de mercado residencial tensionado y una comparativa económica entre vender, alquilar o mantener la
        vivienda. Si el propietario lo solicita expresamente, se le pone en contacto con un especialista para una valoración profesional. Además,
        incluye un portal de anuncios de inmuebles y de amarres náuticos en venta y en alquiler situados en Cataluña (provincias de Barcelona,
        Girona, Lleida y Tarragona), publicados por FINCALIA360 o por inmobiliarias colaboradoras, y permite a los propietarios solicitar gratis la
        publicación de su vivienda o su amarre. Cada anuncio se revisa antes de publicarse; los datos los facilita el anunciante.
      </p>

      <h2>3. Naturaleza de la información</h2>
      <p>
        Los estudios son <strong>estimaciones automáticas orientativas</strong> elaboradas con estadísticas oficiales y con los datos que aporta el
        propietario. No son tasaciones (Orden ECO/805/2003), ni valoraciones periciales, ni asesoramiento financiero, fiscal o jurídico. Cada informe
        indica sus fuentes, fechas, hipótesis y limitaciones. Ver las <Link href="/condiciones">condiciones de uso</Link>.
      </p>

      <h2>4. Propiedad intelectual</h2>
      <p>
        Los contenidos, el diseño y la marca FINCALIA360 pertenecen a su titular. Los datos de fuentes públicas (Catastro, INE, Ministerio de Vivienda,
        Generalitat de Catalunya, BOE) se reutilizan conforme a sus condiciones de uso y se citan en cada informe.
      </p>

      <h2>5. Responsabilidad</h2>
      <p>
        El titular no se responsabiliza de las decisiones adoptadas únicamente a partir de los estudios orientativos, ni de errores o interrupciones de
        las fuentes públicas consultadas. Los enlaces a webs de terceros se ofrecen solo a título informativo.
      </p>

      <h2>6. Legislación aplicable</h2>
      <p>Estas condiciones se rigen por la legislación española.</p>
    </LegalPage>
  );
}
