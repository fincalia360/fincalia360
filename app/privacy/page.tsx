import type { Metadata } from "next";
import Link from "next/link";
import { L, LegalPage } from "@/components/landing/LegalPage";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/i18n/server";
import { legalValue } from "@/lib/legal";
import { REQUEST_CONSENT_VERSION } from "@/services/crm/requests";

export const metadata: Metadata = { title: "Política de privacidad" };

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = await getRequestLanguage((await searchParams).lang);
  const dict = getDictionary(lang);
  const hosting = legalValue("hosting");
  return (
    <LegalPage dict={dict} lang={lang} basePath="/privacy" title="Política de privacidad">
      <p>
        Explicamos qué datos tratamos cuando usas FINCALIA360, para qué y durante cuánto tiempo, conforme al Reglamento (UE) 2016/679 (RGPD) y a la
        Ley Orgánica 3/2018 (LOPDGDD). Versión de los textos de consentimiento: <code>{REQUEST_CONSENT_VERSION}</code>.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li>
          <L k="ownerName" /> · NIF/CIF <L k="ownerId" />
        </li>
        <li>
          Domicilio: <L k="ownerAddress" />
        </li>
        <li>
          Contacto para protección de datos: <L k="contactEmail" />
        </li>
      </ul>

      <h2>2. Qué datos tratamos</h2>
      <table>
        <thead>
          <tr>
            <th>Cuándo</th>
            <th>Datos</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Al hacer el estudio gratuito</td>
            <td>
              Datos de la vivienda (ubicación, dirección y referencia catastral si las indicas, superficie y características), su situación económica
              opcional (precio de compra, hipoteca, gastos) y tu situación (objetivo, residencia fiscal y, solo si lo indicas, si tienes 65 años o más).
              No pedimos nombre ni contacto para hacer el estudio.
            </td>
          </tr>
          <tr>
            <td>Si solicitas una valoración profesional</td>
            <td>Nombre, email, teléfono (opcional), forma de contacto preferida, comentarios y tus consentimientos con su fecha y versión.</td>
          </tr>
          <tr>
            <td>Si pides información o una visita de un inmueble del portal</td>
            <td>Nombre, email, teléfono (necesario para visitas), tu mensaje y tu consentimiento con su fecha y versión.</td>
          </tr>
          <tr>
            <td>Si trabajas en una inmobiliaria colaboradora con acceso a la Zona inmobiliarias</td>
            <td>Nombre, email profesional, contraseña (guardada cifrada, nunca en claro), rol y fechas de acceso.</td>
          </tr>
          <tr>
            <td>Al navegar</td>
            <td>
              Datos técnicos necesarios para el funcionamiento y la seguridad (dirección IP para limitar abusos, sin conservarla) y estadísticas de uso
              propias sin cookies de terceros (ver la <Link href="/cookies">política de cookies</Link>).
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Los datos de la vivienda que se completan desde el Catastro son datos públicos no protegidos (uso, superficie, año). Nunca consultamos
        titulares, ni obtenemos datos de portales inmobiliarios, ni contactamos con personas que no lo hayan solicitado.
      </p>

      <h2>3. Finalidades y base jurídica</h2>
      <ul>
        <li>
          <strong>Elaborar tu estudio y tu informe PDF</strong> a petición tuya: aplicación de medidas precontractuales y ejecución del servicio
          solicitado (art. 6.1.b RGPD).
        </li>
        <li>
          <strong>Atender tu solicitud de valoración profesional</strong> y contactarte para ello: tu consentimiento (art. 6.1.a), obligatorio solo para
          esa solicitud.
        </li>
        <li>
          <strong>Enviarte información comercial</strong>: solo si marcas la casilla opcional e independiente (art. 6.1.a). Puedes retirarlo en
          cualquier momento.
        </li>
        <li>
          <strong>Responder a tu solicitud sobre un inmueble</strong> del portal (información o visita): tu consentimiento (art. 6.1.a).
        </li>
        <li>
          <strong>Gestionar las cuentas de las inmobiliarias colaboradoras</strong> y su acceso seguro: ejecución de la relación con la inmobiliaria
          (art. 6.1.b).
        </li>
        <li>
          <strong>Seguridad y mejora del servicio</strong> con estadísticas agregadas: interés legítimo (art. 6.1.f).
        </li>
      </ul>
      <p>
        No tomamos decisiones automatizadas con efectos jurídicos sobre ti: los estudios son orientativos y la decisión es siempre tuya. El asistente
        virtual es un sistema automático de inteligencia artificial que puede equivocarse; las cifras de referencia son las de tu estudio.
      </p>

      <h2>4. Destinatarios</h2>
      <ul>
        <li>
          Proveedor de alojamiento de la web, como encargado del tratamiento: {hosting ? hosting : <L k="hosting" />}.
        </li>
        <li>
          Si solicitas una valoración profesional y así lo aceptas, el especialista o la inmobiliaria colaboradora de tu zona que la realice.
        </li>
        <li>
          Si usas el asistente virtual de tu estudio: Anthropic PBC (proveedor del modelo de inteligencia artificial Claude), como encargado del
          tratamiento, recibe tus mensajes y los datos de tu estudio para generar la respuesta. FINCALIA360 no guarda el contenido de esas
          conversaciones. No escribas datos personales en el chat.
        </li>
        <li>
          Si pides información de un inmueble anunciado por una inmobiliaria colaboradora: esa inmobiliaria, identificada en la ficha del inmueble,
          recibe tu solicitud para atenderla y la trata como responsable.
        </li>
        <li>
          Datos que cada inmobiliaria colaboradora gestiona en su espacio privado (CRM): la responsable es la propia inmobiliaria; FINCALIA360 solo
          los aloja y trata por su cuenta, como encargado del tratamiento. Ninguna otra inmobiliaria tiene acceso a ellos.
        </li>
        <li>Administraciones públicas cuando exista una obligación legal.</li>
      </ul>
      <p>
        Si algún proveedor estuviera fuera del Espacio Económico Europeo, la transferencia se ampararía en una decisión de adecuación o en cláusulas
        contractuales tipo de la Comisión Europea.
      </p>

      <h2>5. Conservación</h2>
      <ul>
        <li>Estudios sin solicitud de contacto: 12 meses desde su creación; después se eliminan.</li>
        <li>
          Solicitudes de valoración: mientras dure la relación y hasta 2 años desde el último contacto, salvo que antes pidas su supresión o retires
          el consentimiento.
        </li>
        <li>Solicitudes sobre inmuebles del portal: hasta 2 años desde la última comunicación, salvo que antes pidas su supresión.</li>
        <li>Cuentas de inmobiliarias: mientras dure la colaboración; los registros de acceso y de acciones, hasta 2 años.</li>
        <li>Prueba de los consentimientos: durante los plazos de prescripción de las posibles responsabilidades.</li>
      </ul>

      <h2>6. Tus derechos</h2>
      <p>
        Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, y retirar tu
        consentimiento en cualquier momento, escribiendo a <L k="contactEmail" /> e indicando el derecho que ejerces. Si consideras que no hemos
        atendido correctamente tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (
        <a href="https://www.aepd.es" target="_blank" rel="noreferrer">
          www.aepd.es
        </a>
        ).
      </p>

      <h2>7. Seguridad</h2>
      <p>
        Tu estudio solo es accesible desde el navegador en el que lo creaste (con un código de acceso aleatorio que guardamos cifrado). El panel del
        equipo está protegido con usuario y contraseña, y la web funciona con conexión cifrada (https).
      </p>
    </LegalPage>
  );
}
