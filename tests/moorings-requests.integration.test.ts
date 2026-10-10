// Amarres, filtros del portal y «Publica tu vivienda gratis», con una base de datos SQLite propia
// (prisma/test-moorings.db). Todos los datos son FICTICIOS.
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB_FILE = path.join(__dirname, "..", "prisma", "test-moorings.db");
process.env.DATABASE_URL = `file:${DB_FILE}`;
const UPLOADS = mkdtempSync(path.join(os.tmpdir(), "fincalia-moorings-"));
process.env.UPLOAD_DIR = UPLOADS;
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;

type Mods = {
  prisma: typeof import("@/db/client").prisma;
  listings: typeof import("@/services/listings/listings");
  inquiries: typeof import("@/services/listings/inquiries");
  requests: typeof import("@/services/listings/publicationRequests");
  storage: typeof import("@/services/storage/storage");
};
let m: Mods;
const admin = { kind: "admin" as const, id: "admin-test" };

const mooring = (over: Record<string, unknown> = {}) => ({
  category: "MOORING",
  operation: "SALE",
  title: "Amarre ficticio de 12 x 4 m en puerto de prueba",
  description: "Descripción ficticia de prueba. Amarre en pantalán con finger, agua y electricidad, zona abrigada y fácil acceso desde el aparcamiento.",
  propertyType: "AMARRE",
  price: "60000",
  provinceCode: "17",
  municipality: "Roses",
  portName: "Port Ficticio de Roses",
  zone: "Pantalán 3",
  berthLength: "12",
  berthWidth: "4,2",
  maxBoatLength: "11,5",
  maxBoatBeam: "4",
  mooringType: "FINGER",
  features: ["WATER", "ELECTRICITY"],
  authorizationType: "OWNER_SIGNED",
  authorizationDate: "2026-10-01",
  checkData: "on",
  checkAuthorization: "on",
  ...over,
});

const home = (over: Record<string, unknown> = {}) => ({
  operation: "SALE",
  title: "Piso ficticio de prueba con terraza",
  description: "Descripción ficticia de prueba para el portal. Piso luminoso con terraza, cocina equipada y ascensor, cerca de servicios.",
  propertyType: "PISO",
  price: "250000",
  provinceCode: "08",
  municipality: "Sabadell",
  builtArea: "90",
  bedrooms: "3",
  bathrooms: "2",
  features: ["ACCESSIBLE"],
  energyRating: "D",
  authorizationType: "MANDATE_SHARED",
  authorizationDate: "2026-10-01",
  checkData: "on",
  checkAuthorization: "on",
  checkEnergy: "on",
  ...over,
});

async function jpegWithGps() {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: 1000, height: 750, channels: 3, background: "#3a7ca5" } })
    .jpeg()
    .withExif({ IFD0: { Make: "CamaraFicticia" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "42/1 15/1 0/1" } })
    .toBuffer();
}

async function published(raw: Record<string, unknown>) {
  const l = await m.listings.createListing(admin, raw);
  await m.listings.addPhoto(admin, l.id, await jpegWithGps());
  await m.listings.transitionListing(admin, l.id, "publish");
  return l;
}

beforeAll(async () => {
  for (const f of [DB_FILE, `${DB_FILE}-journal`]) if (existsSync(f)) rmSync(f);
  execSync("npx prisma db push --skip-generate", { env: { ...process.env, DATABASE_URL: `file:${DB_FILE}` }, stdio: "ignore" });
  m = {
    prisma: (await import("@/db/client")).prisma,
    listings: await import("@/services/listings/listings"),
    inquiries: await import("@/services/listings/inquiries"),
    requests: await import("@/services/listings/publicationRequests"),
    storage: await import("@/services/storage/storage"),
  };
}, 120_000);

afterAll(async () => {
  await m?.prisma.$disconnect();
  rmSync(UPLOADS, { recursive: true, force: true });
});

