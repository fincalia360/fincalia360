# Tramontana · MVP de captación y cualificación de propietarios (Costa Brava)

> Marca ficticia de demostración. Todos los datos (leads, inmobiliarias, campañas, valoraciones) son **ficticios**.

MVP funcional y demostrable, 100 % local, que capta propietarios que quieren vender su vivienda en Roses, Empuriabrava y la Costa Brava, los cualifica con un agente conversacional multilingüe, prioriza con un scoring transparente, intenta convertirlos en cita y entrega la oportunidad a una inmobiliaria colaboradora.

```
VISITANTE → landing → formulario de valoración → lead creado → scoring
→ conversación con agente IA (demo) → intención detectada → lead cualificado
→ cita reservada → asignación a inmobiliaria → CRM / dashboard
```

---

## 1. Qué hace el proyecto

> **Nuevo:** estudio gratuito «¿Te conviene vender o alquilar tu vivienda?» en `/estudio`, con datos oficiales (INE, Catastro, SERPAVI y zonas tensionadas del Ministerio), simulador a 1/3/5/10 años, escenarios de impago, impuestos, análisis de zona, informe PDF y captación integrada en el CRM. Documentación completa: [docs/estudio-vender-alquilar.md](docs/estudio-vender-alquilar.md).

- **Landing pública** en 8 idiomas (ES, CA, EN, FR, DE, NL, IT, PT) con CTA “Quiero valorar mi vivienda”.
- **Formulario de valoración en 6 pasos** (zona, tipo, plazo, situación, datos, contacto) con consentimientos explícitos (ninguno marcado por defecto).
- **Valoración orientativa** inmediata (horquilla de precio DEMO) + opciones: que me contacten / reservar llamada / seguir informándome.
- **Calendario demo** con horarios ficticios y reserva real de cita en la base de datos.
- **Agente conversacional** estilo WhatsApp (`/agent/[leadId]`) que saluda en el idioma del lead, detecta motivación, plazo, urgencia, situación, interés en inmobiliaria y propone/reserva una llamada.
- **Scoring transparente** con explicación de cada punto.
- **Asignación automática** a la inmobiliaria más adecuada (`assignLeadToAgency()`).
- **CRM** (`/admin`): dashboard, leads, ficha de lead, citas, inmobiliarias (CRUD), campañas (simulación), calculadora económica, analytics y configuración.
- **Eventos y notificaciones** (simuladas) con timeline.
- **Simuladores para presentaciones**: “Crear lead demo” y “Simular lead caliente”.

## 2. Qué problema resuelve

Las inmobiliarias de la Costa Brava reciben pocos propietarios “en frío” y tarde; muchos propietarios (sobre todo extranjeros no residentes o con segunda residencia) aún no han decidido vender y no quieren hablar con una agencia de entrada. Este sistema:

1. **Capta** solo a propietarios que lo solicitan voluntariamente (con consentimiento).
2. **Responde al instante** y en su idioma.
3. **Cualifica** (intención, plazo, motivación, situación, valor) y **prioriza** con un score.
4. **Convierte en cita** y **entrega** a la inmobiliaria adecuada una oportunidad ya trabajada.

**No** hace scraping de portales, no extrae teléfonos, no llama ni escribe a nadie que no lo haya pedido.

## 3. Arquitectura

```
captacion-costa-brava/
├── app/                      # Next.js App Router (UI + API routes + server actions)
│   ├── page.tsx              # Landing pública (i18n)
│   ├── valorar/              # Formulario y página de resultado
│   ├── agent/[leadId]/       # Chat con el agente (simulación WhatsApp)
│   ├── admin/                # CRM: dashboard, leads, citas, inmobiliarias, campañas, economía, analytics, configuración
│   │   └── actions.ts        # Server actions del CRM (delegan en /services)
│   ├── api/                  # leads, agent, slots, analytics
│   ├── privacy/ legal/       # Textos legales DEMO
├── components/               # UI (sin lógica de negocio)
├── services/                 # Lógica de negocio
│   ├── leadService.ts        scoringService.ts     valuationService.ts
│   ├── agentService.ts       appointmentService.ts agencyService.ts
│   ├── analyticsService.ts   notificationService.ts dashboardService.ts
│   ├── campaignService.ts    economicsService.ts   settingsService.ts  demoService.ts
│   ├── ai/                   # AIProvider, DemoAIProvider, NLU multilingüe, OpenAIProvider/AnthropicProvider (stubs)
│   ├── notifications/        # NotificationProvider, DemoNotificationProvider, EmailNotificationProvider (stub)
│   └── whatsapp/             # WhatsAppProvider, DemoWhatsAppProvider (TODO: WhatsApp Business API)
├── lib/                      # i18n (8 diccionarios), validación Zod, etiquetas, utilidades, auth (preparada)
├── db/                       # Cliente Prisma + datos demo (seedDemoData.ts)
├── types/                    # Tipos de dominio
├── prisma/                   # schema.prisma + seed.ts
├── tests/                    # Vitest: scoring, agente/NLU, asignación, economía, validación
├── docs/                     # architecture.md, demo.md, roadmap.md, integrations.md
└── scripts/ensure-db.mjs     # Prepara la BD antes de `npm run dev`
```

