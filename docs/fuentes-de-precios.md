# De dónde salen los precios del estudio

Cada cifra del estudio y del PDF indica su fuente, su periodo y la fecha de consulta. Nada se inventa: si falta un dato, se dice.

## Valor de venta (por orden de prioridad)

1. **Dato del propietario**: tasación, valor de referencia del Catastro u oferta firme.
2. **Referencias cargadas por el equipo** (panel → fuentes de datos), con su fuente.
3. **Cataluña: precio de las compraventas registradas del municipio (principal sin datos del propietario)**:
   - €/m² construido medio de las compraventas de vivienda **inscritas en el Registro de la Propiedad** en los últimos 12 meses (precios de cierre, no de anuncio). Se usa el de vivienda usada; si hay menos de 10 operaciones, la media total.
   - Generalitat de Catalunya, «Compravendes d'habitatges registrades i el preu de venda» (datos del Col·legi de Registradors). Municipios de más de 2.000 habitantes.
   - Fuente: <https://habitatge.gencat.cat/ca/dades/indicadors_estadistiques/estadistiques_de_construccio_i_mercat_immobiliari/estadistica-de-les-compravendes/compravendes-habitatges-Catalunya/>
   - Se actualiza cada trimestre con `python -E -I scripts/import-gencat-compravendes.py` (genera `data/gencat-compravendes/municipis.json`).
4. **Resto de España: valor tasado medio del municipio** (Ministerio de Vivienda, municipios de más de 25.000 habitantes). En Cataluña aparece como contraste.
5. **Mapa de valores del Catastro (referencia secundaria)**:
   - Es el *módulo de valor medio* de la zona, calculado con precios de compraventas escrituradas para una vivienda representativa. En la práctica queda **muy por debajo** del precio registrado (Ripollet: 1.550 €/m² frente a 2.631 €/m² registrados; Roses: 2.660 frente a 3.263), por eso ya no es la cifra principal.
   - Es por zonas homogéneas e incluye una **plaza de garaje representativa**, que sí se sigue usando para valorar el garaje.
   - Requiere la referencia catastral.
   - Fuente: <https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?buscar=S> · leyenda: <https://www.catastro.hacienda.gob.es/ayuda/leyenda_mapavalores.htm>
6. Comparables de un proveedor autorizado (Idealista API, solo con contrato; hoy no configurado).
7. **Precio de compra actualizado con el IPV del INE** (comunidad autónoma).
8. **Valor tasado medio de la provincia** (municipios sin dato propio): muy orientativo.

Precio por **código postal**: solo lo publica el Consejo General del Notariado (Portal Estadístico), cuyas condiciones prohíben reutilizarlo comercialmente sin permiso por escrito. No se usa.

Ajustes visibles y modificables (hipótesis):

| Característica | Ajuste |
|---|---|
| Nueva o reformada | +5 % |
| A reformar | −10 % |
| Terraza o jardín | +3 % |
| Piscina privada | +5 % casa / +3 % piso |
| Piscina comunitaria | +2 % |
| Sin ascensor desde la 3.ª planta | −5 % |

## Anexos (se suman aparte y se ven en el desglose)

| Anexo | Cómo se valora |
|---|---|
| Garaje | Valor del propietario → módulo oficial del garaje de la zona (Catastro) × nº de plazas → si no hay ninguno, ajuste +3 % |
| Trastero | Valor del propietario → hipótesis: m² × €/m² de la vivienda × 25 % (indicada como hipótesis) |
| Amarre | Solo con el valor del propietario: **no existe una fuente oficial pública de precios de amarres**, así que sin ese dato no se suma (se indica «sin valorar») |

## Plusvalía municipal

- **Coeficientes**: tabla del **Real Decreto-ley 8/2023, art. 24** (BOE 28-12-2023), vigente.
  - El RDL 16/2025 los cambió del 1 al 27 de enero de 2026, pero fue derogado (BOE 28-01-2026).
  - Comprobado con el BOE y con la Agencia Tributaria de Madrid.
- **Tipo de cada ayuntamiento**: Ministerio de Hacienda, «Consulta de información impositiva municipal». Importado con `python -E -I scripts/import-plusvalia.py`.
  - Hacienda dejó de publicar este dato en 2022, así que el último año disponible es **2021**: 3.737 municipios con tipo.
  - El estudio avisa de que hay que confirmarlo en la ordenanza fiscal vigente. Si el municipio no tiene dato, se usa el 30 % (máximo legal) como hipótesis.
- **Lo que no se puede obtener automáticamente**: el **valor catastral del suelo** es un dato protegido del Catastro (solo lo ve el titular, p. ej. en el recibo del IBI). Sin él, la plusvalía por el método objetivo queda «incompleta» y el estudio lo pide.

## Planos del informe

- **Plano de situación**: IGN Base (Instituto Geográfico Nacional, CC BY 4.0).
- **Vista aérea**: ortofoto PNOA (IGN, CC BY 4.0) con las parcelas del Catastro.
- **Plano catastral de la parcela**: WMS de la Dirección General del Catastro.
- El **plano interior de la vivienda no es público**: el Catastro solo publica el contorno de la parcela y de las construcciones.

## Fuentes descartadas (y por qué)

| Fuente | Motivo |
|---|---|
| Portal de la Vivienda del Notariado (precios reales por municipio) | Sus condiciones solo permiten uso personal; prohíben el uso comercial y la reproducción sin autorización escrita. Para usarlo hay que pedir permiso a soporte.penotariado@notariado.org. |
| Idealista, Fotocasa, Habitaclia | No se copian datos de portales. Idealista tiene una API oficial que requiere contrato. |
| Registradores (Estadística Registral) | Datos abiertos por provincia, no por municipio. |