describe("amarres: alta, edición, publicación y retirada", () => {
  it("exige puerto y medidas; un amarre no guarda datos de vivienda", async () => {
    await expect(m.listings.createListing(admin, mooring({ portName: "" }))).rejects.toThrow(/puerto deportivo/);
    await expect(m.listings.createListing(admin, mooring({ berthWidth: "" }))).rejects.toThrow(/anchura/);
    await expect(m.listings.createListing(admin, mooring({ provinceCode: "07", municipality: "Palma" }))).rejects.toThrow(/Cataluña/);
    const l = await m.listings.createListing(admin, mooring({ bedrooms: "3", energyRating: "D" }));
    expect(l.status).toBe("DRAFT");
    expect(l.category).toBe("MOORING");
    expect(l.berthWidth).toBe(4.2);
    expect(l.bedrooms).toBeNull();
    expect(l.energyRating).toBeNull();
    expect(l.slug).toMatch(/^amarre-venta-12-m-port-ficticio-de-roses-roses-f360-/);
  });

  it("se edita, se publica sin certificado energético, aparece en amarres (no en viviendas) y se retira", async () => {
    const l = await m.listings.createListing(admin, mooring());
    expect(m.listings.publishProblems(l, 0)).toContain("Añade al menos una fotografía");
    await m.listings.updateListing(admin, l.id, mooring({ price: "65000", concessionEnd: "2048", extraInfo: "Tasas portuarias ficticias de prueba." }));
    await m.listings.addPhoto(admin, l.id, await jpegWithGps());
    expect((await m.listings.transitionListing(admin, l.id, "publish")).status).toBe("PUBLISHED");

    const pub = await m.listings.getPublicListing(l.reference);
    expect(pub?.price).toBe(65000);
    expect(pub?.concessionEnd).toBe(2048);
    expect(pub).not.toHaveProperty("address");
    const inMoorings = await m.listings.searchPublic("SALE", {}, "MOORING");
    const inHomes = await m.listings.searchPublic("SALE", {}, "HOME");
    expect(inMoorings.items.some((i) => i.reference === l.reference)).toBe(true);
    expect(inHomes.items.some((i) => i.reference === l.reference)).toBe(false);

    await m.listings.transitionListing(admin, l.id, "unpublish");
    expect(await m.listings.getPublicListing(l.reference)).toBeNull();
    // Retirado y sin solicitudes: el administrador puede eliminarlo
    await m.listings.deleteListing(admin, l.id);
    expect(await m.prisma.listing.findUnique({ where: { id: l.id } })).toBeNull();
  });

  it("alquiler de amarre con periodicidad", async () => {
    const l = await published(mooring({ operation: "RENT", price: "450", rentPeriod: "MONTH", portName: "Marina Ficticia" }));
    const catalog = await import("@/services/listings/catalog");
    const row = await m.prisma.listing.findUniqueOrThrow({ where: { id: l.id } });
    expect(catalog.formatPrice(row.price, row.operation, row.rentPeriod)).toMatch(/^450\s€\/mes$/);
    expect(catalog.formatPrice(3000, "RENT", "SEASON")).toMatch(/temporada$/);
    expect(catalog.listingPath(row)).toBe(`/amarre/${row.slug}`);
  });

  it("filtros: puerto, eslora y manga del barco, tipo y servicios", async () => {
    const big = await published(mooring({ portName: "Port Gran Ficticio", berthLength: "20", berthWidth: "6", maxBoatLength: "19", maxBoatBeam: "5,8", mooringType: "PONTOON", features: ["WATER", "SECURITY"] }));
    const search = (f: Record<string, unknown>) => m.listings.searchPublic("SALE", f, "MOORING").then((r) => r.items.map((i) => i.reference));
    expect(await search({ puerto: "Port Gran Ficticio" })).toEqual([big.reference]);
    expect(await search({ eslora: 15 })).toEqual([big.reference]);
    expect(await search({ manga: 5 })).toEqual([big.reference]);
    expect(await search({ tipoAmarre: "PONTOON" })).toEqual([big.reference]);
    expect(await search({ car: "SECURITY" })).toEqual([big.reference]);
    expect(await search({ eslora: 25 })).toEqual([]);
  });

  it("la solicitud de información de un amarre guarda el consentimiento con la palabra «amarre»", async () => {
    const l = await published(mooring({ portName: "Port Consentimiento" }));
    const r = await m.inquiries.submitInquiry(l.reference, { name: "Persona Ficticia", email: "persona.ficticia@example.com", consent: true, elapsedMs: 5000, message: "Hola" });
    expect(r.ok).toBe(true);
    const inq = await m.prisma.listingInquiry.findFirstOrThrow({ where: { listingId: l.id } });
    expect(inq.consentText).toMatch(/sobre el amarre/);
  });
});

