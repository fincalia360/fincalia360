# FINCALIA360 · Plan para convertir los estudios en negocio

Fecha: 9 de octubre de 2026 · Estado: **pendiente de aprobación** (no se ha modificado código para este plan).

## 1. Qué existe ya (comprobado en el código)

| Pieza | Estado | Se reutiliza para |
|---|---|---|
| Base de datos real (Prisma + SQLite, disco persistente en producción) | Funcional | Todo: se amplía sin perder registros |
| `Lead` (contacto), `Property`, `Consent`, `Note`, `Event` (historial), `Appointment` | Funcional | Ficha del contacto, notas, historial, citas, consentimientos |
| Estudio → «Solicitar valoración profesional» crea un `Lead` y lo enlaza con el `Study` | Funcional | Base de la fase 1-2 |
| Panel `/admin`: listado de leads con búsqueda y filtros, ficha, notas, estados, citas, estudios, exportación CSV | Funcional | CRM (fase 4) |
| Protección del panel en el servidor: middleware + `requireAdmin()` en cada acción y descarga | Funcional | Fase 4 y 9 |
| `Agency` (inmobiliarias con zonas, precios de cuota/cita) | Parcial: zonas solo de la Costa Brava | Colaboradores (fase 7) |
| Analítica propia (`Event` ANALYTICS) y métricas del panel | Parcial: campañas y economía con datos **de simulación** | Indicadores (fase 8), sin datos simulados |
| Notificaciones | **Simuladas** (solo registro interno) | Se sustituyen por envío real (fase 5) |

**Lo que falta o no encaja con lo que pides**

1. **Duplicados:** cada solicitud crea un contacto nuevo aunque sea el mismo email.
2. **Estados comerciales:** los 6 actuales son distintos de los 8 que pides y no son configurables.
3. **Pantalla final:** solo hay un formulario de «valoración profesional»; no existen las cuatro opciones ni el resumen antes de enviar.
4. **Interés y servicios:** no se guarda el interés (venta, alquiler o asesoramiento) ni existen servicios configurables.
5. **Seguimiento:** no hay fecha de próxima acción ni vista de «requiere seguimiento».
6. **Ingresos y colaboradores:** no hay registro de ingresos reales, y los colaboradores no tienen ámbito nacional ni el resultado de cada oportunidad.
7. **Métricas:** no se miden los estudios iniciados ni los informes descargados, y las métricas de negocio mezclan datos de demostración.
8. **Correo:** no hay envío real de correos.
9. **Panel:** un solo usuario para todo el equipo, sin registro de quién hizo cada cambio.
10. **Datos personales:** no se pueden exportar ni suprimir los datos de un propietario desde el panel.

## 2. Plan por fases

Horas orientativas de desarrollo y pruebas.

| Fase | Qué se hará | Horas |
|---|---|---|
| **1 · Pantalla final** | Al terminar el estudio (sin ocultar ningún resultado): «Ya conoces las posibilidades de tu vivienda…» con 4 opciones. Vender, alquilar y comparar abren un formulario adaptado; «solo mi informe» ofrece la descarga y, si el correo está configurado, el envío por email. Textos sin promesas de precio ni de rentabilidad. | 5–7 |
| **2 · Formulario y conversión** | Formulario corto que reutiliza los datos del estudio (municipio, tipo, superficie). Pide nombre, email, teléfono (obligatorio solo si eliges llamada), franja horaria y objetivo. Resumen antes de enviar y confirmación con los siguientes pasos. Consentimientos separados: el necesario para atender la solicitud; uno opcional para comunicar los datos a un profesional colaborador; uno opcional de publicidad. Ninguno marcado por defecto. Antispam con campo trampa, tiempo mínimo y límite de envíos. | 6–8 |
| **3 · Base de datos** | Se amplía la actual sin borrar registros: el contacto (`Lead`) pasa a ser la persona, sin duplicados (email normalizado y teléfono). Nueva tabla **Solicitud** (interés, estudio asociado, franja, servicio, fecha). Campos: fecha del último contacto, próxima acción con fecha, preferencias de comunicación y estado configurable. Tabla de **estados** con los 8 iniciales, editable desde el panel. Los registros actuales se convierten a los nuevos estados. | 6–8 |
| **4 · CRM** | Se amplía el panel actual: nuevas solicitudes, búsqueda, filtros por municipio, interés y estado, estudio asociado, notas, cambio de estado, próxima acción e historial. Vista **«Requiere seguimiento»** (próxima acción vencida o contactos nuevos sin atender). Exportar y suprimir los datos de un contacto. | 8–10 |
| **5 · Seguimiento y correo** | Registro manual de llamadas, correos y reuniones; recordatorios con fecha en el panel. **Envío real de correo** con un proveedor (recomendado Resend): aviso al equipo de cada solicitud, confirmación al propietario y envío del informe si lo pide. Sin proveedor configurado, el panel lo indica y no se simula ningún envío. **No habrá envíos promocionales automáticos.** | 6–8 |
| **6 · Servicios** | Catálogo configurable desde el panel (Venta, Alquiler, Asesoramiento personalizado): descripción, alcance, condiciones, tipo de precio (a definir, gratuito, precio fijo, presupuesto o comisión) e importe. **Sin precios inventados:** mientras no se configuren, la web dice «el alcance y el precio se explican antes de contratar». Los textos no afirman que FINCALIA360 intermedie salvo que lo actives en la configuración. Sin pagos. | 5–7 |
| **7 · Colaboradores** | Se amplía `Agency` a **colaborador** (inmobiliaria u otro profesional): servicios, provincias y municipios de toda España, contacto, estado, condiciones acordadas (texto) y oportunidades asignadas con su resultado. Solo se puede asignar o compartir un contacto si consta su consentimiento para comunicar sus datos. Sin comisiones automáticas. | 6–8 |
| **8 · Indicadores** | Panel por periodos con definiciones únicas. Se excluyen siempre los datos de demostración y se retiran del panel las métricas simuladas de campañas y economía (se conservan, marcadas como simulación). Se registran los ingresos reales manualmente. | 6–8 |
| **9 · Seguridad y datos** | **Usuarios individuales** del panel con contraseña cifrada y rol (administrador o comercial), y registro de quién hace cada cambio. Revisión de validaciones, conservación de datos y registro de errores sin datos personales. | 6–8 |
| **10-11 · Diseño, pruebas y documentación** | Diseño FINCALIA360 en móvil y ordenador, pruebas automáticas de cada fase y guía de configuración de producción actualizada. | 6–8 |

