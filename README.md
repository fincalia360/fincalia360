# FINCALIA360 — documento maestro

> **Léelo antes de cada tarea.** Documenta el estado real del proyecto. Si algo no coincide, manda el código.
> Actualiza solo las partes afectadas cuando cambie la arquitectura, una funcionalidad importante, una tabla o la configuración.

## 1. Qué es

Portal inmobiliario de **Cataluña** (Barcelona, Girona, Lleida, Tarragona) con venta, alquiler, amarres, traspasos de negocios y «Busco comprar», más una **herramienta gratuita de valoración de vivienda para toda España**. Web en 5 idiomas (es, ca, en, de, fr).

- Producción: **https://fincalia360.onrender.com** (Render, despliegue automático al hacer `git push` a `master` del repo `github.com/fincalia360/fincalia360`).
- Carpeta del código: `captacion-costa-brava/` (nombre histórico del prototipo).

## 2. Tecnología y estructura

Next.js 15 (App Router, componentes de servidor y server actions) · React 19 · TypeScript · Tailwind 3.4 · Prisma 6 + **SQLite** · zod · sharp (fotos) · pdf-lib (informe PDF) · maxmind (población aproximada de visitas) · vitest.

```
app/            páginas y rutas API (app/api/*); panel en app/admin/*
components/     UI por área (portal, landing, study, searchRequests, admin, legal…)
services/       lógica de negocio (listings, searchRequests, study, crm, email, ai, geo, storage…)
lib/            utilidades, autenticación, i18n (lib/i18n/*)
prisma/         schema.prisma, seed; dev.db local (no se versiona)
scripts/        ensure-db.mjs (crea/sincroniza la BD al arrancar), demo-pisos.ts
tests/          vitest (unitarias e integración con BD SQLite propia por archivo)
docs/           documentos históricos de diseño y negocio (pueden estar desfasados)
```

## 3. Arquitectura

- **Frontend/backend**: todo en Next.js. Páginas de servidor; formularios cliente que llaman a `app/api/*` (público) o a server actions (panel). Validación siempre con zod en el servidor.
- **Base de datos**: SQLite vía Prisma. En Render: `file:/var/data/fincalia360.db` en disco persistente. Cambios de esquema con `prisma db push` (lo ejecuta `scripts/ensure-db.mjs` al arrancar; **nunca** `--accept-data-loss`). Solo cambios aditivos. Copia antes de tocar el esquema: `prisma/dev.db` → `backups/`.
- **Modelos principales** (`prisma/schema.prisma`):
  - `Listing` (+ `ListingPhoto`, `ListingInquiry`): anuncios. `category` = `HOME` | `MOORING` | `BUSINESS` (traspasos); `operation` = `SALE` | `RENT` | `TRANSFER`; `status` DRAFT → REVIEW → PUBLISHED / RESERVED / SOLD / RENTED / UNPUBLISHED / ARCHIVED. `agencyId` opcional (inmobiliaria colaboradora). `translations` (JSON con textos ca/en/de/fr). Traspasos: `price` = precio del traspaso, `premisesRent` = alquiler mensual del local, `propertyType` = categoría `NEG_*` (`BUSINESS_TYPES` en `services/listings/catalog.ts`).
  - `PublicationRequest`: «Publica gratis» (propietarios: inmueble, amarre o negocio en traspaso con `title` y `premisesRent`). Fotos privadas; el admin la convierte en borrador de `Listing`.
  - `SearchRequest`: «Busco comprar» (quien busca inmueble). Moderada; datos de contacto nunca públicos.
  - `ContactMessage`: formulario de contacto.
  - `Study` (+ `TensionedAreaDeclaration`, `OfficialDataCache`, `MarketReference`, `RentComparable`): herramienta de valoración.
  - `Lead`, `Consent`, `ServiceRequest`, `Appointment`, `Agency`, `AgencyUser`, `AgencyContact`…: CRM y zona de inmobiliarias (heredados del prototipo).
  - `Event`: analítica propia (categoría `ANALYTICS` embudo del estudio; `LISTING` visitas y «compartir» por anuncio).
  - `AuditLog`: registro de acciones sensibles. `AiUsage`: consumo de IA.
