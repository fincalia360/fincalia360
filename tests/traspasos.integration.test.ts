// Traspaso de negocios: alta, validación, publicación, búsqueda pública y solicitudes de propietarios.
// Base de datos SQLite propia (prisma/test-traspasos.db). Todos los datos son FICTICIOS.
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB_FILE = path.join(__dirname, "..", "prisma", "test-traspasos.db");
process.env.DATABASE_URL = `file:${DB_FILE}`;
const UPLOADS = mkdtempSync(path.join(os.tmpdir(), "fincalia-traspasos-"));
process.env.UPLOAD_DIR = UPLOADS;
delete process.env.RESEND_API_KEY;

type Mods = {
  prisma: typeof import("@/db/client").prisma;
  listings: typeof import("@/services/listings/listings");
  requests: typeof import("@/services/listings/publicationRequests");
  catalog: typeof import("@/services/listings/catalog");
};
let m: Mods;
const admin = { kind: "admin" as const, id: "admin-test" };

const business = (over: Record<string, unknown> = {}) => ({
  category: "BUSINESS",
  operation: "TRANSFER",
  title: "Traspaso ficticio de cafetería con terraza",
  description: "Descripción ficticia de prueba. Cafetería en funcionamiento con terraza, cocina equipada, clientela fija y licencia de actividad en vigor.",
  propertyType: "NEG_CAFETERIA",
  price: "45000",
  premisesRent: "1200",
  provinceCode: "17",
  municipality: "Girona",
  builtArea: "80",
  bathrooms: "2",
  features: ["ACTIVITY_LICENSE", "TERRACE_LICENSE"],
  extraInfo: "Horario de 7 a 20 h. Motivo del traspaso: jubilación (dato ficticio).",
  authorizationType: "OWNER_SIGNED",
  authorizationDate: "2026-10-01",
  checkData: "on",
  checkAuthorization: "on",
  ...over,
});

async function jpeg() {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: 800, height: 600, channels: 3, background: "#3a7ca5" } }).jpeg().toBuffer();
}

async function published(raw: Record<string, unknown>) {
  const l = await m.listings.createListing(admin, raw);
  await m.listings.addPhoto(admin, l.id, await jpeg());
  return m.listings.transitionListing(admin, l.id, "publish");
}

beforeAll(async () => {
  for (const f of [DB_FILE, `${DB_FILE}-journal`]) if (existsSync(f)) rmSync(f);
  execSync("npx prisma db push --skip-generate", { env: { ...process.env, DATABASE_URL: `file:${DB_FILE}` }, stdio: "ignore" });
  m = {
    prisma: (await import("@/db/client")).prisma,
    listings: await import("@/services/listings/listings"),
    requests: await import("@/services/listings/publicationRequests"),
    catalog: await import("@/services/listings/catalog"),
  };
}, 120_000);

afterAll(async () => {
  await m?.prisma.$disconnect();
  rmSync(UPLOADS, { recursive: true, force: true });
});

