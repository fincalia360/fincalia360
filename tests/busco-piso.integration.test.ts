// «Busco piso»: validación, moderación, privacidad y coincidencias con inmuebles publicados.
// Base de datos SQLite propia (prisma/test-busco-piso.db). Todos los datos son FICTICIOS.
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB_FILE = path.join(__dirname, "..", "prisma", "test-busco-piso.db");
process.env.DATABASE_URL = `file:${DB_FILE}`;
const UPLOADS = mkdtempSync(path.join(os.tmpdir(), "fincalia-busco-"));
process.env.UPLOAD_DIR = UPLOADS;
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;

type Mods = {
  prisma: typeof import("@/db/client").prisma;
  listings: typeof import("@/services/listings/listings");
  search: typeof import("@/services/searchRequests/searchRequests");
  matching: typeof import("@/services/searchRequests/matching");
  catalog: typeof import("@/services/searchRequests/catalog");
};
let m: Mods;
const admin = { kind: "admin" as const, id: "admin-test" };

const request = (over: Record<string, unknown> = {}) => ({
  operation: "SALE",
  propertyType: "PISO",
  provinceCode: "17",
  municipalities: ["Girona"],
  maxPrice: 200000,
  minBedrooms: 2,
  terrace: "YES",
  description: "Búsqueda ficticia de prueba: piso con terraza cerca de la estación.",
  name: "Persona Ficticia",
  email: "ficticia@example.com",
  phone: "600000000",
  privacy: true,
  consentText: "He leído la política de privacidad y acepto el tratamiento (texto de prueba).",
  elapsedMs: 10000,
  ...over,
});

const home = (over: Record<string, unknown> = {}) => ({
  operation: "SALE",
  title: "Piso ficticio de prueba para coincidencias",
  description: "Descripción ficticia de prueba para el portal. Piso luminoso con terraza, cocina equipada y ascensor, cerca de servicios.",
  propertyType: "PISO",
  price: "180000",
  provinceCode: "17",
  municipality: "Girona",
  builtArea: "85",
  bedrooms: "3",
  bathrooms: "1",
  features: ["TERRACE", "ELEVATOR"],
  energyRating: "D",
  authorizationType: "MANDATE_SHARED",
  authorizationDate: "2026-10-01",
  checkData: "on",
  checkAuthorization: "on",
  checkEnergy: "on",
  ...over,
});

async function jpeg() {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: 1000, height: 750, channels: 3, background: "#3a7ca5" } })
    .jpeg()
    .toBuffer();
}

async function published(raw: Record<string, unknown>) {
  const l = await m.listings.createListing(admin, raw);
  await m.listings.addPhoto(admin, l.id, await jpeg());
  await m.listings.transitionListing(admin, l.id, "publish");
  return l;
}

beforeAll(async () => {
  for (const f of [DB_FILE, `${DB_FILE}-journal`]) if (existsSync(f)) rmSync(f);
  execSync("npx prisma db push --skip-generate", { env: { ...process.env, DATABASE_URL: `file:${DB_FILE}` }, stdio: "ignore" });
  m = {
    prisma: (await import("@/db/client")).prisma,
    listings: await import("@/services/listings/listings"),
    search: await import("@/services/searchRequests/searchRequests"),
    matching: await import("@/services/searchRequests/matching"),
    catalog: await import("@/services/searchRequests/catalog"),
  };
}, 120_000);

afterAll(async () => {
  await m?.prisma.$disconnect();
  rmSync(UPLOADS, { recursive: true, force: true });
});

