# Portal inmobiliario y Zona inmobiliarias

Ampliación de FINCALIA360 (octubre de 2026). Se ha añadido sin tocar el estudio, las valoraciones, los cálculos, los informes PDF, el asistente ni el CRM de propietarios.
El único cambio visible en las páginas que ya existían es el **menú principal**.

## Qué hay ahora

| Área | Dónde | Quién |
|---|---|---|
| Portal: pisos en venta | `/comprar` | Público |
| Portal: pisos en alquiler | `/alquilar` | Público |
| Ficha de cada inmueble | `/inmueble/piso-venta-3-habitaciones-girona-f360-xxxxxx` | Público |
| Gestión de inmuebles y revisión de anuncios | Panel → **Inmuebles** (`/admin/inmuebles`) | Administrador |
| Cuentas de las inmobiliarias | Panel → **Colaboradores e inmobiliarias** → ficha → «Zona inmobiliarias» | Administrador |
| Acceso de las inmobiliarias | `/zona-inmobiliarias` | Inmobiliarias con cuenta |
| CRM de cada inmobiliaria | `/zona-inmobiliarias/panel` | Solo esa inmobiliaria |

## Cómo subir un piso (administrador)

1. Panel → **Inmuebles** → **Nuevo inmueble**. Rellena operación, precio, ubicación, características y descripción, y pulsa **Guardar borrador**.
2. En la ficha del inmueble:
   - sube las fotos (varias a la vez) y marca la principal con ★;
   - sube el documento de autorización del propietario (privado).
3. Completa el certificado energético y la autorización, y marca las tres comprobaciones.
4. El recuadro **Estado** indica lo que falta. Cuando no falta nada, pulsa **Publicar**.
5. Después puedes:
   - marcarlo como **Reservado**, **Vendido** o **Alquilado**;
   - **Despublicarlo** o **Archivarlo**.

   Solo se pueden borrar los borradores; el resto se archiva para no perder el historial.

**No se puede publicar** sin:
- al menos una foto;
- una descripción de al menos 80 caracteres;
- la superficie;
- el certificado energético (o «En trámite» / «Exento»);
- el tipo y la fecha de la autorización;
- las comprobaciones marcadas.

En alquiler, además, hacen falta:
- el tipo de alquiler;
- la fianza;
- la revisión de la normativa;
- en temporada, el número del Registro Único de Arrendamientos.

## Cómo dar acceso a una inmobiliaria

1. Panel → **Colaboradores e inmobiliarias** → la inmobiliaria (debe estar «Activa»).
2. En «Zona inmobiliarias»:
   - marca **Acceso a la Zona inmobiliarias**;
   - fija los límites del plan (inmuebles activos y usuarios);
   - pulsa **Guardar acceso**.
3. **Invitar a un usuario** con su nombre y email.
   - Con el correo configurado (Resend), le llega la invitación.
   - Sin correo, el panel muestra el enlace para que se lo envíes tú. Caduca en 72 horas.
4. La persona crea su contraseña y entra en `/zona-inmobiliarias`.

Desde la misma ficha puedes:
- reenviar la invitación;
- generar un enlace de contraseña nueva (60 minutos);
- cambiar el rol;
- desactivar a un usuario, lo que cierra sus sesiones.

Al quitar el acceso a la inmobiliaria:
- se cierran todas sus sesiones;
- sus anuncios dejan de verse en el portal.

## Qué puede hacer cada inmobiliaria (CRM v1)

- **Inicio:**
  - contactos pendientes;
  - operaciones en curso y cerradas;
  - solicitudes nuevas;
  - tareas vencidas y próximas;
  - visitas programadas.
- **Contactos:**
  - propietarios, compradores e inquilinos, sin duplicados por email o teléfono;
  - los 8 estados comerciales;
  - notas;
  - registro de llamadas, WhatsApp, emails y reuniones;
  - historial;
  - próxima acción;
  - visitas;
  - descarga y supresión de datos (RGPD).
- **Inmuebles:**
  - crearlos y editarlos con el mismo editor del administrador;
  - **enviarlos a revisión**;
  - marcarlos como reservado, vendido o alquilado;
  - despublicarlos.

  **No pueden publicar:** publica el administrador. Si cambian un anuncio publicado, vuelve a revisión y deja de verse hasta que se apruebe.
