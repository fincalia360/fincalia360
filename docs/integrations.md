# Integraciones (cómo conectarlas después)

Todas las integraciones externas están detrás de una interfaz. El MVP usa implementaciones DEMO; para conectar un servicio real se implementa el adapter y se activa por variable de entorno, **sin tocar la lógica de negocio**.

## OpenAI / Anthropic (agente conversacional)

- Interfaz: `services/ai/types.ts` → `AIProvider.generateReply(input): Promise<AgentTurnOutput>`.
- Stubs: `services/ai/openaiProvider.ts`, `services/ai/anthropicProvider.ts`. Prompt base: `services/ai/prompt.ts`.
- Selección: `AI_PROVIDER=openai|anthropic` (+ `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`). `getAIProvider()` hace **fallback automático** a `DemoAIProvider` si el LLM falla.

Pasos:
1. `npm install @anthropic-ai/sdk` (o `openai`).
2. En `generateReply`, enviar `buildSystemPrompt(input)` + historial; pedir salida JSON (o *tool use* con un esquema).
3. Validar la respuesta con Zod contra `AgentTurnOutput` (valores de `extracted` limitados a los enums de `/types`).
4. Mantener las respuestas por botón (`PASO:VALOR`) para no depender del modelo en decisiones estructuradas.
5. Registrar coste/latencia por turno y revisar conversaciones en el CRM.

## WhatsApp Business

- Interfaz: `services/whatsapp/types.ts` → `WhatsAppProvider` (`sendMessage`, `parseWebhook`). Demo: `DemoWhatsAppProvider`. Marcado como `TODO: integrate WhatsApp Business API`.

Pasos:
1. Cuenta de WhatsApp Business Platform (Cloud API de Meta) o un BSP (Twilio, 360dialog).
2. Plantillas aprobadas para el **primer mensaje** (fuera de la ventana de 24 h) en cada idioma, siempre con consentimiento previo.
3. Route handler `app/api/whatsapp/webhook/route.ts`: verificar firma, `parseWebhook()` → buscar lead por teléfono → `agentService.sendMessage()` → responder con `sendMessage()`.
4. Gestionar opt-out (“STOP”/“BAJA”) y guardar el canal en la conversación (`channel = WHATSAPP`).

## Email

- Interfaz: `services/notifications/types.ts` → `NotificationProvider`. Stub: `EmailNotificationProvider`. Selección: `NOTIFICATION_PROVIDER=email`.
- Implementar con Resend, SendGrid, Amazon SES o SMTP (nodemailer). Plantillas por idioma para el propietario y en español para la inmobiliaria/equipo.
- Los eventos ya generan el mensaje (`audience`, `to`, `subject`, `body`) en `notificationService.emitBusinessEvent()`.

## Calendario

- Hoy: `appointmentService.getAvailableSlots()` devuelve horarios ficticios; `bookAppointment()` guarda la cita.
- Conectar Google Calendar (API con cuenta de servicio por inmobiliaria) o Cal.com (API de disponibilidad + reservas):
  1. `getAvailableSlots(agencyId)` → consultar disponibilidad real (free/busy).
  2. `bookAppointment()` → crear el evento y guardar el `externalId` en `Appointment` (añadir columna).
  3. Webhook de cancelación/reprogramación → `updateAppointmentStatus()`.

## Google Ads

- Hoy: `Campaign` con métricas de simulación (`isDemo = true`) y leads atribuidos por `Lead.source`.
- Pasos: capturar `utm_*` y `gclid` en la landing y guardarlos en el lead; job diario con la Google Ads API para importar impresiones/clicks/coste por campaña; subir **conversiones offline** (lead cualificado, cita realizada) con el `gclid`.

## Meta Ads

- Lead ads: webhook `leadgen` → descargar el lead con la Graph API → `leadService.createLead()` (con el consentimiento recogido en el formulario de Meta, guardando su texto y versión).
- Métricas: Marketing API (insights por campaña) → tabla `Campaign`. Conversions API para eventos de cita.

## CRM externo / inmobiliarias

- Punto de integración natural: evento `LEAD_ASSIGNED` en `agencyService.assignLeadToAgency()`.
- Opciones: webhook firmado por inmobiliaria (añadir `webhookUrl` a `Agency`), API de su CRM (Inmovilla, Witei, Salesforce, HubSpot…), o email estructurado.
- Recibir el feedback (aceptada, visita realizada, mandato firmado) para marcar `CONVERTED` automáticamente.

## Autenticación

- `lib/auth.ts` (`getCurrentUser`, `requireAdmin`) ya se usa en todas las server actions del CRM.
- Hoy: login con `ADMIN_USER`/`ADMIN_PASSWORD` y sesión firmada (`ADMIN_SESSION_SECRET`). Para varios usuarios y roles: Auth.js, Clerk o SSO, manteniendo `requireAdmin()`.

## Fuentes de datos del estudio vender / alquilar

INE, Catastro, SERPAVI y zonas tensionadas ya funcionan sin claves. Idealista requiere solicitar acceso; Fotocasa Research, estadística notarial o de registradores requieren acuerdo y pueden cargarse como «Referencias de mercado» en `/admin/data-sources`. Detalle en [estudio-vender-alquilar.md](estudio-vender-alquilar.md).