describe("formulario: validación en el servidor y antispam", () => {
  it("exige operación, tipo, Cataluña, población, presupuesto máximo y privacidad", async () => {
    const bad = (over: Record<string, unknown>) => m.search.submitSearchRequest(request(over));
    await expect(bad({ operation: "" })).rejects.toThrow(/comprar o alquilar/);
    await expect(bad({ propertyType: "CASTILLO" })).rejects.toThrow(/tipo de inmueble/);
    await expect(bad({ provinceCode: "28" })).rejects.toThrow(/Barcelona, Girona, Lleida o Tarragona/);
    await expect(bad({ municipalities: [] })).rejects.toThrow(/población/);
    await expect(bad({ maxPrice: "" })).rejects.toThrow(/presupuesto máximo/);
    await expect(bad({ maxPrice: -5 })).rejects.toThrow(/presupuesto máximo/);
    await expect(bad({ maxPrice: "abc" })).rejects.toThrow(/presupuesto máximo/);
    await expect(bad({ minPrice: 300000 })).rejects.toThrow(/mínimo no puede superar/);
    await expect(bad({ minArea: 120, maxArea: 80 })).rejects.toThrow(/superficie mínima/);
    await expect(bad({ operation: "RENT", maxPrice: 250000 })).rejects.toThrow(/mensual/);
    await expect(bad({ privacy: false })).rejects.toThrow(/política de privacidad/);
    await expect(bad({ email: "no-es-un-email" })).rejects.toThrow(/Email/);
    expect(await m.prisma.searchRequest.count()).toBe(0);
  });

  it("rechaza envíos automatizados (campo oculto o demasiado rápidos)", async () => {
    await expect(m.search.submitSearchRequest(request({ website: "http://spam.example" }))).rejects.toThrow(/No se ha podido enviar/);
    await expect(m.search.submitSearchRequest(request({ elapsedMs: 300 }))).rejects.toThrow(/No se ha podido enviar/);
    expect(await m.prisma.searchRequest.count()).toBe(0);
  });

  it("guarda el texto tal cual (sin interpretarlo) y queda pendiente de revisión", async () => {
    const created = await m.search.submitSearchRequest(request({ description: '<script>alert("x")</script> busco piso', marketing: false }));
    const r = await m.prisma.searchRequest.findUniqueOrThrow({ where: { reference: created.reference } });
    expect(r.status).toBe("PENDING");
    expect(r.reference).toMatch(/^BP-[0-9A-F]{6}$/);
    expect(r.description).toBe('<script>alert("x")</script> busco piso');
    expect(r.marketingConsent).toBe(false);
    expect(r.consentVersion).toBe(m.search.SEARCH_CONSENT_VERSION);
    await m.prisma.searchRequest.delete({ where: { id: r.id } });
  });
});

describe("moderación y privacidad", () => {
  it("una solicitud pendiente no es pública; publicada se ve sin datos de contacto", async () => {
    const { id } = await m.search.submitSearchRequest(request());
    expect(await m.search.listPublicSearchRequests()).toHaveLength(0);

    await m.search.updateSearchRequest(admin.id, id, { ...request(), municipalities: ["Girona", "Salt"], publicText: "Piso con terraza cerca de la estación." });
    await m.search.setSearchRequestStatus(admin.id, id, "publish");
    const pub = await m.search.listPublicSearchRequests();
    expect(pub).toHaveLength(1);
    const card = pub[0] as Record<string, unknown>;
    for (const key of ["name", "email", "phone", "description", "adminNote", "id", "consentText"]) expect(card).not.toHaveProperty(key);
    expect(JSON.stringify(pub)).not.toMatch(/ficticia@example\.com|600000000|Persona Ficticia/);
    expect(card.municipalities).toBe("Girona|Salt");

    // Filtros públicos
    expect(await m.search.listPublicSearchRequests({ operation: "RENT" })).toHaveLength(0);
    expect(await m.search.listPublicSearchRequests({ provinceCode: "08" })).toHaveLength(0);
    expect(await m.search.listPublicSearchRequests({ municipality: "Salt" })).toHaveLength(1);
    expect(await m.search.listPublicSearchRequests({ budgetMin: 150000, budgetMax: 250000 })).toHaveLength(1);
    expect(await m.search.listPublicSearchRequests({ budgetMax: 100000 })).toHaveLength(0);

    // Retirar, resolver y eliminar
    await m.search.setSearchRequestStatus(admin.id, id, "hide");
    expect(await m.search.listPublicSearchRequests()).toHaveLength(0);
    await m.search.setSearchRequestStatus(admin.id, id, "resolve");
    const resolved = await m.prisma.searchRequest.findUniqueOrThrow({ where: { id } });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedAt).not.toBeNull();
    expect(await m.search.listPublicSearchRequests()).toHaveLength(0);
    await m.search.deleteSearchRequest(admin.id, id);
    expect(await m.prisma.searchRequest.findUnique({ where: { id } })).toBeNull();
  });

  it("no deja publicar un texto con email, teléfono o web", async () => {
    const { id } = await m.search.submitSearchRequest(request());
    await m.search.updateSearchRequest(admin.id, id, { ...request(), publicText: "Llamadme al 612 345 678" });
    await expect(m.search.setSearchRequestStatus(admin.id, id, "publish")).rejects.toThrow(/teléfono/);
    await m.search.updateSearchRequest(admin.id, id, { ...request(), publicText: "Escribid a yo@example.com" });
    await expect(m.search.setSearchRequestStatus(admin.id, id, "publish")).rejects.toThrow(/email/);
    // Si se edita una ya publicada y se añade un contacto, se oculta
    await m.search.updateSearchRequest(admin.id, id, { ...request(), publicText: "Piso luminoso" });
    await m.search.setSearchRequestStatus(admin.id, id, "publish");
    await expect(m.search.updateSearchRequest(admin.id, id, { ...request(), publicText: "Ver www.example.com" })).rejects.toThrow(/se ha ocultado/);
    expect((await m.prisma.searchRequest.findUniqueOrThrow({ where: { id } })).status).toBe("HIDDEN");
    await m.search.deleteSearchRequest(admin.id, id);
  });

  it("filtros del panel por operación, provincia, población y presupuesto", async () => {
    const a = await m.search.submitSearchRequest(request());
    const b = await m.search.submitSearchRequest(request({ operation: "RENT", provinceCode: "08", municipalities: ["Sabadell"], maxPrice: 1200 }));
    const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id).sort();
    expect(ids(await m.search.listSearchRequestsAdmin({ operation: "RENT" }))).toEqual([b.id]);
    expect(ids(await m.search.listSearchRequestsAdmin({ provinceCode: "17" }))).toEqual([a.id]);
    expect(ids(await m.search.listSearchRequestsAdmin({ municipality: "Sabadell" }))).toEqual([b.id]);
    expect(ids(await m.search.listSearchRequestsAdmin({ budgetMin: 100000 }))).toEqual([a.id]);
    expect(ids(await m.search.listSearchRequestsAdmin({ status: "PENDING" }))).toEqual(ids([a, b]));
    await m.prisma.searchRequest.deleteMany();
  });
});