describe("traspasos: alta y validación", () => {
  it("guarda el precio del traspaso y el alquiler del local por separado, sin datos de vivienda", async () => {
    const l = await m.listings.createListing(admin, business({ bedrooms: "3", energyRating: "D" }));
    expect(l).toMatchObject({ category: "BUSINESS", operation: "TRANSFER", price: 45000, premisesRent: 1200, bedrooms: null, energyRating: null, status: "DRAFT" });
    expect(l.slug).toMatch(/^traspaso-cafeteria-girona-f360-/);
    expect(m.catalog.listingPath(l)).toMatch(/^\/traspaso\//);
  });

  it("no mezcla traspasos con venta o alquiler", async () => {
    await expect(m.listings.createListing(admin, business({ operation: "SALE" }))).rejects.toThrow(/traspaso/);
    await expect(m.listings.createListing(admin, business({ propertyType: "PISO" }))).rejects.toThrow(/traspaso/);
    await expect(m.listings.createListing(admin, business({ features: ["POOL"] }))).rejects.toThrow(/negocio/);
    // El formulario del panel fija la categoría y la operación a partir del tipo elegido
    const fd = new FormData();
    for (const [k, v] of Object.entries(business({ category: "", operation: "SALE", features: undefined }))) if (v !== undefined) fd.set(k, String(v));
    expect(m.listings.listingFormToObject(fd)).toMatchObject({ category: "BUSINESS", operation: "TRANSFER" });
    const home = new FormData();
    home.set("propertyType", "PISO");
    home.set("operation", "TRANSFER");
    expect(m.listings.listingFormToObject(home)).toMatchObject({ category: "HOME", operation: "SALE" });
  });

  it("para publicar exige descripción, precio, foto y autorización (no certificado energético)", async () => {
    const l = await m.listings.createListing(admin, business({ checkAuthorization: "" }));
    const problems = m.listings.publishProblems(l, 0).join(" | ");
    expect(problems).toMatch(/fotografía/);
    expect(problems).toMatch(/autorización del titular del negocio/);
    expect(problems).not.toMatch(/energ/);
  });
});

describe("traspasos: web pública", () => {
  it("solo aparecen en /traspasos, con filtros por provincia, población, categoría y precio", async () => {
    const cafe = await published(business());
    const bar = await published(business({ title: "Traspaso ficticio de bar de tapas en Reus", propertyType: "NEG_BAR_RESTAURANTE", price: "90000", provinceCode: "43", municipality: "Reus" }));
    const shop = await published(business({ title: "Traspaso ficticio de tienda de ropa en Girona", propertyType: "NEG_COMERCIO", price: "20000", features: [] }));

    const all = await m.listings.searchTransfers({});
    expect(all.items.map((i) => i.reference).sort()).toEqual([cafe.reference, bar.reference, shop.reference].sort());
    expect((await m.listings.searchTransfers({ provincia: "43" })).items.map((i) => i.reference)).toEqual([bar.reference]);
    expect((await m.listings.searchTransfers({ municipio: "Girona" })).total).toBe(2);
    expect((await m.listings.searchTransfers({ categoria: "NEG_CAFETERIA" })).items.map((i) => i.reference)).toEqual([cafe.reference]);
    expect((await m.listings.searchTransfers({ min: 30000, max: 60000 })).items.map((i) => i.reference)).toEqual([cafe.reference]);
    expect((await m.listings.searchTransfers({ orden: "precio-asc" })).items[0].reference).toBe(shop.reference);
    expect(all.places.find((p) => p.municipality === "Girona")?.count).toBe(2);

    // No se mezclan con venta ni alquiler de inmuebles
    expect((await m.listings.searchPublic("SALE", {})).total).toBe(0);
    expect((await m.listings.searchPublic("RENT", {})).total).toBe(0);

    const pub = await m.listings.getPublicListing(cafe.reference, "BUSINESS");
    expect(pub?.premisesRent).toBe(1200);
    expect(pub).not.toHaveProperty("address");

    // Retirado: deja de verse
    await m.listings.transitionListing(admin, cafe.id, "unpublish");
    expect(await m.listings.getPublicListing(cafe.reference, "BUSINESS")).toBeNull();
    expect((await m.listings.searchTransfers({})).total).toBe(2);
  });

  it("un propietario envía su negocio desde «Publica gratis» y el administrador crea el borrador", async () => {
    const base = {
      category: "BUSINESS",
      operation: "TRANSFER",
      propertyType: "NEG_ESTETICA",
      title: "Centro de estética ficticio",
      provinceCode: "08",
      municipality: "Sabadell",
      price: "30000",
      premisesRent: "900",
      builtArea: "60",
      description: "Centro de estética ficticio de prueba con dos cabinas.",
      name: "Persona Ficticia",
      email: "ficticia@example.com",
      isOwner: "on",
      privacy: "on",
      elapsedMs: "9000",
    };
    await expect(m.requests.submitPublicationRequest({ ...base, operation: "SALE" }, [])).rejects.toThrow(/traspaso/);
    await expect(m.requests.submitPublicationRequest({ ...base, propertyType: "PISO" }, [])).rejects.toThrow(/categoría del negocio/);
    await expect(m.requests.submitPublicationRequest({ ...base, category: "HOME", propertyType: "PISO" }, [])).rejects.toThrow(/vender o alquilar/);

    const r = await m.requests.submitPublicationRequest(base, [await jpeg()]);
    const saved = await m.prisma.publicationRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(saved).toMatchObject({ category: "BUSINESS", operation: "TRANSFER", title: "Centro de estética ficticio", premisesRent: 900, bedrooms: null, status: "NEW" });

    const listing = await m.requests.convertPublicationRequest(admin.id, r.id, { title: "Traspaso de centro de estética en Sabadell", price: 30000 });
    expect(listing).toMatchObject({ category: "BUSINESS", operation: "TRANSFER", status: "DRAFT", premisesRent: 900, propertyType: "NEG_ESTETICA" });
    expect(await m.prisma.listingPhoto.count({ where: { listingId: listing.id } })).toBe(1);
  });
});