- **Autenticación**: panel `/admin` con `ADMIN_USER`/`ADMIN_PASSWORD` y sesión firmada (`lib/auth.ts`, `lib/session.ts`, `middleware.ts`). Sin contraseña: acceso libre solo en desarrollo; en producción el panel se bloquea. Toda acción del panel llama a `requireAdmin()`. Zona de inmobiliarias con sesión propia en BD (`/zona-inmobiliarias`).
- **Imágenes y archivos** (`services/storage`, `services/listings/uploads.ts`): disco local (`UPLOAD_DIR`, en Render `/var/data/uploads`). Fotos públicas a WebP sin metadatos/GPS, servidas en `/media/…`; fotos de solicitudes privadas (solo panel).
- **Formularios públicos**: antispam (campo oculto + tiempo mínimo), límite por IP (`lib/rateLimit.ts`, en memoria), consentimientos nunca premarcados con texto y versión guardados.
- **Idiomas**: cookie `lang` (el middleware redirige `?lang=xx` a la URL limpia). Diccionarios en `lib/i18n/portal/*`, `lib/i18n/searchRequests.ts`, `lib/i18n/study/*` (valoración), `lib/i18n/valuation/home.ts`. Las URLs son las mismas en todos los idiomas.
- **Servicios externos** (todos opcionales y gratuitos salvo IA y email):
  - Fuentes oficiales para la valoración: Catastro, INE, Ministerio de Vivienda (SERPAVI, zonas tensionadas), Generalitat (precios registrados).
  - Anthropic (Claude) para chat de la valoración, redacción y traducción de anuncios: solo si hay `ANTHROPIC_API_KEY` (de pago por uso; **no configurada**).
  - Resend para emails: solo si hay `RESEND_API_KEY` (no configurado; nunca se simula el envío).
  - DB-IP Lite (gratuita, CC BY 4.0): población aproximada de las visitas; se descarga sola al disco en producción. La IP no se guarda.

## 4. Funcionalidades existentes

| Sección | URL | Cómo funciona |
|---|---|---|
| Inicio | `/` | Buscador, venta/alquiler, banda «Busco comprar», categorías, publicar gratis y, debajo, la valoración. |
| Venta / Alquiler | `/comprar`, `/alquilar`, `/comprar/<grupo>`, `/comprar/<grupo>/<población>` | Búsqueda con filtros por tipo, provincia, municipio, precio, características. Solo anuncios publicados de Cataluña. |
| Amarres | `/amarres/comprar`, `/amarres/alquilar`, `/amarre/<slug>` | Igual que venta/alquiler con campos náuticos. |
| Traspaso de negocios | `/traspasos`, `/traspaso/<slug>` | Negocios en traspaso (`category = BUSINESS`, `operation = TRANSFER`). Precio del traspaso distinto de venta/alquiler. |
| Ficha | `/inmueble/<slug>` | Fotos, datos, contacto (`ListingInquiry`), compartir (WhatsApp, Facebook, X, email, enlace), contador de visitas, similares. |
| Busco comprar | `/busco-piso`, `/busco-piso/solicitudes` | Formulario moderado (pendiente → publicada/oculta/rechazada/resuelta). Fichas públicas sin contacto. Coincidencias con anuncios en el panel. |
| Publica gratis | `/publicar` (`?tipo=amarre`, `?tipo=negocio`) | Solicitud del propietario con fotos privadas; el admin la revisa y crea el borrador. |
| Valorar vivienda | `/estudio`, `/estudio/<id>` | Estudio vender/alquilar/mantener para toda España, informe PDF, chat. **Protegida.** Antiguo flujo `/valorar` sigue existiendo. |
| Contacto y legales | `/contacto`, `/legal`, `/privacy`, `/cookies`, `/condiciones` | Textos legales en español (traducciones pendientes, ver §7). |
| Panel | `/admin` | Anuncios (crear, editar, publicar, retirar, duplicar, fotos, IA, traducciones, visitas; «Nuevo traspaso» y filtro «Traspasos»), solicitudes de publicación, Busco comprar, mensajes, estudios, contactos/CRM, colaboradores, configuración. |
| Zona inmobiliarias | `/zona-inmobiliarias` | CRM para inmobiliarias colaboradoras (existe; retirada del menú). |
| SEO | `app/sitemap.ts`, `app/robots.ts` | Metadatos por página, canonical, JSON-LD en fichas. Indexación solo con `ALLOW_INDEXING=true`. |

