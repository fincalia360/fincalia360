# Estudio gratuito: «¿Te conviene vender o alquilar tu vivienda?»

Herramienta pública (en español) integrada en la web: formulario por pasos → valoración con fuentes → simulador vender/alquilar/mantener a 1, 3, 5 y 10 años → escenarios de impago → impuestos → análisis de zona → informe PDF → solicitud opcional de valoración profesional (CRM).

## Rutas

| Ruta | Descripción |
|---|---|
| `/estudio` | Página pública + formulario en 4 pasos (ubicación, características, situación económica, situación del propietario) |
| `/estudio/[id]` | Resultados interactivos. **Privado**: solo accesible con la cookie httpOnly creada al generar el estudio |
| `POST /api/estudio` | Crea el estudio (sin datos personales ni consentimiento comercial) |
| `PATCH /api/estudio/[id]` | Guarda las hipótesis modificadas (requiere cookie) |
| `POST /api/estudio/[id]/informe` | Genera el PDF con las hipótesis actuales (requiere cookie) |
| `POST /api/estudio/[id]/contacto` | Solicitud de valoración profesional → crea Lead en el CRM (requiere cookie + consentimiento) |
| `GET /api/estudio/municipios?provincia=17` | Municipios oficiales del INE |
| `GET /api/estudio/catastro?rc=…` | Datos no protegidos del Catastro |
| `/admin/studies`, `/admin/studies/[id]` | Panel: estudios, contactos, estado comercial, fuentes de cada informe, PDF |
| `/api/admin/studies/export` | CSV de datos autorizados |
| `/admin/data-sources` | Estado de integraciones, zonas tensionadas, referencias de mercado, caché |
| `/login` | Acceso al panel (si `ADMIN_PASSWORD` está definido) |

Acceso desde la web: enlace «Vender o alquilar» en la cabecera (8 idiomas) y bloque destacado en la landing.

## Fuentes de datos (verificadas en octubre de 2026)

| Fuente | Estado | Uso | Acceso |
|---|---|---|---|
| **INE · API Tempus3** | ✅ Funciona | Población municipal (Padrón, tabla por provincia), IPVA municipal (59060), IPV por CCAA (80271), % viviendas turísticas (39366), lista oficial de municipios | Pública, sin clave. Caché 7–30 días en `OfficialDataCache` |
| **Catastro · servicios web** | ✅ Funciona | Superficie, año de construcción, uso y dirección por referencia catastral (datos no protegidos) | Pública, sin clave |
| **MIVAU · zonas tensionadas** | ✅ Funciona | Relación oficial de declaraciones (Ley 12/2023) con municipios, ámbito parcial, vigencia y resolución BOE | Página pública, se importa y parsea; reimportación automática cada 7 días o manual en `/admin/data-sources` |
| **MIVAU · SERPAVI** | ✅ Importado | Alquiler declarado €/m² (mediana, P25, P75) por municipio y tipología, 2015–2024 | Fichero oficial descargable → `python scripts/import-serpavi.py <xlsx>` → `data/serpavi/*.json` |
| **Idealista API** | ⏳ Requiere acuerdo | Comparables (precios de **anuncio**) | Solicitud en developers.idealista.com + `IDEALISTA_API_KEY/SECRET`. Adapter preparado (`services/study/sources/idealista.ts`) |
| **Fotocasa Research** | ⏳ Sin API pública | — | Requiere acuerdo comercial |
| **Estadística notarial / Registradores / valor tasado MIVAU** | ⏳ Manual | Precios de cierre o tasación por municipio | Cargar en `/admin/data-sources` como «Referencias de mercado» indicando fuente, periodo y licencia |
| **Portales autonómicos/municipales** | ⏳ Pendiente | — | Integrar por fuente concreta |
| **Mapa** | ⏳ No configurado | Enlace al visor oficial del Catastro tras consultar la referencia | Selector en mapa pendiente de proveedor cartográfico |

Nunca se presentan precios de anuncio como precios de compraventa cerrados, ni se inventan comparables o estadísticas. Si no hay fuente, se muestra «Sin estimación» o «No calculable» con los datos que faltan.

## Cómo se calcula cada indicador

Todas las cifras de la web y del PDF salen de una única función pura, `buildStudyReport()` (`services/study/reportModel.ts`). Un test extrae el texto del PDF y comprueba que las cifras de la primera página coinciden exactamente con el modelo.

