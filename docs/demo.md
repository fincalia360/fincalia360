# Demo en 5 minutos

**Antes de empezar** (1 min antes de la reunión):

```bash
npm run dev
```

Abre <http://localhost:3000/admin/settings> → **Restablecer datos demo** (deja la base de datos limpia con 14 leads ficticios). Ten dos pestañas: `/` y `/admin`.

> Si haces la demo con `npm run build && npm start`, define antes `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET` en `.env` (en producción el panel exige login en `/login`).

> La primera vez que se abre cada página en modo desarrollo, Next.js la compila (unos segundos). Recorre las páginas una vez antes de la reunión, o usa `npm run build && npm start` para una demo más fluida.

---

### 0:00 — El problema (landing)

1. Abre **`/`**. “Captamos propietarios que *piden* una valoración; nada de scraping ni llamadas en frío.”
2. Selector de idioma → **DE**. Toda la landing cambia a alemán: “Muchos propietarios son no residentes”.

### 0:45 — Captación (formulario)

3. **“Ich möchte meine Immobilie bewerten”**.
4. Empuriabrava → Villa → Sofort → Zweitwohnsitz → 240 m², 4 dormitorios, terraza, piscina → nombre/email/teléfono ficticios, contacto por WhatsApp.
5. Pulsa enviar **sin** consentimiento → bloqueado. Marca el consentimiento (no viene marcado) → enviar.

### 1:45 — Valoración y score

6. Página de resultado: **estimación inicial** + aviso “orientativa”.
7. Panel “Vista interna · solo demo”: **score ~83, Caliente**, con el desglose de puntos (plazo +40, valor +20, villa +10…).

### 2:15 — Agente IA

8. **“Conversación con agente”**. Marina saluda **en alemán** y menciona la villa en Empuriabrava.
9. Escribe: *“Ja, gerne. Wir ziehen zurück nach Deutschland und möchten schnell verkaufen.”*
   - El panel derecho detecta **motivación = cambio de residencia**, **urgencia = alta**, estado → Contactado.
10. Botones: **Ja** (plazo) → **Meerblick** → **Ja** (inmobiliaria). Estado → **Cualificado**, score sube a 88.
11. Marina resume y propone llamada → **“Ja, Termin buchen”** → elige un horario.
12. Confirmación: “Ein Experte von **Canal Blau Properties** wird Sie anrufen” → **asignación automática** (zona Empuriabrava + habla alemán).

### 3:30 — CRM

13. **`/admin`**: el lead nuevo arriba en “Últimos leads”, la cita en “Próximas citas”, métricas y embudo actualizados, “Actividad reciente” con los eventos (LEAD_CREATED → LEAD_QUALIFIED → LEAD_ASSIGNED → APPOINTMENT_BOOKED) y la notificación simulada a la inmobiliaria.
14. Abre la ficha del lead: datos, consentimiento con timestamp y versión, score explicado, conversación, cita y “**Asignado a: Canal Blau Properties**”.

### 4:15 — Negocio

15. **“Simular lead caliente”** (dashboard): crea en segundos otro lead HOT con conversación y cita sugerida.
16. **`/admin/economics`**: 1.000 € de anuncios / CPL 20 € ≈ **50 leads** → 15 % ≈ **7-8 citas**; mueve el precio por cita o el CPL para ver el break-even. “Son hipótesis a validar en el piloto.”
17. (Opcional) `/admin/campaigns` — etiquetado como **SIMULACIÓN**; `/admin/agencies` — reparto por zona/idioma.

### Extra (2 min) — Estudio «vender o alquilar»

Abre `/estudio`, elige Girona → Roses, CP 17480, introduce una referencia catastral para autocompletar superficie y año, añade precio y año de compra y genera el estudio: valor (IPV), alquiler oficial (SERPAVI), zona tensionada (Ministerio), simulador editable, impagos, impuestos, zona e informe PDF. Termina con «Solicitar valoración profesional» y enséñalo en `/admin/studies` y como lead en el CRM.

### 5:00 — Cierre

“Todo esto funciona en local sin APIs externas. El agente, WhatsApp, email, calendario y Ads están preparados como adapters para conectarlos en el piloto.”
