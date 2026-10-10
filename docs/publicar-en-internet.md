# Cómo publicar FINCALIA360 en internet

Guía paso a paso. Lo técnico ya está preparado (configuración `render.yaml`, base de datos, seguridad y textos legales).
Tú solo necesitas crear dos cuentas, rellenar unos datos y, si quieres, comprar el dominio.

**Coste aproximado:** alojamiento unos 7–8 $/mes (Render, plan Starter con disco) + dominio unos 10–15 €/año.

---

## Antes de empezar: ten a mano estos datos

Son obligatorios para el aviso legal y la política de privacidad (la web muestra un aviso mientras falten):

| Dato | Ejemplo |
|---|---|
| Nombre o razón social del titular | «María Pérez López» o «Fincalia360 S.L.» |
| NIF / CIF | 12345678Z / B12345678 |
| Domicilio | Calle Mayor 1, 08001 Barcelona |
| Email de contacto (también para protección de datos) | hola@fincalia360.es |
| Datos registrales (solo si es una sociedad) | Registro Mercantil de Barcelona, tomo…, hoja… |

Recomendación: que un abogado revise los textos de `/legal`, `/privacy`, `/cookies` y `/condiciones` antes de recibir solicitudes reales.

---

## Paso 1 · Subir el código a GitHub (gratis)

1. Crea una cuenta en <https://github.com> (si no la tienes).
2. Pulsa **New repository** → nombre `fincalia360` → marca **Private** → **no** añadas README → **Create repository**.
3. Copia la dirección que aparece (termina en `.git`) y pásamela: yo subo el código. La primera vez se abrirá una ventana para que inicies sesión en GitHub.

## Paso 2 · Crear la web en Render

1. Crea una cuenta en <https://render.com> con **Sign in with GitHub**.
2. Pulsa **New → Blueprint** y elige el repositorio `fincalia360`. Render leerá el fichero `render.yaml`.
3. Rellena los valores que te pide:
   - `ADMIN_USER`: el usuario para entrar al panel del equipo (p. ej. tu nombre).
   - `ADMIN_PASSWORD`: una contraseña **larga** (16 caracteres o más) que no uses en otro sitio.
   - `LEGAL_OWNER_NAME`, `LEGAL_OWNER_NIF`, `LEGAL_OWNER_ADDRESS`, `LEGAL_CONTACT_EMAIL` (y `LEGAL_OWNER_REGISTRY` si es una sociedad).
   - `SITE_URL`: de momento déjalo vacío; lo rellenas en el paso 3.
4. Pulsa **Apply**. La primera publicación tarda unos 5–10 minutos.
5. Tendrás la web en una dirección como `https://fincalia360.onrender.com`. Pruébala: haz un estudio y descarga el PDF.
6. El panel del equipo está en `/login` (con el usuario y la contraseña del punto 3).

La base de datos se crea **vacía** en el disco del servidor (sin los datos de demostración de tu ordenador) y se conserva entre publicaciones. Render hace copias automáticas del disco; compruébalo en la pestaña **Disks** del servicio.

## Paso 3 · Tu dominio (opcional pero recomendable)

1. Compra el dominio (p. ej. `fincalia360.es` o `.com`) en un registrador: DonDominio, Arsys, IONOS, Namecheap…
2. En Render: servicio → **Settings → Custom Domains → Add** → escribe `www.fincalia360.es`.
3. Render te indica un registro **CNAME**: añádelo en la zona DNS de tu registrador. En unos minutos u horas funcionará, con el candado **https** gratuito.
4. En Render → **Environment**: pon `SITE_URL` = `https://www.fincalia360.es`.
5. Cuando los textos legales estén revisados y quieras aparecer en Google: `ALLOW_INDEXING` = `true`.

---

## Paso 4 · Correo (Resend)

Para que la web envíe la confirmación al propietario, el informe por email y el aviso al equipo:

1. Crea una cuenta en <https://resend.com> (gratis hasta unos 3.000 correos al mes).
2. **Domains → Add domain** con tu dominio y añade en tu registrador los registros DNS que te indique (SPF/DKIM). Sin dominio verificado solo podrías enviarte correos a ti mismo.
3. **API Keys → Create** y copia la clave.
4. En Render → **Environment**: `RESEND_API_KEY` (la clave), `EMAIL_FROM` (`FINCALIA360 <hola@tudominio.es>`) y `TEAM_NOTIFICATION_EMAIL` (tu correo).
5. Comprueba en el panel → **Negocio** que ya no aparece el aviso «El correo no está configurado».

Los correos son de servicio (confirmaciones e informe solicitado). La plataforma **no envía publicidad automática**.

## Paso 5 · Asistente virtual (Claude)

1. Crea una cuenta en <https://console.anthropic.com>, añade un método de pago y fija un **límite de gasto mensual** (Settings → Limits).
2. **API Keys → Create Key** y cópiala.
3. En Render → **Environment**: `ANTHROPIC_API_KEY` = la clave. Opcional: `CHAT_DAILY_MESSAGE_LIMIT` (por defecto 500 mensajes al día).
4. El chat aparece en los resultados de cada estudio. Sin clave, simplemente no se muestra.

Coste (modelo `claude-haiku-5-5`: 0,10 $ por millón de tokens de entrada y 0,50 $ por millón de salida; confírmalo en anthropic.com/pricing):
cada mensaje usa unos 2.500–5.000 tokens de entrada y 250–800 de salida, así que cuesta unos **0,0004–0,001 $** (menos de una décima de céntimo).
Una conversación de 10 mensajes cuesta menos de 1 céntimo. Con el tope de 500 mensajes al día, el máximo es de unos 0,75 $ al día.
Cada mensaje registra sus tokens reales, así que el coste exacto se puede calcular después.

## Portal y Zona inmobiliarias

Las fotos de los inmuebles se guardan en el mismo disco persistente que la base de datos (`UPLOAD_DIR=/var/data/uploads`, ya en `render.yaml`): no se pierden al publicar versiones nuevas. Cómo subir pisos y dar acceso a las inmobiliarias: `docs/portal-y-zona-inmobiliarias.md`.

## Qué está preparado

- Las páginas internas (panel, solicitudes antiguas, asistente) exigen el inicio de sesión del equipo.
- Cada estudio solo se ve desde el navegador que lo creó.
- Los estudios sin solicitud de contacto se eliminan automáticamente a los 12 meses (como dice la política de privacidad).
- Cabeceras de seguridad, https y bloqueo de buscadores hasta que lo actives.
- Servidores en la Unión Europea (Frankfurt).

## Pendiente (no impide publicar, pero conviene)

- **Avisos por correo**: hoy las solicitudes de valoración llegan al panel, pero no se envía un email al equipo ni al propietario. Hay que contratar un servicio de envío (los hay gratuitos al empezar) y lo conecto.
- **Alquiler máximo legal en zona tensionada**: validar las reglas con un abogado (ver `docs/auditoria-fincalia360.md`).
- **Actualizar los datos oficiales**: el valor tasado del Ministerio es trimestral (`scripts/import-valor-tasado.py`) y SERPAVI es anual (`scripts/import-serpavi.py`). Después de importarlos, subir los cambios a GitHub y Render vuelve a publicar solo.
