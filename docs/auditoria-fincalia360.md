# FINCALIA360 · Auditoría del proyecto actual y plan de trabajo

Fecha: 9 de octubre de 2026 · Proyecto auditado: `captacion-costa-brava` (marca visible «Tramontana»)
Estado: **diagnóstico y propuesta. No se ha modificado código para esta auditoría.** Pendiente de aprobación.

---

## 0. Resumen ejecutivo

- El proyecto tiene **dos productos dentro**:
  1. **Estudio «vender o alquilar»** (`/estudio`). Es la base sólida de FINCALIA360. Usa datos oficiales reales (INE, Catastro, MIVAU, SERPAVI), trata los datos ausentes como desconocidos (nunca 0 €), tiene un simulador auditado, impuestos con estado de cálculo, un PDF coherente con la web y 110 tests en verde.
  2. **Captación original** (`/valorar` + CRM, agente IA, campañas, citas). Funciona como **demo**, pero **su valoración usa precios €/m² ficticios** y tiene problemas de privacidad que **impiden usarla con propietarios reales tal como está**.
- **Bloqueantes para el lanzamiento** (sección 6A):
  1. La valoración ficticia de `/valorar` se muestra como estimación y, si falta, como «0 €».
  2. Las páginas de resultados de leads son accesibles solo con el ID, sin token, y muestran un panel interno de puntuación.
  3. Los textos legales son plantillas con datos «PENDIENTE».
  4. La base de datos es SQLite local, sin copias de seguridad ni despliegue.
  5. No existe envío de correos.
  6. El límite legal de la renta no contempla todavía el índice de referencia ni las reglas específicas aplicables en Cataluña.
  7. El proyecto no está bajo control de versiones (git): no hay forma de deshacer cambios antes de un rediseño grande.
- **El logotipo**: el archivo adjunto es una **lámina de presentación JPEG de 960 × 960 px** (`Imagine - Grok_files/27c01e88-…jpg`), no un archivo de logotipo independiente. Los colores medidos no coinciden exactamente con los rotulados (ver §3). **Necesito tu decisión** antes de usarlo.

---

## 1. Inventario técnico (verificado leyendo el código)

| Área | Tecnología | Observaciones |
|---|---|---|
| Frontend y backend | Next.js 15.5 (App Router), React 19, TypeScript, Tailwind 3 | Un único proyecto: páginas y API (`app/api/*`) en el mismo servidor. |
| Base de datos | Prisma 6 + **SQLite** (`prisma/dev.db`) | 13 modelos: Lead, Property, Consent, Agency, Appointment, Conversation, Event, Campaign, Study, caché oficial… Persiste entre reinicios **en local**. No es apto para hosting sin disco persistente (p. ej. Vercel). |
| Validación | Zod en todas las rutas públicas | Correcto. |
| PDF | pdf-lib con fuentes estándar (Helvetica) | Sin servicios externos. |
| Fuentes tipográficas | Inter + Cormorant Garamond (autoalojadas con @fontsource) | Cormorant no encaja con la nueva identidad. |
| Autenticación del panel | Usuario y contraseña únicos por variables de entorno + sesión HMAC firmada (`lib/session.ts`, `middleware.ts`) | En producción sin contraseña el panel se bloquea (503). Sin usuarios ni roles individuales. |
| Límite de peticiones | En memoria (`lib/rateLimit.ts`) | Se pierde al reiniciar y no funciona con varias instancias. **No se aplica a `/api/leads` ni a `/api/agent`.** |
| Dependencias | 9 de producción, sin servicios de pago | `npm audit`: 5 avisos (4 altos, 1 moderado) en `postcss` (dentro de Next) y `deepmerge-ts` (CLI de Prisma). Afectan sobre todo a la compilación; la corrección exige cambios de versión mayor (Next 16 / Prisma 6.12+), que hay que probar. |
| Control de versiones | **No hay repositorio git** | Riesgo alto antes de un rediseño. |
| Tests | Vitest, 110 tests, 7 ficheros | En verde el 9-10-2026 (agente, scoring, negocio, estudio, simulador, impuestos, PDF). Sin tests de extremo a extremo en navegador. |

---

## 2. Estado real de cada funcionalidad

