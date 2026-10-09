import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return ["", "/estudio", "/legal", "/privacy", "/cookies", "/condiciones"].map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" }));
}