Más detalle en [docs/architecture.md](docs/architecture.md).

## 4. Stack

- **Next.js 15** (App Router, Server Components, server actions, route handlers) + **React 19**
- **TypeScript** estricto
- **Tailwind CSS 3** (sistema de diseño propio; sin shadcn para no añadir dependencias innecesarias)
- **Prisma 6** + **SQLite** (desarrollo local)
- **Zod** para validación
- **Vitest** para tests
- `lucide-react` (iconos) y `@fontsource` (tipografías locales, sin depender de Google Fonts en tiempo de ejecución)

## 5. Instalación

Requisitos: **Node.js 20+** (probado con Node 24 LTS) y npm.

```bash
cd captacion-costa-brava
npm install
```

`npm install` ejecuta `prisma generate` automáticamente (postinstall).

> npm 11.19+ bloquea los scripts de instalación de dependencias por defecto. El `package.json` ya incluye `allowScripts` para Prisma, esbuild y unrs-resolver, así que no hay que hacer nada más.

## 6. Variables de entorno

Copia `.env.example` a `.env` (el arranque lo hace solo si no existe):

| Variable | Por defecto | Descripción |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite local (`prisma/dev.db`) |
| `AI_PROVIDER` | `demo` | `demo` · `openai` · `anthropic` (los dos últimos son adapters preparados; si fallan, fallback a demo) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | vacío | Solo cuando se implementen los adapters |
| `NOTIFICATION_PROVIDER` | `demo` | `demo` (log + timeline) · `email` (stub) |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `admin` / vacío | Login del panel en `/login`. **Sin contraseña el panel solo funciona en desarrollo; en producción se bloquea** |
| `ADMIN_SESSION_SECRET` | vacío | Clave para firmar la sesión (cadena aleatoria larga) |
| `STUDY_EXAMPLE_DATA` | `false` | Datos de EJEMPLO en el estudio cuando no hay fuente de valor de venta (solo demos) |
| `SERPAVI_DATA_DIR` | `./data/serpavi` | Datos SERPAVI importados |
| `IDEALISTA_API_KEY` / `IDEALISTA_API_SECRET` | vacío | Comparables (requiere acuerdo con Idealista) |

## 7. Cómo ejecutar

```bash
npm run dev
```

Abre <http://localhost:3000>.

`npm run dev` ejecuta antes `scripts/ensure-db.mjs`, que crea `.env` si falta, sincroniza el esquema (`prisma db push`) y **carga los datos demo si la base de datos está vacía**. No hace falta ningún paso manual.

Producción local:

```bash
npm run build
npm start
```

## 8. Cómo ejecutar Prisma

```bash
npx prisma generate      # cliente (lo hace npm install)
npm run db:push          # crea/actualiza prisma/dev.db según schema.prisma
npm run db:studio        # explorador visual de la base de datos
```

## 9. Cómo cargar datos demo

```bash
npm run db:seed          # borra y vuelve a cargar los datos demo
npm run db:reset         # reinicia la BD desde cero + seed
```

También desde la app: **/admin/settings → “Restablecer datos demo”**.

El seed crea 14 leads ficticios (vendedor urgente, alemán, francesa, segunda residencia, vivienda turística, herederos, investigando, a 12 meses, villa, apartamento, lead caliente, lead frío…), 4 inmobiliarias (una en pausa), citas, conversaciones con el agente en varios idiomas, ~200 visitas simuladas y métricas de campañas simuladas.

## 10. URLs disponibles

| URL | Qué es |
|---|---|
| `/` | Landing pública (`?lang=es|ca|en|fr|de|nl|it|pt`) |
| `/valorar` | Formulario de valoración en 6 pasos |
| `/valorar/resultado/[leadId]` | Valoración orientativa + contacto / reserva de llamada |
| `/agent/[leadId]` | Conversación con el agente (simulación WhatsApp) + panel de datos extraídos |
| `/privacy`, `/legal` | Textos legales DEMO |
| `/estudio` | Estudio gratuito vender o alquilar (formulario en 4 pasos) |
| `/estudio/[id]` | Resultados del estudio (privados, solo desde el navegador que lo creó) |
| `/login` | Acceso al panel cuando `ADMIN_PASSWORD` está definido |
| `/admin/studies` | Estudios generados, contactos y exportación CSV |
| `/admin/data-sources` | Estado de fuentes oficiales, zonas tensionadas y referencias de mercado |
| `/admin` | Dashboard |
| `/admin/leads`, `/admin/leads/[id]` | CRM de leads y ficha |
| `/admin/appointments` | Citas |
| `/admin/agencies` | Inmobiliarias (CRUD) |
| `/admin/campaigns` | Simulador de campañas (DEMO) |
| `/admin/economics` | Calculadora económica |
| `/admin/analytics` | Conversiones por evento |
| `/admin/settings` | Hipótesis, reglas de scoring, integraciones, reset demo |