Leyenda de evidencia: **[T]** test automático · **[N]** comprobado en navegador en esta sesión · **[S]** comprobado en una sesión anterior · **[C]** solo lectura de código.

### 2.1 Estudio «vender o alquilar» (`/estudio`)

| Componente | Estado | Evidencia y comentario |
|---|---|---|
| Formulario por pasos | FUNCIONAL CON LIMITACIONES | [S][C] Valida en cliente y en servidor (Zod, código postal coherente con la provincia, importes ≥ 0). Pide la dirección, pero **solo como texto libre opcional**. No guarda el progreso. |
| Identificación por referencia catastral | FUNCIONAL CON LIMITACIONES | [S][C] Consulta los datos no protegidos del Catastro (uso, superficie, año) y muestra errores comprensibles (400/503). **No identifica por dirección** (no hay búsqueda de calle o número) y no guarda que la vivienda «quedó identificada». |
| Zona tensionada | FUNCIONAL CON LIMITACIONES | [T] Lee la página oficial del MIVAU con vigencia y resolución (Roses: 10-10-2024 a 10-10-2027). Las declaraciones **parciales** no se geolocalizan: se avisa de que hay que comprobar la dirección. |
| Alquiler estadístico (SERPAVI) | FUNCIONAL CON LIMITACIONES | [T] Datos municipales importados de un xlsx oficial. No usa la sección censal. |
| Alquiler máximo legal | FUNCIONAL CON LIMITACIONES | [T] Aplica la renta anterior (art. 17.6 LAU) y marca el índice para grandes tenedores como no calculable. **Faltan**: el índice de referencia, el caso sin contrato en 5 años (fuentes secundarias indican que entonces se aplica el índice en Cataluña), las excepciones de +10 %, la actualización de la renta anterior, la duración y finalidad del contrato y el umbral de gran tenedor según la declaración. Las fuentes secundarias consultadas discrepan: hay que verificarlo en BOE/DOGC. |
| Valor de venta | FUNCIONAL CON LIMITACIONES | [T][N] Solo hay valor si existe tasación o valor del propietario, precio de compra × IPV, referencias cargadas por el equipo o comparables autorizados. Si no, se muestra «No es posible valorar» (nunca 0 €). **No hay ninguna fuente pública de precios de compraventa conectada.** |
| Simulador A/B/C a 1/3/5/10 años | FUNCIONAL Y VERIFICADO | [T][N] Casos de referencia calculados a mano, sensibilidad, flujo de caja y patrimonio separados. Depende de las hipótesis indicadas. |
| Fiscalidad | FUNCIONAL CON LIMITACIONES | [T] IRPF/IRNR de la ganancia, plusvalía, impuestos del alquiler, reducciones condicionadas, amortización e imputación. No calcula territorios forales, coeficientes de abatimiento ni compensación de pérdidas. Coeficientes y tipos de plusvalía genéricos, no de cada ordenanza. |
| Impago y ocupación | FUNCIONAL Y VERIFICADO | [T] Escenarios a 3/6/12 meses con hipótesis editables; sin probabilidades ni plazos inventados. |
| PDF del estudio | FUNCIONAL Y VERIFICADO | [T][N] Un test compara las cifras de la primera página con el modelo. Marca «Tramontana». El diseño se lee en móvil como un PDF A4 (sin versión adaptada). |
| Acceso al estudio | FUNCIONAL Y VERIFICADO | [T] Token aleatorio guardado como hash en una cookie: solo lo ve el navegador que lo creó. **No hay forma de recuperarlo desde otro dispositivo** (no se envía enlace por correo). |
| Solicitud de valoración profesional → CRM | FUNCIONAL CON LIMITACIONES | [T][S] Consentimiento obligatorio y consentimiento comercial opcional. **No se envía ningún aviso por correo al equipo ni al propietario.** |

### 2.2 Captación original y CRM

