# Arquitectura

Monolito **Next.js 15 (App Router)** con la lógica de negocio aislada en `/services`. Las páginas y componentes solo presentan datos; las mutaciones pasan por **route handlers** (`/app/api`, usados por el público y el chat) o **server actions** (`/app/admin/actions.ts`, usadas por el CRM), y ambos delegan en servicios.

```
 Navegador ──► app/ (páginas RSC + componentes cliente)
                 │
                 ├── app/api/*            (público: leads, agente, slots, analytics)
                 └── app/admin/actions.ts (CRM: estados, citas, agencias, ajustes, simuladores)
                          │
                          ▼
                     services/*  ──►  db/client.ts (Prisma) ──► SQLite (prisma/dev.db)
                          │
                          ├── services/ai/            AIProvider  ──► DemoAIProvider | OpenAI* | Anthropic*
                          ├── services/notifications/ NotificationProvider ──► Demo | Email*
                          └── services/whatsapp/      WhatsAppProvider ──► Demo   (* = stub preparado)
```

## Módulos

| Módulo | Responsabilidad |
|---|---|
| `leadService` | Crear lead desde el formulario (valoración + score + consentimiento + eventos), recalcular score, cambios de estado (NEW → CONTACTED → QUALIFIED → APPOINTMENT → CONVERTED / LOST), notas, preferencia de contacto, “próxima acción”. |
| `scoringService` | Reglas de scoring puras y transparentes (`calculateScore`, `tierFor`, `intentFromTimeline`). |
| `valuationService` | Valoración orientativa DEMO (€/m² ficticio por zona × factores de tipo, extras y estado → horquilla ±6 %). |
| `agentService` | Orquesta la conversación: persiste mensajes, llama al `AIProvider`, aplica los datos extraídos al lead y a la propiedad, recalcula score, cualifica, muestra horarios y reserva cita desde el chat. |
| `ai/` | `AIProvider` (interfaz), `DemoAIProvider` (reglas + estado), `nlu.ts` (detección multilingüe por palabras clave), `prompt.ts` (prompt para futuros LLM), `OpenAIProvider`/`AnthropicProvider` (stubs) y `getAIProvider()` con fallback. |
| `appointmentService` | Huecos de calendario DEMO, reserva (asigna inmobiliaria, cambia estado, emite eventos), citas desde CRM, cambio de estado de citas. |
| `agencyService` | CRUD de inmobiliarias, `rankAgencies()` (puro) y `assignLeadToAgency()`. |
| `analyticsService` | Registro de eventos de funnel (`landing_view` … `appointment_booked`), embudo, series por día. |
| `notificationService` | Eventos de negocio (`LEAD_CREATED`, `LEAD_QUALIFIED`, `APPOINTMENT_BOOKED`, `LEAD_ASSIGNED`, `LEAD_CONVERTED`…) → tabla `Event` + `NotificationProvider`. |
| `dashboardService` | Métricas del dashboard calculadas en BD. |
| `campaignService` | Informe de campañas (datos de simulación) + leads reales atribuidos por origen. |
| `economicsService` | Calculadora económica pura (leads, citas, costes, ingresos, margen, break-even). |
| `settingsService` | Hipótesis configurables (CPL, conversiones, precios). |
| `demoService` | Simuladores “Crear lead demo” y “Simular lead caliente”. |

## Modelo de datos (`prisma/schema.prisma`)

- **Lead**: contacto, idioma, origen, estado, plazo, situación, intención, motivación, urgencia, interés en inmobiliaria/cita, valor estimado (+horquilla), score, tier, desglose, próxima acción, asignación.
- **Property** (1:1): ubicación, tipo, m², dormitorios, baños, terraza, piscina, parking, estado.
- **Consent** (1:1): `consentContact`, `consentMarketing`, `consentTimestamp`, `consentVersion`, texto exacto aceptado e idioma.
- **Agency**: zonas, idiomas, tipos (CSV), estado ACTIVE/PAUSED, cuota mensual, precio por cita.
- **Appointment**: fecha, canal, estado (REQUESTED/BOOKED/COMPLETED/CANCELLED), origen, inmobiliaria.
- **Conversation** + **ConversationMessage**: estado del agente (JSON), datos extraídos (JSON), mensajes con metadatos (botones, acción).
- **Event**: categoría BUSINESS (timeline/notificaciones) o ANALYTICS (funnel).
- **Campaign**: métricas de simulación por canal.
- **Note**, **Setting**.

## Agente demo (cómo razona)

1. **Extracción oportunista**: en cada mensaje busca zona, tipo, plazo (incl. “3 meses”, “este año”…), situación, motivación, urgencia, m², dormitorios, precio, canal y puntos fuertes, en 8 idiomas. Solo rellena huecos vacíos (no pisa datos del formulario con detecciones ambiguas).
2. **Interpretación del paso pendiente** (`CONFIRM_INTEREST`, `LOCATION`, `PROPERTY_TYPE`, `MOTIVATION`, `TIMELINE`, `SITUATION`, `DETAILS`/`FEATURES`, `AGENCY_INTEREST`, `OFFER_APPOINTMENT`, `SLOTS`, `PREFERRED_CONTACT`). Los botones envían un valor estructurado (`TIMELINE:NOW`, `BOOK:YES`…).
3. **Siguiente pregunta**: la primera información que falte. Si no entiende, reformula una vez y después avanza.
4. **Respuesta** en el idioma del lead con un reconocimiento empático cuando procede (herencia, traslado, urgencia).

Sustituirlo por un LLM: implementar `AIProvider.generateReply()` devolviendo la misma estructura (`reply`, `quickReplies`, `action`, `nextState`, `extracted`). `agentService` no cambia.

## Asignación de leads (`assignLeadToAgency`)

Solo agencias `ACTIVE`. Puntuación: zona exacta +4 (o +1 si cubre “toda la Costa Brava”), tipo de propiedad +2, idioma del propietario +2. Desempate: la agencia con menos leads recibidos. Se ejecuta automáticamente al reservar (o sugerir) una cita, o manualmente desde la ficha del lead.

## Seguridad y privacidad (estado MVP)

- Validación Zod en todas las entradas públicas; el consentimiento de contacto es obligatorio en servidor.
- Analytics sin terceros; el endpoint público solo acepta eventos de navegación.
- `middleware.ts` + `lib/session.ts`: login en `/login` y sesión firmada (HMAC-SHA256) para `/admin` y `/api/admin` cuando `ADMIN_PASSWORD` está definido; sin contraseña, acceso solo en desarrollo. `lib/auth.ts` → `requireAdmin()` en todas las server actions.

## Estudio vender / alquilar

Módulo `services/study/` (detalle en [estudio-vender-alquilar.md](estudio-vender-alquilar.md)):

| Archivo | Responsabilidad |
|---|---|
| `types.ts` | Esquema Zod del formulario, procedencia de datos (oficial, propietario, mercado, modelo, hipótesis, ejemplo), tipos del snapshot |
| `sources/ine.ts`, `catastro.ts`, `serpavi.ts`, `tensionedAreas.ts`, `idealista.ts`, `http.ts` | Adaptadores de fuentes con caché y fechas |
| `valuation.ts` | Estimaciones de venta y alquiler con prioridad de fuentes, confianza y limitaciones |
| `simulator.ts`, `taxes.ts`, `risk.ts`, `recommendations.ts`, `assumptions.ts` | Cálculos puros (se ejecutan también en el navegador) |
| `studyService.ts` | Orquestación, acceso privado, integración con el CRM |
| `report/pdf.ts` | Informe PDF (pdf-lib) |
| `adminStudyService.ts` | Panel y exportación CSV |