API: `POST /api/leads`, `POST /api/leads/[id]/appointment`, `POST /api/leads/[id]/preference`, `GET|POST /api/agent/[leadId]`, `GET /api/slots`, `POST /api/analytics`.

## 11. Cómo probar el flujo completo

1. Abre `/` y elige **DE** en el selector de idioma.
2. Pulsa **“Ich möchte meine Immobilie bewerten”**.
3. Rellena: Empuriabrava → Villa → Sofort → Zweitwohnsitz → 240 m², 4 dormitorios, piscina → datos de contacto ficticios.
4. Intenta enviar sin marcar el consentimiento: **se bloquea**. Márcalo y envía.
5. Verás la **estimación inicial** y, abajo, el panel “Vista interna · solo demo” con el **score** y su desglose.
6. Pulsa **“Conversación con agente”** y conversa (texto libre o botones).
7. Acepta la llamada y elige un horario → **cita reservada** + **asignación** a inmobiliaria.
8. Ve a `/admin`: el nuevo lead, la cita, la asignación y las métricas aparecen actualizados.

Guion detallado de 5 minutos: [docs/demo.md](docs/demo.md).

## 12. Cómo probar el agente

Abre `/agent/<id>` de cualquier lead (desde la ficha del CRM, botón “Conversación con agente”). Prueba mensajes como:

- ES: *“Quiero vender mi villa en Roses este año porque la heredé”* → detecta tipo, zona, plazo, herencia.
- DE: *“Ja, gerne. Wir ziehen zurück nach Deutschland und möchten schnell verkaufen.”* → motivo *Umzug*, urgencia alta.
- EN: *“About 120 m2 and 3 bedrooms, we'd like 450k”* → superficie, dormitorios, expectativa de precio.
- *“Ahora no”* en la propuesta de cita → pregunta el canal preferido.

El panel derecho muestra en tiempo real `intent`, `timeline`, `motivation`, `property_type`, `location`, `estimated_value`, `language`, `preferred_contact`, `appointment_interest`… El botón ↻ reinicia la conversación.

## 13. Cómo crear un lead demo

En `/admin` o `/admin/leads`:

- **“Crear lead demo”**: crea un lead ficticio aleatorio (idioma, zona, tipo, plazo…).
- **“Simular lead caliente”**: villa con piscina, plazo inmediato, propietario extranjero, conversación con el agente ya completada, score alto y **cita sugerida** pendiente de confirmar (se confirma en `/admin/appointments`).

## 14. Cómo funciona el scoring

Código: `services/scoringService.ts` (funciones puras, testeadas). Cada lead guarda `score`, `scoreTier` y `scoreBreakdown` (explicación JSON).

| Criterio | Puntos |
|---|---|
| Plazo: ahora / 1-3 m / 3-6 m / 6-12 m / más adelante / solo información | 40 / 35 / 25 / 15 / 5 / 0 |
| Valor estimado: ≥ 500k / 300-500k / 150-300k / < 150k | 20 / 15 / 10 / 5 |
| Propiedad: villa / casa / apartamento | 10 / 8 / 5 |
| Situación: turística / herencia / vacía / segunda residencia | 10 / 10 / 8 / 5 |
| Contacto: teléfono / email | 5 / 3 |
| Quiere hablar con un especialista (detectado por agente o formulario) | 5 |

Clasificación: **0-29 LOW · 30-59 MEDIUM · 60-79 HIGH · 80+ HOT**. El score se recalcula cuando el agente descubre información nueva o el propietario pide contacto/cita.

## 15. Qué partes son simuladas

- **Agente IA**: `DemoAIProvider` basado en reglas + estado conversacional (sin LLM).
- **WhatsApp**: interfaz de chat simulada; no se envía nada.
- **Notificaciones** (equipo, inmobiliaria): se registran en el timeline y en consola; no se envían emails.
- **Calendario**: horarios ficticios (hoy tarde / mañana / pasado mañana).
- **Valoración**: precios €/m² de referencia **ficticios** por zona.
- **Campañas** (Google Ads, Meta Ads, SEO, Partners): métricas de simulación, etiquetadas como DEMO.
- **Visitas a la landing** del seed: tráfico simulado para el embudo (las visitas reales también se registran).
- **Inmobiliarias, leads, emails (`@example.com`) y teléfonos**: ficticios.
- **Textos legales**: marcadores de posición, no válidos legalmente.