| Componente | Estado | Evidencia y comentario |
|---|---|---|
| Landing en 8 idiomas | FUNCIONAL CON LIMITACIONES | [S] Marca «Tramontana» y textos de demo. |
| Formulario `/valorar` | FUNCIONAL CON LIMITACIONES | [S][C] Guarda lead, inmueble y consentimientos. `/api/leads` **sin límite de peticiones ni protección antispam**. |
| Valoración de `/valorar` | **SIMULADO O CON DATOS DE EJEMPLO** | [C] `services/valuationService.ts`: «Precios €/m² ficticios de referencia por zona — NO son datos de mercado reales» (Roses 3.200 €/m², Cadaqués 5.200…). Se muestran al propietario como «estimación». Si no existe estimación, la página muestra `formatEstimate(… ?? 0)` → **0 €**. |
| Página de resultado del lead | **RIESGO DE PRIVACIDAD** | [C] `/valorar/resultado/[leadId]` y `/api/agent/[leadId]`, `/api/leads/[id]/*` se acceden **solo con el ID del lead, sin token**. La página muestra siempre el panel «Vista interna · solo demo» con la puntuación del lead, aunque el texto diga que «el propietario no lo ve en producción» (no hay ninguna condición en el código). |
| Puntuación de leads | FUNCIONAL Y VERIFICADO | [T] Reglas deterministas. |
| Agente conversacional | SIMULADO | [T] Proveedor de reglas `demo`. Los adaptadores de OpenAI y Anthropic están preparados pero no verificados con claves reales. |
| Citas y agenda | FUNCIONAL CON LIMITACIONES | [S] Huecos generados localmente, sin calendario real ni confirmación por correo. |
| Notificaciones (correo/WhatsApp) | NO IMPLEMENTADO | [C] `EmailNotificationProvider` lanza «no está configurado». WhatsApp es un stub. |
| Campañas | SIMULADO | [S] Marcadas como DEMO. |
| Panel admin (dashboard, leads, estudios, inmobiliarias, economía, analítica, ajustes) | FUNCIONAL CON LIMITACIONES | [S][T] Login con sesión firmada, exportación CSV protegida contra inyección. Un solo usuario compartido, sin registro de quién hizo qué. |
| Analítica propia | FUNCIONAL CON LIMITACIONES | [C] Eventos en la base de datos propia, con identificador en `sessionStorage` (sin terceros ni cookies). Aun así, conviene informarlo en la política de cookies. |
| Textos legales | INCOMPLETO | [C] `/privacy` y `/legal` con «(demo)», «[Razón social, NIF… — PENDIENTE]», «[Plazos de conservación — PENDIENTE]» y «Tramontana es una marca ficticia». |
| Derechos RGPD (acceso, supresión) y conservación | NO IMPLEMENTADO | [C] No hay rutas ni procesos para exportar o borrar los datos de un propietario ni para purgar datos antiguos. |
| Copias de seguridad y registro de errores | NO IMPLEMENTADO | [C] Solo `console.log`. |
| Despliegue, dominio, HTTPS | NO IMPLEMENTADO | Solo funciona en local. |

---

## 3. Logotipo e identidad: lo que he encontrado

**Archivo**: `C:\Users\Youca\Desktop\Imagine - Grok_files\27c01e88-8ad0-4bb0-97a1-87c239023d47.jpg` (es la misma imagen incrustada en `Imagine - Grok.html`). Lámina de 960 × 960 px con el logotipo principal, una versión sobre fondo azul, el símbolo, el icono para favicon, una versión pequeña, una monocroma y la paleta.

La otra imagen de la carpeta (`921e0ee6-….jpg`) muestra tres propuestas con otros nombres (Hábitat, Nexo, Lumen). **No la usaré.**

**Problemas para usarla tal cual:**
1. **Es una imagen rasterizada JPEG, no un archivo de logotipo**: no tiene fondo transparente (fondo blanco roto) y tiene artefactos de compresión. El logotipo principal mide unos 800 px de ancho. En cabeceras y PDF se vería con un recuadro de fondo o borroso al ampliarse.
2. **Los colores medidos no coinciden con los rotulados en la propia lámina:**

   | Color | Rotulado | Medido en la imagen |
   |---|---|---|
   | Azul | #142B45 | ≈ #02254F (más azul y saturado) |
   | Verde | #238477 | ≈ #058576 |

3. No hay versión SVG ni PNG transparente en el proyecto.

