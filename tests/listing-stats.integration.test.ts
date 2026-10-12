// Visitas y «compartir» de los anuncios. Base de datos propia (prisma/test-stats.db). Datos FICTICIOS.
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB_FILE = path.join(__dirname, "..", "prisma", "test-stats.db");
process.env.DATABASE_URL = `file:${DB_FILE}`;
const UPLOADS = mkdtempSync(path.join(os.tmpdir(), "fincalia-stats-"));
process.env.UPLOAD_DIR = UPLOADS;

type Mods = {
  prisma: typeof import("@/db/client").prisma;
  listings: typeof import("@/services/listings/listings");
  stats: typeof import("@/services/listings/listingStats");
  seo: typeof import("@/services/listings/seo");
};
let m: Mods;
const admin = { kind: "admin" as const, id: "admin-test" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";

const home = (over: Record<string, unknown> = {}) => ({
  operation: "SALE",
  title: "Piso ficticio de prueba para estadísticas",
  description: "Descripción ficticia de prueba para el portal. Piso luminoso con terraza, cocina equipada y ascensor, cerca de servicios.",
  propertyType: "PISO",
  price: "180000",
  provinceCode: "17",
  municipality: "Girona",
  builtArea: "85",
  bedrooms: "3",
  bathrooms: "1",
  features: [],
  energyRating: "D",
  authorizationType: "MANDATE_SHARED",
  authorizationDate: "2026-10-01",
  checkData: "on",
  checkAuthorization: "on",
  checkEnergy: "on",
  ...over,
});

beforeAll(async () => {
  for (const f of [DB_FILE, `${DB_FILE}-journal`]) if (existsSync(f)) rmSync(f);
  execSync("npx prisma db push --skip-generate", { env: { ...process.env, DATABASE_URL: `file:${DB_FILE}` }, stdio: "ignore" });
  m = {
    prisma: (await import("@/db/client")).prisma,
    listings: await import("@/services/listings/listings"),
    stats: await import("@/services/listings/listingStats"),
    seo: await import("@/services/listings/seo"),
  };
}, 120_000);

afterAll(async () => {
  await m?.prisma.$disconnect();
  rmSync(UPLOADS, { recursive: true, force: true });
});

async function publishedListing() {
  const sharp = (await import("sharp")).default;
  const l = await m.listings.createListing(admin, home());
  await m.listings.addPhoto(admin, l.id, await sharp({ create: { width: 800, height: 600, channels: 3, background: "#3a7ca5" } }).jpeg().toBuffer());
  await m.listings.transitionListing(admin, l.id, "publish");
  return l;
}

describe("visitas y compartir de los anuncios", () => {
  it("cuenta una visita por pestaña cada 30 minutos, ignora robots y anuncios no publicados", async () => {
    const l = await publishedListing();
    const draft = await m.listings.createListing(admin, home({ title: "Piso ficticio en borrador para estadísticas" }));

    expect(await m.stats.recordListingEvent({ listingId: l.id, kind: "view", sessionId: "s1", userAgent: UA })).toBe(true);
    expect(await m.stats.recordListingEvent({ listingId: l.id, kind: "view", sessionId: "s1", userAgent: UA })).toBe(false); // recarga
    expect(await m.stats.recordListingEvent({ listingId: l.id, kind: "view", sessionId: "s2", userAgent: UA })).toBe(true);
    expect(await m.stats.recordListingEvent({ listingId: l.id, kind: "view", sessionId: "s3", userAgent: "Googlebot/2.1" })).toBe(false);
    expect(await m.stats.recordListingEvent({ listingId: l.id, kind: "view", sessionId: "s4", userAgent: "WhatsApp/2.23" })).toBe(false);
    expect(await m.stats.recordListingEvent({ listingId: draft.id, kind: "view", sessionId: "s5", userAgent: UA })).toBe(false);
    expect(await m.stats.recordListingEvent({ listingId: "no-existe-0000", kind: "view", sessionId: "s6", userAgent: UA })).toBe(false);

    await m.stats.recordListingEvent({ listingId: l.id, kind: "share", channel: "whatsapp", sessionId: "s1", userAgent: UA });
    await m.stats.recordListingEvent({ listingId: l.id, kind: "share", channel: "whatsapp", sessionId: "s2", userAgent: UA });
    await m.stats.recordListingEvent({ listingId: l.id, kind: "share", channel: "copy", sessionId: "s2", userAgent: UA });

    const counts = await m.stats.listingCounts([l.id, draft.id]);
    expect(counts[l.id]).toEqual({ views: 2, views30: 2, shares: 3 });
    expect(counts[draft.id]).toEqual({ views: 0, views30: 0, shares: 0 });

    const detail = await m.stats.listingStatsDetail(l.id);
    expect(detail).toMatchObject({ total: 2, last7: 2, last30: 2, shares: 3, byChannel: { whatsapp: 2, copy: 1 } });
    expect(detail.byDay).toHaveLength(30);
    expect(detail.byDay.at(-1)?.views).toBe(2);

    // No se guarda nada personal: solo el anuncio y el canal
    const events = await m.prisma.event.findMany({ where: { category: "LISTING" } });
    for (const e of events) expect(Object.keys(JSON.parse(e.payload ?? "{}")).sort()).toEqual(e.type === "listing_share" ? ["channel", "listingId"] : ["listingId"]);
  });

  it("la descripción para Google corta en una palabra completa", () => {
    const d = m.seo.metaDescription(["Casa · en venta · en Roses · 40 m² · 1 habitación · 174.000 €.", "Casita adosada con piscina comunitaria en Santa Margarida, Roses. Disfruta de una estancia tranquila y acogedora en esta encantadora casa"]);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.endsWith("…")).toBe(true);
    expect(d).not.toMatch(/\s…$/);
    expect(m.seo.metaDescription(["Texto corto."])).toBe("Texto corto.");
  });
});
