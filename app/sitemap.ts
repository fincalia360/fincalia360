import type { MetadataRoute } from "next";
import { listingPath } from "@/services/listings/catalog";
import { publicListingsForSitemap } from "@/services/listings/listings";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const pages: MetadataRoute.Sitemap = ["", "/estudio", "/comprar", "/alquilar", "/amarres/comprar", "/amarres/alquilar", "/publicar", "/legal", "/privacy", "/cookies", "/condiciones"].map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" }));
  const listings = await publicListingsForSitemap().catch(() => []);
  return [...pages, ...listings.map((l) => ({ url: `${base}${listingPath(l)}`, lastModified: l.updatedAt, changeFrequency: "weekly" as const }))];
}