**Opciones (elige una):**
- **A (recomendada)**: me facilitas el logotipo como **SVG** o **PNG transparente de al menos 1.000 px** (puedes pedírselo a la misma herramienta o a un diseñador) y lo colocas en `captacion-costa-brava/public/brand/`.
- **B**: recorto de la lámina las piezas existentes (logotipo horizontal, versión sobre azul, símbolo y favicon) **sin redibujarlas** y elimino el fondo claro. La calidad será limitada; sirve como solución provisional.
- **C**: creo una versión vectorial fiel. Implica **redibujarlo**, y me pediste no hacerlo sin autorización.

**Colores**: propongo usar los valores **rotulados** (#142B45 y #238477) como referencia oficial, porque son los que fijaste en el encargo, y comprobar que el logotipo convive con ellos. Si prefieres los colores medidos en la imagen, también se puede.

---

## 4. Requisitos legales y regulatorios (información general, no asesoramiento)

- **Protección de datos (RGPD/LOPDGDD)**: falta el responsable real (razón social, NIF, domicilio, contacto), la base jurídica de cada tratamiento, los plazos de conservación, los encargados de tratamiento (hosting, correo), el ejercicio de derechos y el registro de actividades. Si se comparten datos con inmobiliarias colaboradoras, hace falta informarlo con claridad y firmar contratos de encargo o cesión.
- **LSSI**: el aviso legal requiere los datos del titular. Las comunicaciones comerciales necesitan consentimiento previo (ya separado del de contacto).
- **Cookies**: hoy no se usan cookies de analítica de terceros. Hay cookies técnicas (idioma, acceso al estudio, sesión del panel). Basta con una política de cookies informativa, sin banner de consentimiento, mientras no se añadan herramientas de terceros.
- **Alquiler máximo legal**: la normativa catalana y estatal ha cambiado varias veces (Ley 12/2023, declaraciones de zona, decretos posteriores). Las fuentes secundarias consultadas discrepan en puntos clave: si para un pequeño propietario prevalece la renta anterior o el mínimo entre esta y el índice, y el umbral de gran tenedor. **Antes de mostrar un «alquiler máximo legal» como resultado, hay que validar las reglas con el BOE y el DOGC consolidados y, preferiblemente, con un abogado.**
- **Índice de referencia**: no he encontrado una API pública documentada que devuelva el índice de una vivienda concreta. La consulta oficial se hace en la aplicación web del Ministerio. Propuesta: introducción manual del rango oficial (con captura o fecha de consulta) hasta confirmar si existen datos descargables por sección censal.

Fuentes consultadas (secundarias, pendientes de contrastar con BOE y DOGC): [Idealista, may. 2025](https://www.idealista.com/news/inmobiliario/vivienda/2025/05/20/844942-alquiler-en-zonas-tensionadas-en-cataluna-fijacion-de-precio-propietario-e) · [Trioteca 2025](https://blog.trioteca.com/alquiler-cataluna-ley-vivienda-2025/) · [Fotocasa](https://www.fotocasa.es/fotocasa-life/alquiler/limite-del-precio-del-alquiler-en-cataluna/) · [Sandín Abogados 2026](https://sandinabogados.com/regulacion-de-alquileres-en-cataluna-guia-completa-2026/) · [Vivara: SERPAVI](https://www.vivara.io/blog/legal/serpavi-alquiler-zonas-tensionadas/)

---

## 5. Cambio de marca: dónde aparece «Tramontana»

**51 líneas en 24 ficheros** (incluida la documentación):

- **Visibles para el usuario (migrar a FINCALIA360)**: diccionarios de los 8 idiomas (4 por idioma), cabecera, pie, logotipo, `app/layout.tsx` (títulos y metadatos), panel admin, aviso legal, PDF (3), formulario de contacto, texto del consentimiento (`studyService.ts`), prompt del agente y chat.
- **Identificadores técnicos (cambiar con cuidado)**:
  - `tramontana_session` (sessionStorage): se puede renombrar; solo reinicia la sesión de analítica.
  - User-Agent de las consultas oficiales: se puede cambiar, y conviene poner un contacto real.
  - `equipo@tramontana.demo`: sustituir por el correo real.
  - Nombre del paquete `captacion-costa-brava`: no es necesario cambiarlo.
- **Datos existentes**: los consentimientos ya guardados mencionan «Tramontana» en su texto. **No se modifican** (son prueba del consentimiento otorgado). Los nuevos usarán FINCALIA360.
- **Ámbito geográfico**: la marca y los textos hablan de la «Costa Brava». FINCALIA360 se plantea como plataforma general, mientras que el CRM original solo conoce 7 municipios del Empordà. Hay que decidir si el lanzamiento es solo para la Costa Brava o para toda España (el estudio ya funciona para toda España).

---

## 6. Plan de trabajo

Horas orientativas de desarrollo; no incluyen revisión legal externa ni tiempos de espera de proveedores.

### A. IMPRESCINDIBLE ANTES DEL LANZAMIENTO

| # | Problema detectado | Evidencia | Solución propuesta | Prioridad | Dependencias | Horas | Gastos potenciales | Criterio de terminado |
|---|---|---|---|---|---|---|---|---|
| A1 | Sin control de versiones | `git status` → «not a git repository» | `git init`, `.gitignore` (excluir `.env`, `dev.db`, `data/` sensibles) y primer commit antes de tocar nada | Crítica | — | 0,5 | 0 € | Hay un historial y se puede volver al estado actual |
| A2 | Valoración ficticia en `/valorar` presentada como estimación; 0 € si falta | `valuationService.ts` (DEMO_PRICE_PER_SQM), `resultado/[leadId]/page.tsx` (`?? 0`) | Redirigir `/valorar` al estudio o reutilizar el motor del estudio; sin fuente fiable, «no valorable». Retirar los precios ficticios del flujo público | Crítica | Decisión de producto (unificar en un solo formulario) | 6–10 | 0 € | Ningún camino público muestra precios ficticios ni 0 €; tests |
| A3 | Resultados de leads accesibles por ID y panel interno visible | Rutas `/valorar/resultado/[leadId]`, `/api/agent/[leadId]`, `/api/leads/[id]/*` sin token; panel «solo demo» sin condición | Token de acceso como en el estudio (cookie + hash); eliminar el panel interno de la vista pública (mostrarlo solo en `/admin`) | Crítica | A2 | 4–6 | 0 € | Un ID sin token devuelve 404; test de permisos |
| A4 | Antispam y límites incompletos | `/api/leads` y `/api/agent` sin `rateLimit`; límite en memoria | Límite en todas las rutas públicas, campo trampa (honeypot) y tiempo mínimo de envío; límite persistente si hay varias instancias | Alta | A7 (si es en base de datos) | 3–4 | 0 € (CAPTCHA opcional: Cloudflare Turnstile, gratuito) | Tests de 429 y de honeypot |
| A5 | Alquiler máximo legal incompleto en zona tensionada (Cataluña) | `rentRegime.ts`: sin índice ni caso «sin contrato en 5 años», sin excepciones ni actualización; fuentes discrepantes | 1) Verificar las reglas con BOE/DOGC (y abogado). 2) Implementar el árbol de decisión validado, con fecha de la norma. 3) Introducción manual del rango del índice oficial con fecha de consulta y enlace. 4) Preguntas nuevas: duración y finalidad del contrato, excepciones | Crítica | Validación legal | 12–20 + revisión legal | Abogado (opcional, a presupuestar) | Tests por supuesto legal; ningún «límite legal» sin datos verificados |
| A6 | Identificación del inmueble | Dirección en texto libre; Catastro solo por RC | Búsqueda por dirección con los servicios oficiales del Catastro (provincia, municipio, vía, número → RC); estado «identificada / no identificada» visible en el estudio y el PDF | Alta | Verificar condiciones de uso del servicio del Catastro | 8–12 | 0 € (servicio público; comprobar límites de uso) | Tests con y sin RC, con respuestas de error simuladas |
| A7 | Base de datos local sin copias | SQLite `prisma/dev.db` | PostgreSQL gestionado (Prisma lo admite cambiando el proveedor), migración de datos de demo opcional y copias automáticas diarias | Crítica | Elegir hosting | 4–6 | ≈ 0–25 €/mes según proveedor | Datos sobreviven a redespliegues; restauración probada una vez |
| A8 | Hosting, dominio y HTTPS | Solo local | Proponer 2–3 opciones (p. ej. Vercel + Neon/Supabase, o un VPS con Docker) con coste; desplegar **solo con tu autorización** | Crítica | A7, A10 | 4–6 | Dominio ≈ 10–15 €/año; hosting 0–25 €/mes | Web en HTTPS en el dominio propio; variables de entorno fuera del código |
| A9 | Textos legales incompletos | `/privacy` y `/legal` con «PENDIENTE» y «demo» | Redactar plantillas completas con tus datos: aviso legal, privacidad, cookies y condiciones de uso, más la página de limitaciones de las valoraciones. **Revisión por un profesional recomendada** | Crítica | Datos del titular | 4–6 | Revisión legal (a presupuestar) | Sin «PENDIENTE» ni «demo»; enlaces en todos los formularios |
| A10 | Envío de correos inexistente | `EmailNotificationProvider` lanza error | Proveedor transaccional (Resend, Brevo o SMTP): aviso al equipo por solicitud, confirmación al propietario con enlace de recuperación del estudio | Alta | Dominio (SPF/DKIM) | 5–8 | Planes gratuitos suficientes al inicio | Correo recibido en pruebas; fallo de envío registrado sin perder la solicitud |
| A11 | Derechos RGPD y conservación | No existen | Panel admin: exportar y suprimir los datos de un propietario (anonimizar el lead y conservar la prueba del consentimiento); purga programada de estudios sin contacto (plazo a definir) | Alta | A9 (plazos) | 5–8 | 0 € | Tests de exportación y supresión |
| A12 | Panel admin con usuario compartido | Contraseña única en `.env` | Mantener el login actual con contraseña fuerte obligatoria, bloqueo tras intentos fallidos y registro de accesos. Usuarios individuales en B5 | Alta | — | 2–3 | 0 € | Test de bloqueo; contraseña débil rechazada |
| A13 | Registro de errores | Solo consola | Registro estructurado en servidor (y Sentry gratuito opcional) sin datos personales | Media-alta | A8 | 2–3 | 0 € (plan gratuito) | Un error provocado aparece en el registro |
| A14 | Vulnerabilidades de dependencias | `npm audit`: 4 altas, 1 moderada | Actualizar Next y Prisma a versiones corregidas en una rama y pasar todos los tests y el build | Media-alta | A1 | 2–4 | 0 € | `npm audit --omit=dev` sin avisos altos |
| A15 | Cambio de marca | 51 líneas en 24 ficheros, logo y metadatos | Migrar los textos visibles (8 idiomas), metadatos, favicon, PDF, consentimiento y correos; sustituir identificadores técnicos seguros (§5) | Alta | Logotipo (§3) | 4–6 | 0 € | `grep -i tramontana` solo devuelve datos históricos o documentación |