describe("coincidencias con los inmuebles publicados (datos reales de la base de datos)", () => {
  it("respeta los criterios obligatorios, explica cada coincidencia y no modifica los anuncios", async () => {
    const fits = await published(home());
    const cheapNoData = await published(home({ title: "Piso ficticio sin datos de habitaciones", price: "150000", bedrooms: "", features: [] }));
    const penthouse = await published(home({ title: "Ático ficticio de prueba en Girona", propertyType: "ATICO", price: "195000" }));
    await published(home({ title: "Piso ficticio demasiado caro para la búsqueda", price: "250000" }));
    await published(home({ title: "Casa ficticia de prueba en Girona", propertyType: "CASA", price: "160000" }));
    await published(home({ title: "Piso ficticio en alquiler en Girona", operation: "RENT", price: "900", rentalType: "HABITUAL", depositMonths: "1", checkLegalRent: "on" }));
    await published(home({ title: "Piso ficticio en venta en Barcelona", provinceCode: "08", municipality: "Barcelona" }));
    const draft = await m.listings.createListing(admin, home({ title: "Piso ficticio en borrador (no publicado)" }));

    const before = await m.prisma.listing.findMany({ orderBy: { id: "asc" } });
    const req = await m.search.submitSearchRequest(request());
    const r = await m.prisma.searchRequest.findUniqueOrThrow({ where: { id: req.id } });
    const results = await m.matching.findMatches(r);

    const refs = results.map((x) => x.listing.id);
    expect(refs).toContain(fits.id);
    expect(refs).toContain(cheapNoData.id);
    expect(refs).toContain(penthouse.id);
    expect(refs).not.toContain(draft.id);
    expect(results.every((x) => x.listing.operation === "SALE" && x.listing.provinceCode === "17" && x.listing.price <= 200000)).toBe(true);
    expect(results.some((x) => x.listing.propertyType === "CASA")).toBe(false);
    expect(results).toHaveLength(3);

    const best = results[0];
    expect(best.listing.id).toBe(fits.id);
    expect(best.full).toBe(true);
    expect(best.score).toBe(100);
    expect(best.url).toMatch(/^\/inmueble\//);

    const noData = results.find((x) => x.listing.id === cheapNoData.id)!;
    expect(noData.full).toBe(false);
    expect(noData.checks.find((c) => c.label === "Habitaciones")).toMatchObject({ result: "unknown", detail: "No consta en el anuncio" });
    expect(noData.checks.find((c) => c.label === "Terraza")).toMatchObject({ result: "unknown" });

    const atico = results.find((x) => x.listing.id === penthouse.id)!;
    expect(atico.full).toBe(false);
    expect(atico.checks.find((c) => c.label === "Tipo")).toMatchObject({ result: "no" });

    // Los anuncios no se modifican
    expect(await m.prisma.listing.findMany({ orderBy: { id: "asc" } })).toEqual(before);
  });

  it("municipios: ignora acentos, artículos y el formato del INE", () => {
    const n = m.catalog.normalizeMunicipality;
    expect(n("L'Hospitalet de Llobregat")).toBe(n("Hospitalet de Llobregat, L'"));
    expect(n("Sant Feliu de Guíxols")).toBe(n("sant feliu de guixols"));
    expect(n("La Bisbal d'Empordà")).toBe(n("Bisbal d'Empordà, La"));
    expect(n("Girona")).not.toBe(n("Salt"));
  });
});

describe("«Busco comprar»: otros tipos de inmueble", () => {
  it("un garaje no guarda habitaciones ni preferencias de vivienda; un amarre no guarda superficie", async () => {
    const g = await m.search.submitSearchRequest(request({ propertyType: "GARAJE", maxPrice: 30000, minBedrooms: 3, terrace: "YES", minArea: 12 }));
    const garage = await m.prisma.searchRequest.findUniqueOrThrow({ where: { id: g.id } });
    expect(garage).toMatchObject({ propertyType: "GARAJE", minBedrooms: null, terrace: "ANY", minArea: 12 });
    const a = await m.search.submitSearchRequest(request({ propertyType: "AMARRE", maxPrice: 80000, minArea: 20 }));
    expect(await m.prisma.searchRequest.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ propertyType: "AMARRE", minArea: null, minBedrooms: null });
    await m.prisma.searchRequest.deleteMany();
  });

  it("amarres: solo propone amarres; oficinas y naves: tipos reales del anuncio, sin inventar", async () => {
    const mooring = await published({
      category: "MOORING",
      operation: "SALE",
      title: "Amarre ficticio de 12 x 4 m en puerto de prueba",
      description: "Descripción ficticia de prueba. Amarre en pantalán con finger, agua y electricidad, zona abrigada y fácil acceso desde el aparcamiento.",
      propertyType: "AMARRE",
      price: "60000",
      provinceCode: "17",
      municipality: "Roses",
      portName: "Port Ficticio de Roses",
      berthLength: "12",
      berthWidth: "4",
      mooringType: "FINGER",
      features: ["WATER"],
      authorizationType: "OWNER_SIGNED",
      authorizationDate: "2026-10-01",
      checkData: "on",
      checkAuthorization: "on",
    });
    await published(home({ title: "Piso ficticio en Roses para comprobar amarres", municipality: "Roses", price: "50000" }));
    const office = await published(home({ title: "Oficina ficticia de prueba en Roses", propertyType: "OFICINA", municipality: "Roses", price: "90000", bedrooms: "", features: [] }));
    const shop = await published(home({ title: "Local ficticio de prueba en Roses", propertyType: "LOCAL", municipality: "Roses", price: "95000", bedrooms: "", features: [] }));

    const find = async (over: Record<string, unknown>) => {
      const { id } = await m.search.submitSearchRequest(request({ municipalities: ["Roses"], ...over }));
      return m.matching.findMatches(await m.prisma.searchRequest.findUniqueOrThrow({ where: { id } }));
    };
    const moorings = await find({ propertyType: "AMARRE", maxPrice: 80000 });
    expect(moorings.map((x) => x.listing.id)).toEqual([mooring.id]);
    expect(moorings[0].url).toMatch(/^\/amarre\//);

    const offices = await find({ propertyType: "OFICINA", maxPrice: 100000 });
    expect(offices.map((x) => x.listing.id).sort()).toEqual([office.id, shop.id].sort());
    expect(offices[0].listing.id).toBe(office.id);
    expect(offices[0].full).toBe(true);

    const naves = await find({ propertyType: "NAVE", maxPrice: 100000 });
    expect(naves.map((x) => x.listing.id)).toEqual([shop.id]);
    expect(naves[0].checks.find((c) => c.label === "Tipo")).toMatchObject({ result: "unknown" });
    expect(naves[0].full).toBe(false);
  });
});