describe("viviendas: filtros nuevos", () => {
  it("baños y características con coincidencia exacta (AC no coincide con ACCESSIBLE)", async () => {
    const a = await published(home());
    const b = await published(home({ bathrooms: "1", features: ["AC", "TERRACE"] }));
    const search = (f: Record<string, unknown>) => m.listings.searchPublic("SALE", f).then((r) => r.items.map((i) => i.reference));
    expect(await search({ banos: 2 })).toContain(a.reference);
    expect(await search({ banos: 2 })).not.toContain(b.reference);
    expect(await search({ car: "AC" })).toEqual([b.reference]);
    expect(await search({ car: "ACCESSIBLE" })).toEqual([a.reference]);
    expect(await search({ car: "AC,TERRACE" })).toEqual([b.reference]);
    expect(m.listings.parseSearch({ car: ["AC", "TERRACE"] }).car).toBe("AC,TERRACE");
  });

  it("una vivienda no admite tipo «amarre» ni servicios de amarre", async () => {
    await expect(m.listings.createListing(admin, home({ propertyType: "AMARRE" }))).rejects.toThrow(/tipo de inmueble/);
    await expect(m.listings.createListing(admin, home({ features: ["WATER"] }))).rejects.toThrow(/no válida para una vivienda/);
  });

  it("solo se elimina un anuncio retirado o borrador, nunca uno publicado", async () => {
    const l = await published(home());
    await expect(m.listings.deleteListing(admin, l.id)).rejects.toThrow(/Retíralo primero/);
  });
});