**Total A ≈ 66–102 h**, más la revisión legal externa.

### B. IMPORTANTE PARA MEJORAR EL PRODUCTO

| # | Problema / oportunidad | Solución | Horas | Gastos | Criterio de terminado |
|---|---|---|---|---|---|
| B1 | Identidad visual antigua (arena, terracota, serif) | Sistema de diseño FINCALIA360: paleta (#142B45, #238477, #F7F8F5, grises con contraste AA), tipografía Manrope o Inter (autoalojada), componentes revisados, menos bordes y tarjetas | 10–16 | 0 € | Contraste AA comprobado; capturas en móvil, tablet y ordenador |
| B2 | Página de inicio | Nueva home con el mensaje y el CTA «Analizar mi vivienda», 3 servicios, cómo funciona, datos necesarios, ejemplo de informe (marcado como ficticio), FAQ, bloque de transparencia y CTA final. Sin testimonios ni cifras inventadas | 10–14 | Fotografías: banco gratuito (Unsplash/Pexels, revisar licencia) o compradas | Revisión visual en 3 tamaños; Lighthouse ≥ 90 en accesibilidad |
| B3 | Formulario | Pasos más cortos con barra de progreso, explicación de cada dato sensible, guardado automático del progreso (en el navegador y, opcionalmente, en el servidor) y estados de carga y error revisados | 8–12 | 0 € | Prueba completa en móvil; recuperar el progreso tras recargar |
| B4 | Resultados y PDF con la nueva identidad | Logo, paleta y tipografía en la web y el PDF (fuente incrustada en lugar de Helvetica); etiquetas visuales para dato verificado, estimación, hipótesis, pendiente de confirmar y limitación | 8–12 | 0 € | El test web = PDF sigue en verde; revisión visual del PDF |
| B5 | Usuarios individuales en el panel | Usuarios con roles (admin, comercial) y registro de acciones | 8–12 | 0 € | Tests de permisos por rol |
| B6 | Recuperar el estudio en otro dispositivo | Enlace mágico por correo (con caducidad) | 3–4 | 0 € (usa A10) | El enlace abre el estudio en otro navegador |
| B7 | Seguimiento de solicitudes | Estados, recordatorios y notas en el CRM ya existente, conectados al correo | 4–6 | 0 € | Flujo probado de solicitud a cita |
| B8 | Pruebas de extremo a extremo | Playwright: formulario, estudio, PDF, panel y móvil | 8–10 | 0 € | Batería en verde |
| B9 | Analítica respetuosa | Mantener la analítica propia o usar Plausible o Umami (sin cookies) | 2–3 | Plausible ≈ 9 €/mes; Umami autoalojado 0 € | Panel de visitas y conversiones |
| B10 | SERPAVI por sección censal | Usar la dirección o RC identificada para obtener la sección censal | 6–8 | 0 € | Test con una dirección conocida |

### C. OPCIONAL PARA EL FUTURO

| # | Funcionalidad | Comentario | Gastos |
|---|---|---|---|
| C1 | Comparables de mercado (Idealista u otros) | Requiere acuerdo y credenciales; ya existe el adaptador | De pago o con acuerdo |
| C2 | Agente con IA real (OpenAI/Anthropic) | Adaptadores preparados; hace falta revisar privacidad y costes | Por uso |
| C3 | WhatsApp Business | Stub existente; requiere cuenta verificada y plantillas aprobadas | Por mensaje |
| C4 | Calendario real (Google o Microsoft) para las citas | — | 0 € |
| C5 | Campañas reales | Hoy son DEMO; solo con consentimiento comercial | Según canal |
| C6 | Fiscalidad foral y autonómica detallada | Navarra y País Vasco, bonificaciones de sucesiones | 0 € |
| C7 | Valoración automática (AVM) de un proveedor | Solo con licencia de datos | De pago |

---

## 7. Pruebas propuestas (Fase 5)

Ya existen tests automáticos para el simulador, los impuestos, las zonas tensionadas (dentro, parcial, fuera, vencida), los supuestos de la renta legal, la ausencia de valor de venta, el PDF y los permisos de sesión. Habría que añadir:

- Formulario completo y persistencia de solicitudes (incluido un reinicio del servidor, con PostgreSQL).
- Identificación de inmuebles: con RC, por dirección, sin RC y con el Catastro caído (respuestas simuladas).
- Supuestos legales de renta una vez validados (A5), incluido «faltan datos del contrato anterior».
- Permisos: acceso a leads y estudios sin token, panel sin sesión, roles (B5).
- Antispam y límites (A4), supresión y exportación RGPD (A11).
- Extremo a extremo en móvil (B8).

Todos los datos de prueba serán ficticios y estarán identificados como tales. No se usarán datos reales de propietarios.

---

## 8. Decisiones que necesito de ti

1. **Logotipo**: opción A (me pasas el SVG o PNG transparente), B (recorto de la lámina) o C (versión vectorial redibujada, solo con tu permiso).
2. **Colores oficiales**: los rotulados (#142B45 / #238477) o los medidos en la imagen.
3. **Producto**: ¿unificamos la captación en el estudio y retiramos la valoración ficticia de `/valorar` (recomendado)?
4. **Ámbito**: ¿lanzamiento solo en la Costa Brava o en toda España?
5. **Orden de ejecución propuesto**:
   1. A1 → A15 + B1 (marca e identidad).
   2. A2, A3, A4 (resultados falsos y privacidad).
   3. B2–B4 (rediseño).
   4. A5, A6 (legal e identificación).
   5. A7–A14 (infraestructura y cumplimiento). Ningún despliegue ni gasto sin tu autorización expresa.
