import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Buscadores: solo la parte pública y solo si ALLOW_INDEXING=true. Nunca el panel ni los estudios privados. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_INDEXING !== "true") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: ["/", "/estudio$", "/comprar", "/alquilar", "/amarres/", "/amarre/", "/publicar", "/contacto", "/inmueble/", "/media/", "/legal", "/privacy", "/cookies", "/condiciones"], disallow: ["/admin", "/api", "/estudio/", "/login", "/valorar", "/agent", "/zona-inmobiliarias/"] },
    sitemap: `${publicSiteUrl()}/sitemap.xml`,
  };
}