describe("Publica tu vivienda gratis", () => {
  const valid = (over: Record<string, unknown> = {}) => ({
    category: "HOME",
    operation: "SALE",
    propertyType: "PISO",
    provinceCode: "08",
    municipality: "Terrassa",
    price: "210000",
    bedrooms: "3",
    description: "Piso ficticio de prueba enviado por un propietario ficticio.",
    name: "Propietaria Ficticia",
    email: "Propietaria.Ficticia@Example.com",
    phone: "600 000 000",
    isOwner: "on",
    privacy: "on",
    elapsedMs: "8000",
    ...over,
  });

  it("guarda la solicitud con fotos privadas sin metadatos y consentimientos explícitos", async () => {
    const r = await m.requests.submitPublicationRequest(valid(), [await jpegWithGps()]);
    expect(r.status).toBe("NEW");
    expect(r.email).toBe("propietaria.ficticia@example.com");
    expect(r.marketingConsent).toBe(false);
    expect(r.consentText).toMatch(/política de privacidad/);
    const [key] = r.photos.split(",");
    expect(key).toMatch(/^private\/requests\//);
    const sharp = (await import("sharp")).default;
    const meta = await sharp((await m.storage.getFile(key))!).metadata();
    expect(meta.exif).toBeUndefined();
    expect(await m.requests.isRequestPhoto(key)).toBe(true);
    expect(await m.requests.isRequestPhoto("private/requests/0000.webp")).toBe(false);
  });

  it("rechaza sin consentimiento, fuera de Cataluña, robots y fotos no válidas", async () => {
    await expect(m.requests.submitPublicationRequest(valid({ privacy: "" }), [])).rejects.toThrow(/política de privacidad/);
    await expect(m.requests.submitPublicationRequest(valid({ isOwner: "" }), [])).rejects.toThrow(/propietario/);
    await expect(m.requests.submitPublicationRequest(valid({ provinceCode: "28", municipality: "Madrid" }), [])).rejects.toThrow(/Cataluña/);
    await expect(m.requests.submitPublicationRequest(valid({ website: "http://spam" }), [])).rejects.toThrow(/No se ha podido/);
    await expect(m.requests.submitPublicationRequest(valid(), [Buffer.from("no es una imagen")])).rejects.toThrow(/imagen/);
    await expect(m.requests.submitPublicationRequest(valid({ category: "MOORING", portName: "" }), [])).rejects.toThrow(/puerto/);
  });

  it("el administrador crea el borrador del anuncio con las fotos y puede borrar la solicitud", async () => {
    const r = await m.requests.submitPublicationRequest(valid({ category: "MOORING", operation: "RENT", portName: "Port Solicitud", berthLength: "10", berthWidth: "3,5", municipality: "L'Escala", provinceCode: "17" }), [await jpegWithGps()]);
    const listing = await m.requests.convertPublicationRequest("admin-test", r.id, { title: "Amarre de 10 m en Port Solicitud", price: 300 });
    const full = await m.listings.getListing(admin, listing.id);
    expect(full.status).toBe("DRAFT");
    expect(full.category).toBe("MOORING");
    expect(full.berthWidth).toBe(3.5);
    expect(full.photos).toHaveLength(1);
    expect(full.photos[0].key).toMatch(/^public\/listings\//);
    expect((await m.requests.getPublicationRequest(r.id)).status).toBe("CONVERTED");
    await expect(m.requests.convertPublicationRequest("admin-test", r.id, { title: "Otro título de prueba", price: 300 })).rejects.toThrow(/ya tiene/);

    const key = r.photos.split(",")[0];
    await m.requests.deletePublicationRequest("admin-test", r.id);
    expect(await m.prisma.publicationRequest.findUnique({ where: { id: r.id } })).toBeNull();
    expect(await m.storage.getFile(key)).toBeNull();
    // El anuncio creado sigue existiendo (sus fotos son copias públicas)
    expect(await m.prisma.listing.findUnique({ where: { id: listing.id } })).not.toBeNull();
  });
});

describe("SEO del portal", () => {
  it("páginas por población solo donde hay anuncios publicados, con su dirección", async () => {
    const seo = await import("@/services/listings/seo");
    const a = await published(mooring({ portName: "Port SEO Ficticio", municipality: "L'Escala", provinceCode: "17" }));
    const cities = await seo.citiesWithListings("MOORING", "SALE");
    const escala = cities.find((c) => c.name === "L'Escala");
    expect(escala?.slug).toBe("l-escala");
    expect(seo.cityPath("MOORING", "SALE", "L'Escala")).toBe("/amarres/comprar/l-escala");
    expect((await seo.findCity("MOORING", "SALE", "l-escala"))?.count).toBeGreaterThanOrEqual(1);
    expect(await seo.findCity("MOORING", "SALE", "poblacion-sin-anuncios")).toBeNull();
    // Retirado el anuncio, la página de la población desaparece si no quedan otros
    await m.listings.transitionListing(admin, a.id, "unpublish");
    expect(await seo.findCity("MOORING", "SALE", "l-escala")).toBeNull();
  });

  it("anuncios parecidos de la misma sección, sin el propio anuncio", async () => {
    const seo = await import("@/services/listings/seo");
    const a = await published(home({ municipality: "Badalona" }));
    const b = await published(home({ municipality: "Badalona" }));
    const full = await m.prisma.listing.findUniqueOrThrow({ where: { id: a.id } });
    const similar = await seo.similarListings(full);
    expect(similar.map((s) => s.reference)).toContain(b.reference);
    expect(similar.map((s) => s.reference)).not.toContain(a.reference);
    expect(similar.every((s) => s.category === "HOME")).toBe(true);
  });

  it("metadatos con imagen para compartir y migas de pan", async () => {
    const seo = await import("@/services/listings/seo");
    const meta = seo.portalMetadata({ title: "Amarres en venta en Roses", description: "Prueba", path: "/amarres/comprar/roses" });
    expect(meta.alternates?.canonical).toBe("/amarres/comprar/roses");
    expect(JSON.stringify(meta.openGraph)).toMatch(/fincalia360-portal\.jpg/);
    const crumbs = seo.listingBreadcrumbs({ category: "MOORING", operation: "RENT", municipality: "Roses", title: "Amarre", slug: "amarre-x-f360-abcdef" });
    expect(crumbs.map((c) => c.path)).toEqual(["/", "/amarres/alquilar", "/amarres/alquilar/roses", "/amarre/amarre-x-f360-abcdef"]);
  });
});
