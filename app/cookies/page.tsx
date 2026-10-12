import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/LegalPage";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Política de cookies" };

const ROWS = [
  ["estudio_…", "Propia · técnica", "Permite que solo tú (desde este navegador) veas tu estudio. Contiene un código aleatorio.", "30 días"],
  ["lang", "Propia · técnica", "Recuerda el idioma elegido en las páginas que lo permiten.", "1 año"],
  ["admin_session", "Propia · técnica", "Mantiene la sesión del equipo en el panel interno (no se usa con visitantes).", "Sesión del panel"],
];

export default async function CookiesPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = await getRequestLanguage((await searchParams).lang);
  const dict = getDictionary(lang);
  return (
    <LegalPage dict={dict} lang={lang} basePath="/cookies" title="Política de cookies">
      <p>
        FINCALIA360 utiliza únicamente <strong>cookies técnicas propias</strong>, necesarias para prestar el servicio que solicitas. No usamos cookies
        publicitarias ni de análisis de terceros, por lo que no mostramos un banner de consentimiento (art. 22.2 LSSI).
      </p>
      <table>
        <thead>
          <tr>
            <th>Cookie</th>
            <th>Tipo</th>
            <th>Finalidad</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([name, type, purpose, duration]) => (
            <tr key={name}>
              <td>
                <code>{name}</code>
              </td>
              <td>{type}</td>
              <td>{purpose}</td>
              <td>{duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Estadísticas propias</h2>
      <p>
        Para saber cuántas personas usan cada paso del estudio y cuántas visitas recibe cada anuncio, guardamos eventos anónimos (por ejemplo,
        «estudio iniciado» o «visita a un anuncio», con la población aproximada de la visita) con un identificador aleatorio que solo vive mientras la
        pestaña está abierta (almacenamiento de sesión del navegador). No se comparte con terceros ni permite identificarte.
      </p>
      <h2>Cómo eliminarlas</h2>
      <p>
        Puedes borrar las cookies desde la configuración de tu navegador. Si borras la cookie de tu estudio, dejarás de poder verlo desde ese
        navegador.
      </p>
      <p>Si en el futuro se incorporan herramientas de terceros, esta política se actualizará y se pedirá tu consentimiento antes de usarlas.</p>
    </LegalPage>
  );
}
