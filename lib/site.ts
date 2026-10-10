// Dirección pública de la web para enlaces absolutos (mapa del sitio, imágenes para compartir, datos para Google).
// Prioridad: SITE_URL (tu dominio) → RENDER_EXTERNAL_URL (la da Render automáticamente) → local.
export function publicSiteUrl() {
  const url = process.env.SITE_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim() || "http://localhost:3000";
  return url.replace(/\/$/, "");
}

/** Imagen genérica para compartir las páginas del portal (1200 × 630). */
export const PORTAL_OG_IMAGE = { url: "/og/fincalia360-portal.jpg", width: 1200, height: 630, alt: "FINCALIA360 · viviendas y amarres en Cataluña" };
