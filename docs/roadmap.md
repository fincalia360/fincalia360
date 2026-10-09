# Roadmap

## MVP (este repositorio) ✅

Objetivo: demostrar que el flujo comercial funciona de principio a fin, en local.

- Landing + formulario en 8 idiomas, consentimiento con versión y timestamp.
- Valoración orientativa (precios demo) y reserva de llamada en calendario demo.
- Agente conversacional por reglas (8 idiomas) con extracción de datos estructurados.
- Scoring transparente, estados de lead, próxima acción.
- Asignación automática a inmobiliarias, eventos y notificaciones simuladas.
- CRM: dashboard, leads, ficha, citas, inmobiliarias, campañas (simulación), economía, analytics, configuración.
- Seed de datos ficticios, simuladores para presentaciones, tests.

## Piloto (≈ 6-10 semanas)

Objetivo: validar con dinero real las hipótesis de CPL (15-25 €) y conversión lead → cita (15-20 %) con 2-3 inmobiliarias de Roses/Empuriabrava.

- **Legal**: textos de privacidad, aviso legal y consentimiento revisados; base jurídica para compartir el lead con la inmobiliaria; registro de actividades; contrato con inmobiliarias.
- **Infra mínima**: dominio, hosting (Vercel/Render/Fly), PostgreSQL gestionado, backups, `prisma migrate`.
- **Seguridad**: autenticación real del CRM, tokens firmados en enlaces de resultado/chat, rate limiting y antispam en el formulario.
- **Agente**: `AnthropicProvider` u `OpenAIProvider` con salida JSON validada; el demo como fallback; revisión humana de conversaciones.
- **Canales**: WhatsApp Business API (plantillas aprobadas para el primer mensaje), email transaccional, recordatorios de cita.
- **Calendario real** por inmobiliaria (Google Calendar / Cal.com).
- **Captación**: campañas pequeñas en Google Ads (búsqueda “vender casa Roses/Empuriabrava” en varios idiomas) y Meta lead ads para no residentes; UTMs y atribución por lead.
- **Medición**: CPL real, % cualificados, % citas, % oportunidades aceptadas por la inmobiliaria, tiempo de primera respuesta.
- **Valoración**: sustituir precios demo por comparables o un AVM con datos reales.
- Eliminar el panel “Vista interna · solo demo” de la página pública.

## Producción

Objetivo: operar de forma recurrente y escalar a más zonas.

- Portal para inmobiliarias (aceptar/rechazar oportunidad, feedback, estado del mandato).
- Roles y permisos (admin, operador, inmobiliaria), auditoría.
- Facturación (cuota mensual / precio por cita) y conciliación.
- Integración con CRMs inmobiliarios (Inmovilla, Witei, etc.) vía API/webhooks.
- Conversiones offline hacia Google/Meta (cita realizada, mandato firmado).
- Nurturing automatizado para leads “más adelante / solo información” (con consentimiento de marketing).
- Observabilidad (errores, métricas, alertas), pruebas end-to-end, CI/CD.
- RGPD completo: ejercicio de derechos, retención y borrado automático, DPA con proveedores.
- Multi-zona (Costa Brava sur, Maresme…) y multi-equipo.