- **Solicitudes:** las que llegan desde sus anuncios. Cada persona se crea o se actualiza como contacto.
- **Oportunidades de FINCALIA360:** cuando asignas un propietario a la inmobiliaria (solo con su consentimiento), aparece en su CRM como «Pendiente de contactar».

## Seguridad

- **Dos accesos separados:**
  - el del administrador, que es el de siempre;
  - el de las inmobiliarias, con usuarios en la base de datos.

  Una sesión de administrador no abre la Zona inmobiliarias, y al revés.
- **Separación entre inmobiliarias:** todas las consultas filtran por la inmobiliaria **de la sesión del servidor**. Un identificador de otra inmobiliaria da «no encontrado», también en las fotos, los documentos y las descargas. Hay pruebas automáticas que lo comprueban (`tests/portal.integration.test.ts`).
- **Contraseñas:**
  - cifradas con scrypt;
  - política mínima de 10 caracteres con letras y números;
  - bloqueo de 15 minutos tras 5 intentos;
  - límite de intentos por IP;
  - mensajes que no revelan si un email existe.
- **Sesiones:** la cookie lleva un token aleatorio y en la base solo se guarda su hash. Las sesiones caducan a las 12 horas y se cierran al cambiar la contraseña o desactivar el usuario.
- **Enlaces de invitación y recuperación:**
  - son de un solo uso;
  - caducan;
  - el código va tras `#`, así que no llega a los registros del servidor.
- **Fotos:**
  - se comprueba que sean imágenes reales;
  - se redimensionan a WebP;
  - **se borran sus metadatos, incluido el GPS**;
  - las de borradores solo las ve quien tiene acceso.
- **Documentos de autorización:** nunca son públicos.
- **Web pública:** nunca muestra la dirección exacta, la referencia catastral ni los documentos.
- **Registro de auditoría** (`AuditLog`): publicaciones, cambios de estado, cuentas, exportaciones y borrados.

## Fotos y datos al publicar versiones nuevas

- La base de datos y las fotos están en el **disco persistente** de Render:
  - `DATABASE_URL=file:/var/data/fincalia360.db`;
  - `UPLOAD_DIR=/var/data/uploads`, ya incluido en `render.yaml`.
- Publicar una versión nueva no las borra.
- Las copias automáticas del disco de Render cubren ambas.
- El disco es de 1 GB: caben unas 2.500 fotos (cada una ocupa ~300–400 KB entre la versión grande y la miniatura).

## Pendiente y limitaciones (no implementado a propósito)

- **Revisión legal antes de abrir el portal al público.**
  - Si FINCALIA360 publica inmuebles propios, actúa como intermediaria: en Cataluña (y en otras comunidades) hay registros obligatorios de agentes inmobiliarios.
  - Los textos de privacidad y condiciones se han ampliado, pero deben revisarse.
  - Hay que firmar con cada inmobiliaria un **contrato de encargo del tratamiento**, porque FINCALIA360 aloja los datos de su CRM.
- **Pagos y suscripciones:** no implementados. Los límites del plan (inmuebles y usuarios) ya existen y los fijas tú a mano.
- **Mapa:** no incluido. Se puede añadir con Leaflet y un proveedor de mapas con plan gratuito, mostrando solo la zona aproximada.
- **Almacenamiento externo de fotos** (Cloudflare R2 o S3): preparado para añadirse sin cambiar el resto (`services/storage/storage.ts`). Hoy usa el disco.
- **Base de datos PostgreSQL:** recomendable cuando haya varias inmobiliarias activas. Hoy sigue en SQLite.
- **Fase 2 del CRM:**
  - calendario;
  - avisos de visitas por correo;
  - permisos distintos para responsable y agente (hoy todos los usuarios de una inmobiliaria ven todos sus datos);
  - importación desde Excel;
  - verificación en dos pasos.
- **Correos:** los avisos de nuevas solicitudes y las invitaciones solo se envían si Resend está configurado. Nunca se simulan.