**Total: unas 60–80 horas**, por fases. Al terminar cada fase te lo enseñaré en el navegador con el informe que pides.

### Definición de los indicadores (fase 8)

| Indicador | Cómo se cuenta (una sola vez por operación) |
|---|---|
| Estudios iniciados | Sesiones distintas que empiezan el formulario (evento propio, sin cookies de terceros) |
| Estudios completados | Estudios creados en la base de datos |
| Informes generados | Estudios distintos con al menos un PDF descargado o enviado |
| Solicitudes recibidas | Solicitudes enviadas (un contacto puede tener varias) |
| Consultas solicitadas | Contactos distintos con una solicitud de venta, alquiler o asesoramiento |
| Consultas concertadas, propuestas enviadas, clientes conseguidos | Contactos distintos que **alcanzan** ese estado en el periodo (según el historial de cambios de estado) |
| Ingresos registrados | Suma de los ingresos introducidos a mano, con fecha y servicio |
| Conversión | Cada etapa dividida por la anterior, con el número absoluto al lado |

## 3. Servicios externos y costes

| Servicio | Para qué | Coste |
|---|---|---|
| Proveedor de correo (recomendado **Resend**; alternativa: SMTP de tu dominio) | Avisos al equipo, confirmaciones y envío del informe | Gratis hasta unos 3.000 correos al mes; requiere verificar tu dominio |
| Render (ya previsto) | Alojamiento y base de datos | Sin cambios (~7 $/mes) |
| Ninguno más | No se añaden pagos, CRM externo ni WhatsApp | 0 € |

Variables nuevas: `RESEND_API_KEY`, `EMAIL_FROM` (p. ej. `FINCALIA360 <hola@fincalia360.es>`), `TEAM_NOTIFICATION_EMAIL`.

## 4. Requisitos legales que condicionan el diseño (información general)

- **Comunicaciones comerciales (LSSI art. 21):** solo con consentimiento previo y expreso, y con baja sencilla en cada envío. Por eso no habrá envíos promocionales automáticos en esta versión.
- **Comunicar datos a colaboradores:** requiere informar y una base jurídica. Se pedirá un consentimiento específico y opcional, y el panel impide asignar un contacto que no lo tenga.
- **Intermediación inmobiliaria:** algunas comunidades exigen inscripción en un registro de agentes, como Cataluña con el registro AICAT. Los textos solo hablarán de «poner en contacto con profesionales» hasta que confirmes cómo se presta el servicio.
- **Precios:** el alcance y el precio de un servicio de pago se muestran antes de contratarlo.

## 5. Decisiones que necesito

1. **Aprobación del plan** y del orden de las fases.
2. **Usuarios del panel (fase 9):** ¿lo usarás solo tú o también otras personas? Si solo tú, la fase 9 se reduce.
3. **Correo:** ¿te parece bien Resend? (Necesitarás crear la cuenta y verificar el dominio cuando lo tengas.)
4. **Intermediación:** ¿FINCALIA360 venderá o alquilará directamente (con agentes propios) o solo pondrá en contacto con inmobiliarias colaboradoras? Cambia los textos de la fase 6.