## 5. Reglas que no se pueden incumplir

1. **No modificar «Valorar vivienda»** (diseño, textos, campos, cálculos, integraciones) sin autorización expresa.
2. No eliminar ni alterar inmuebles ni clientes existentes.
3. Sin cambios generales ni refactorizaciones que la tarea no necesite; no tocar funcionalidades no relacionadas.
4. Sin migraciones destructivas; solo cambios aditivos con copia previa de la BD.
5. Sin servicios de pago sin autorización.
6. No exponer datos personales ni credenciales (nada de secretos en el código ni en este README; nada personal en URLs).
7. Cambios pequeños, seguros y fáciles de mantener; no duplicar componentes, modelos, tablas ni funciones.
8. No publicar en producción (push a `master`) sin autorización del propietario.
9. No inventar datos; los datos de prueba deben ir marcados como ficticios.
10. Consentimiento de publicidad nunca obligatorio ni premarcado.
11. No hacer scraping de Idealista, Fotocasa ni Habitaclia.
12. No afirmar que las pruebas pasan sin ejecutarlas; comprobar los cambios en el navegador.

## 6. Configuración, pruebas y despliegue

```bash
npm install            # genera el cliente Prisma
npm run dev            # crea/sincroniza la BD (scripts/ensure-db.mjs) y arranca en http://localhost:3000
npm run typecheck && npm run lint && npm test
```

- Variables (plantilla en `.env.example`; en Render se ponen en *Environment*): `DATABASE_URL`, `UPLOAD_DIR`, `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SITE_URL`, `ALLOW_INDEXING`, `LEGAL_OWNER_NAME`, `LEGAL_OWNER_NIF`, `LEGAL_OWNER_ADDRESS`, `LEGAL_CONTACT_EMAIL`, `LEGAL_OWNER_REGISTRY`, `LEGAL_HOSTING_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AI_LISTING_DAILY_LIMIT`, `CHAT_DAILY_MESSAGE_LIMIT`, `CHAT_DEMO`, `RESEND_API_KEY`, `EMAIL_FROM`, `TEAM_NOTIFICATION_EMAIL`, `SEED_DEMO_DATA`, `STUDY_EXAMPLE_DATA`. Opcionales de geolocalización: `GEOIP_DIR`, `GEOIP_DISABLED`.
- Despliegue: `render.yaml` (web Node + disco `/var/data`). Push a `master` → Render compila (`npm run build`) y arranca (`npm start`, que antes sincroniza la BD).
- Pruebas: `tests/*.test.ts`; las de integración crean su propia BD en `prisma/test-*.db` con datos ficticios.
- Edición de archivos: el repositorio mezcla finales de línea CRLF y LF; conservar los de cada archivo.

## 7. Estado actual

**Hecho y en producción**: portal (venta, alquiler, amarres, filtros, páginas por población), fichas con compartir y visitas, Busco comprar con coincidencias, Publica gratis, panel, valoración en 5 idiomas, portal en 5 idiomas, SEO técnico.

**Pendiente / limitaciones**
- **Google no indexa la web** hasta poner `ALLOW_INDEXING=true` en Render (decisión del propietario). Antes conviene rellenar los `LEGAL_OWNER_*` (las páginas legales muestran «pendiente»).
- IA (redacción/traducción de anuncios, chat) inactiva sin `ANTHROPIC_API_KEY`; los anuncios se muestran en español con aviso.
- Emails inactivos sin `RESEND_API_KEY`.
- Traducción de las páginas legales: preparada pero sin publicar (pendiente de revisión por abogado). Informe PDF de la valoración solo en español.
- Límite de 10 MB por envío del formulario de publicación.
- Limitador de peticiones en memoria (válido con una sola instancia).
- Población de visitas aproximada (con datos móviles suele salir la ciudad del operador).

**Decisiones a respetar**
- El portal publica solo en Cataluña; la valoración acepta toda España.
- `/busco-piso` se mantiene como URL aunque la sección se llama «Busco comprar».
- Traspasos reutilizan `Listing` (categoría `BUSINESS`) en lugar de una tabla nueva.
- La analítica es propia y anónima (sin cookies de terceros); la IP nunca se guarda.