## 16. Qué integraciones faltan

LLM (OpenAI/Anthropic), WhatsApp Business API, email transaccional, calendario real (Google Calendar / Cal.com), Google Ads API, Meta Marketing API (lead ads), CRM externo / webhooks para inmobiliarias, autenticación real, AVM/valoración con datos de mercado. Guía paso a paso: [docs/integrations.md](docs/integrations.md).

## 17. Roadmap

Resumen (detalle en [docs/roadmap.md](docs/roadmap.md)):

- **MVP (este repo)**: flujo completo local y demostrable.
- **Piloto**: dominio + textos legales revisados, LLM real, WhatsApp Business, email, calendario, campañas reales con presupuesto pequeño, 2-3 inmobiliarias, medir CPL y conversión reales.
- **Producción**: PostgreSQL, auth y roles, portal para inmobiliarias, facturación, observabilidad, RGPD completo.

## 18. Decisiones técnicas

- **Monolito Next.js** (UI + API + server actions): mínimo de piezas para un MVP; los servicios están desacoplados de React y se pueden extraer más adelante.
- **SQLite + Prisma**: cero infraestructura. Los “enums” se guardan como `String` y se tipan en `/types` para migrar a PostgreSQL sin cambios de lógica.
- **Adapters** (`AIProvider`, `NotificationProvider`, `WhatsAppProvider`): las integraciones reales se añaden implementando una interfaz, sin tocar la lógica de negocio. Si un LLM falla, el agente cae automáticamente al proveedor demo.
- **Agente por “slot filling”**: extrae en cada mensaje todo lo que pueda (aunque no se haya preguntado) y solo pregunta lo que falta. Las respuestas por botón llevan un valor estructurado (`PASO:VALOR`) para no depender del NLU.
- **Consentimiento validado en servidor** (Zod: `consentContact` debe ser `true`); el texto aceptado se guarda desde el servidor en el idioma mostrado, con timestamp y versión.
- **Analítica propia** (tabla `Event`), sin cookies ni scripts de terceros.
- **i18n sin librerías**: diccionarios tipados (el español define la forma; si falta una clave en otro idioma, TypeScript falla).
- **Tipografías locales** (`@fontsource`) para que el build no dependa de Google Fonts.
- **Sin shadcn/ui**: componentes propios pequeños para mantener control del estilo “inmobiliario premium”.

## 19. Limitaciones

- Sin autenticación real (solo Basic Auth opcional por variable de entorno).
- El agente demo entiende frases habituales en 8 idiomas, pero no lenguaje libre complejo (para eso, LLM).
- La valoración es orientativa y con precios ficticios; no usa comparables reales.
- Horarios de cita ficticios; sin control de disponibilidad real de especialistas (máx. 2 citas por hueco).
- SQLite no es apto para concurrencia de producción.
- La página de resultado y el chat son accesibles por URL con el id (cuid no adivinable); en producción requieren token firmado.
- El panel “Vista interna · solo demo” de la página de resultado debe eliminarse en producción.

## 20. Próximos pasos para producción

1. Revisar textos legales (privacidad, aviso legal, consentimiento, base jurídica de cesión a inmobiliarias) con un profesional.
2. PostgreSQL gestionado + migraciones (`prisma migrate`).
3. Autenticación y roles (admin, operador, inmobiliaria) y portal para inmobiliarias.
4. Implementar `AnthropicProvider` u `OpenAIProvider` con salida JSON validada por Zod, manteniendo el demo como fallback.
5. WhatsApp Business API (plantillas aprobadas, webhook entrante, ventana de 24 h, opt-out).
6. Email transaccional y calendario real con disponibilidad por inmobiliaria.
7. Integrar Google Ads / Meta lead ads con atribución (UTM/gclid) y conversiones offline.
8. Tokens firmados para enlaces de resultado/chat; rate limiting y protección antispam (honeypot/turnstile) en el formulario.
9. Observabilidad (logs, errores, métricas) y backups.
10. Validar en piloto las hipótesis de CPL (15-25 €) y conversión lead → cita (15-20 %).

---

## Tests y calidad

```bash
npm test            # Vitest (74 tests: scoring, agente, economía, valoración, impuestos, simulador, impagos, zonas tensionadas, PDF, sesiones)
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint (next/core-web-vitals + typescript)
npm run build       # build de producción
```

## Credenciales

En desarrollo (`npm run dev`) el CRM está abierto si no defines contraseña. Para protegerlo (obligatorio en producción, `npm start`): define `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET` en `.env`, reinicia y entra en `/login` con `ADMIN_USER` (por defecto `admin`).
