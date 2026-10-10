# Solicitar la API de Idealista (comparables de anuncios)

FINCALIA360 **no copia datos de portales**. La forma permitida de usar anuncios de Idealista de forma automática es su API oficial, que exige solicitar acceso y aceptar sus condiciones. **No se ha solicitado ni activado nada**: esta guía es para que lo hagas tú si quieres.

## Qué aportaría

- Anuncios comparables actuales (precio, superficie, habitaciones, ubicación) para el rango de alquiler y de venta del informe.
- Siempre como **precios de anuncio** (oferta), nunca como precios de contratos firmados.

## Pasos

1. Entra en <https://developers.idealista.com/access-request> y rellena el formulario con los datos de tu empresa.
2. Describe el uso: «Informe orientativo para propietarios que compara vender o alquilar su vivienda; se muestran estadísticas de anuncios comparables con su fuente y fecha».
3. **Lee las condiciones** antes de aceptarlas: límites de consultas, si permiten el uso comercial, cómo hay que citar la fuente y si hay coste. No aceptes nada que no encaje con tu negocio.
4. Si te dan acceso, recibirás una **clave** (`apikey`) y un **secreto**.
5. Pásame la confirmación y te propongo la integración **antes** de activarla. Hay un conector preparado y sin activar en `services/study/sources/idealista.ts`.
   - Las credenciales irían en las variables `IDEALISTA_API_KEY` e `IDEALISTA_API_SECRET`, en Render → Environment, nunca en el código.

## Mientras tanto

- Usa **Panel → Comparables de alquiler** para registrar a mano anuncios que hayas consultado, con su enlace y fecha. El informe los muestra con su fuente.
- Si quieres que esos comparables también cambien la renta que usa el simulador, hay que pedirlo aparte: cambiaría resultados existentes.