**Valor de venta** (por prioridad; se muestran también las alternativas):
1. Valor introducido por el propietario en la página del estudio (`saleChoice = MANUAL`) o aportado en el formulario (tasación → confianza alta; valor de referencia catastral u oferta → media).
2. Referencia de mercado cargada por el equipo: €/m² × m² × ajustes.
3. Comparables de un proveedor autorizado (si está configurado): mediana de ≥ 5 anuncios con ±30 % de superficie, intervalo P25–P75, etiquetados como **precio de anuncio**, nunca como cierre.
4. Precio de compra × (IPV CCAA último año / IPV año de compra) + reformas (confianza baja).
5. **Valor tasado medio del Ministerio de Vivienda** (€/m², trimestral): dato del municipio si tiene más de 25.000 habitantes (según antigüedad: hasta 5 años / más de 5 años) o media provincial (confianza muy baja). Se importa con `python scripts/import-valor-tasado.py 35103500.XLS 35101000.XLS` (ficheros oficiales del boletín del Ministerio). Es una media de tasaciones, no la tasación de la vivienda.
6. Datos de EJEMPLO solo si `STUDY_EXAMPLE_DATA=true` (no permiten conclusiones).

Si no hay ninguna fuente, el valor es **desconocido (null)**, nunca 0 €: no se calculan A/B/C ni la sensibilidad, el resumen dice «No es posible valorar el inmueble con fiabilidad» y pide los datos necesarios. La integración con una API de valoración se prepara en `services/study/sources/idealista.ts` (`ComparablesProvider`), sin simular datos.

**Alquiler**: se distinguen cuatro conceptos, cada uno con fuente, fecha y naturaleza:
- *Referencia estadística* SERPAVI: mediana del último año × m² (P25–P75), sin ajustes por características, actualizada con el IPVA. Refleja contratos vigentes declarados.
- *Estimación de mercado*: referencias del equipo; en Cataluña, renta media real de los **contratos nuevos** del municipio (fianzas del Incasòl, API abierta de la Generalitat `qww9-bvhh`), adaptada a la superficie con el perfil €/m² de SERPAVI; o comparables autorizados.
- *Renta máxima legal* (`services/study/rentRegime.ts`, Ley 12/2023, art. 17.6 y 17.7 LAU): en zona tensionada, la renta del último contrato de los 5 años anteriores; si el arrendador es gran tenedor, además el índice de referencia (no calculable aquí: se informa como límite no determinado). Sin datos suficientes, el estado es «no determinada» y se listan los requisitos; nunca se inventa un tope.
- *Renta usada en la simulación*: la elegida (automática: contrato vigente › mercado › estadística; o manual), limitada al tope legal cuando se conoce (salvo contrato vigente).

**Rentabilidad** (anual, sobre el valor de venta): bruta = renta × 12 / valor; neta = (renta cobrada − gastos de explotación recurrentes) / valor; tras impuestos descuenta además el impuesto del alquiler del año 1.

**Simulador** (`services/study/simulator.ts`). Punto de partida común (hoy): patrimonio = valor bruto − hipoteca. Métrica común: patrimonio neto al final del horizonte N en euros corrientes, sin descontar; la rentabilidad alternativa r se aplica igual a A y a los flujos de B/C.
- **A · Vender hoy**: neto = precio − agencia × (1 + IVA) − notaría/gestoría − cancelación de hipoteca − comisión de amortización − plusvalía − IRPF/IRNR − hipoteca pendiente. Patrimonio A = neto × (1 + r)^N.
- **B · Alquilar y vender en N**: flujo anual = renta cobrada − gastos − intereses − capital amortizado − impuestos del alquiler; caja acumulada = Σ flujo × (1 + r)^(N−año). Patrimonio B = caja + neto de una venta en N (valor × (1 + g)^N, con sus gastos, impuestos —restando las amortizaciones fiscales deducidas— y la deuda pendiente).
- **C · Mantener sin vender**: caja + valor bruto en N − deuda en N. **No** se restan gastos ni impuestos de una venta que no ocurre; se muestran aparte como «latentes» (C − B = latentes, comprobado en tests).
- Flujo de caja (dinero de cada año) y patrimonio (valor acumulado) se muestran por separado. Comparativa a 1, 3, 5 y 10 años con las mismas hipótesis.
- **Sensibilidad** de (B − A): valor de venta ±10 %, alquiler ±10 %, desocupación ±1 mes, gastos fijos ±10 %, revalorización ±1 punto, rentabilidad alternativa ±1 punto. Si faltan datos, la variable figura como «no calculable» con el motivo.

