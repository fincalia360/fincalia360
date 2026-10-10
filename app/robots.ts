import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

/** Buscadores: solo la parte pública y solo si ALLOW_INDEXING=true. Nunca el panel ni los estudios privados. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_INDEXING !== "true") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: ["/", "/estudio$", "/comprar", "/alquilar", "/inmueble/", "/media/", "/legal", "/privacy", "/cookies", "/condiciones"], disallow: ["/admin", "/api", "/estudio/", "/login", "/valorar", "/agent", "/zona-inmobiliarias/"] },
    ...(process.env.SITE_URL ? { sitemap: `${process.env.SITE_URL.replace(/\/$/, "")}/sitemap.xml` } : {}),
  };
}