**Impuestos** (`services/study/taxes.ts`, normativa estatal 2025-2026, no vinculante). Cada línea tiene estado (completo, incompleto, no calculable, exento, no sujeto, no aplica), fórmula y datos que faltan; lo no calculable no se suma como 0 sino que se marca el neto como incompleto.
- Ganancia patrimonial = (precio − gastos y tributos de la venta) − (compra + gastos de compra + mejoras − amortizaciones deducidas). Residentes: escala del ahorro 19/21/23/27/30 %; exención por vivienda habitual de mayores de 65 años; aviso de reinversión. No residentes: 19 % + aviso de retención del 3 %.
- Plusvalía municipal: mínimo entre método objetivo (suelo catastral × coeficiente × tipo) y real (ganancia × % suelo × tipo); no sujeta sin incremento.
- Alquiler (residentes): (renta cobrada − gastos del periodo alquilado − amortización) × (1 − reducción) × tipo marginal. Gastos fijos, intereses y amortización se prorratean por la parte del año alquilada; intereses + conservación limitados a los ingresos; el periodo vacío genera imputación de rentas (1,1 % del valor catastral). UE/EEE: 19 % del neto; otros países: 24 % del íntegro.
- Amortización: 3 % × máx(coste de adquisición, valor catastral) × % de construcción + 3 % de mejoras. Sin desglose catastral no se deduce y se avisa.
- **Reducción art. 23.2 LIRPF**: no se aplica el 50 % automáticamente. Contrato vigente anterior al 26-05-2023 → 60 %; contrato vigente sin fecha → no determinada; contrato nuevo → 50 % como supuesto, 60 % (rehabilitación), 70 % / 90 % solo en zona tensionada y con requisitos; no residentes 0 %; territorios forales no calculados.
- Imputación de rentas (vivienda vacía o segunda residencia) y sucesiones (solo orientación, sin cifra).

**Impagos y ocupación** (`services/study/risk.ts`): impago sin juicio, desahucio por impago, recuperación por otras causas y ocupación sin título, a 3, 6 y 12 meses (duraciones ilustrativas). Desglose: ingresos perdidos (renta no cobrada − fianza + meses hasta volver a alquilar), gastos ordinarios del periodo, gastos jurídicos, reparaciones, otros (intereses y coste de oportunidad) y total del periodo; además, el coste adicional frente a un alquiler normal. Las hipótesis manuales se editan en la web, se guardan y aparecen identificadas en el PDF. **No se asignan probabilidades ni plazos judiciales.**

**Edad**: solo se pregunta «¿65 años o más?» (opcional) cuando es vivienda habitual de un residente, exclusivamente para la exención del IRPF. No se usa para riesgo, impago, ocupación ni conveniencia de vender.

## Privacidad y captación

- El estudio no pide datos personales. Acceso privado por token aleatorio (hash SHA-256 en BD + cookie httpOnly, 30 días). La URL sola no da acceso.
- La valoración profesional pide nombre, email, teléfono (opcional salvo si se elige teléfono/WhatsApp), medio preferido y comentarios, con texto explicativo de qué se guarda y para qué.
- Consentimiento de contacto (necesario para atender la solicitud) y consentimiento comercial **separado, opcional y no premarcado**. Se guardan timestamp y versión (`estudio-v0.1-2026-10`).
- Se crea un Lead en el CRM existente (origen «Estudio vender/alquilar»), con nota resumen y la valoración del estudio.
- Exportación CSV: sin datos financieros personales; contacto solo con consentimiento; protección contra inyección de fórmulas.
- Límite de peticiones por IP en las APIs públicas (en memoria; usar Redis en producción con varias instancias).

## Variables de entorno

Ver `.env.example`: `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `STUDY_EXAMPLE_DATA`, `SERPAVI_DATA_DIR`, `IDEALISTA_API_KEY`, `IDEALISTA_API_SECRET`. Ninguna clave llega al navegador.

## Limitaciones actuales

- No hay fuente pública y gratuita de precios de **compraventa** por municipio vía API: sin tasación, valor de referencia catastral, precio de compra o referencia cargada por el equipo, no se estima el valor de venta.
- El IPV es de comunidad autónoma; el SERPAVI refleja contratos vigentes declarados (los contratos nuevos suelen ser más altos) y no incluye alquiler turístico.
- Datos a nivel municipal (SERPAVI tiene detalle por sección censal, pendiente de usar con la dirección).
- Zonas tensionadas con ámbito parcial: se avisa de que hay que comprobar la dirección exacta (no se geolocaliza la delimitación).
- Distribución por edades y hogares: no disponibles en la API utilizada (se indica en el informe).
- Coeficientes de plusvalía y tipos municipales: valores de referencia, no la ordenanza concreta.
- No contempla coeficientes de abatimiento, compensación de rendimientos negativos ni de excesos de gastos en años siguientes, ni normativa foral/autonómica específica.

## Actualizar datos

```bash
# SERPAVI (cuando el Ministerio publique un fichero nuevo)
python scripts/import-serpavi.py ruta/al/bd_SERPAVI.xlsx
```

Zonas tensionadas: automático cada 7 días o botón «Actualizar» en `/admin/data-sources`.
