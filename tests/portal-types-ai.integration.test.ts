// Tipos de inmueble, filtros por categoría, duplicar, SEO, contacto e IA de redacción, con una base de
// datos SQLite propia (prisma/test-types.db). Todos los datos son FICTICIOS. La IA se sustituye en estas
// pruebas por respuestas fijas (nunca se llama al proveedor real desde las pruebas).
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const DB_FILE = path.join(__dirname, "..", "prisma", "test-types.db");
process.env.DATABASE_URL = `file:${DB_FILE}`;
const UPLOADS = mkdtempSync(path.join(os.tmpdir(), "fincalia-types-"));
process.env.UPLOAD_DIR = UPLOADS;
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;

const claudeReply = vi.fn();
vi.mock("@/services/ai/claudeClient", async (orig) => ({ ...(await orig<typeof import("@/services/ai/claudeClient")>()), claudeReply }));

type Mods = {
  prisma: typeof import("@/db/client").prisma;
  listings: typeof import("@/services/listings/listings");
  ai: typeof import("@/services/listings/aiCopy");
  seo: typeof import("@/services/listings/seo");
  contact: typeof import("@/services/contactMessages");
};
let m: Mods;
const admin = { kind: "admin" as const, id: "admin-test" };

const DESC = "Descripción ficticia de prueba con datos reales del inmueble, suficientemente larga para poder publicarla en el portal sin problemas.";
const common = (over: Record<string, unknown>) => ({
  operation: "SALE",
  title: "Anuncio ficticio de prueba",
  description: DESC,
  price: "100000",
  provinceCode: "08",
  municipality: "Terrassa",
  authorizationType: "OWNER_SIGNED",
  authorizationDate: "2026-10-01",
  checkData: "on",
  checkAuthorization: "on",
  ...over,
});
const SAMPLES: Record<string, Record<string, unknown>> = {
  pisos: { propertyType: "PISO", builtArea: "80", bedrooms: "3", bathrooms: "2", energyRating: "E", checkEnergy: "on", features: ["ELEVATOR", "TERRACE"], condition: "GOOD" },
  casas: { propertyType: "CHALET", builtArea: "220", bedrooms: "4", bathrooms: "3", energyRating: "D", checkEnergy: "on", features: ["GARDEN", "POOL"] },
  locales: { propertyType: "LOCAL", builtArea: "120", bathrooms: "1", distribution: "Planta diáfana con almacén", energyRating: "IN_PROGRESS", checkEnergy: "on", features: ["SHOP_WINDOW", "STREET_LEVEL"] },
  oficinas: { propertyType: "OFICINA", builtArea: "90", energyRating: "C", checkEnergy: "on", features: ["MEETING_ROOM", "AC"] },
  garajes: { propertyType: "GARAJE", berthLength: "5", berthWidth: "2,5", floor: "-1", features: ["AUTO_DOOR", "EV_CHARGER"] },
  terrenos: { propertyType: "TERRENO", builtArea: "1500", landClassification: "URBAN", landUse: "RESIDENTIAL", features: ["WATER_SUPPLY"] },
  amarres: { category: "MOORING", propertyType: "AMARRE", portName: "Port Ficticio", berthLength: "10", berthWidth: "3,5", features: ["WATER"] },
  otros: { propertyType: "OTRO", builtArea: "40", features: [] },
};
const rentExtra = (group: string) =>
  group === "pisos" || group === "casas"
    ? { rentalType: "HABITUAL", depositMonths: "1", checkLegalRent: "on" }
    : group === "amarres"
      ? { rentPeriod: "MONTH" }
      : { depositMonths: "2" };

async function jpeg() {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: 900, height: 600, channels: 3, background: "#5b7a8c" } }).jpeg().toBuffer();
}

async function publish(raw: Record<string, unknown>) {
  const l = await m.listings.createListing(admin, raw);
  await m.listings.addPhoto(admin, l.id, await jpeg());
  await m.listings.transitionListing(admin, l.id, "publish");
  return m.prisma.listing.findUniqueOrThrow({ where: { id: l.id } });
}

beforeAll(async () => {
  for (const f of [DB_FILE, `${DB_FILE}-journal`]) if (existsSync(f)) rmSync(f);
  execSync("npx prisma db push --skip-generate", { env: { ...process.env, DATABASE_URL: `file:${DB_FILE}` }, stdio: "ignore" });
  m = {
    prisma: (await import("@/db/client")).prisma,
    listings: await import("@/services/listings/listings"),
    ai: await import("@/services/listings/aiCopy"),
    seo: await import("@/services/listings/seo"),
    contact: await import("@/services/contactMessages"),
  };
}, 120_000);

afterAll(async () => {
  await m?.prisma.$disconnect();
  rmSync(UPLOADS, { recursive: true, force: true });
});

describe("todos los tipos de inmueble, en venta y en alquiler", () => {
  for (const [group, sample] of Object.entries(SAMPLES)) {
    it(`${group}: se publica en venta y en alquiler`, async () => {
      const sale = await publish(common({ ...sample, title: `Prueba ${group} en venta` }));
      const rent = await publish(common({ ...sample, ...rentExtra(group), operation: "RENT", price: "900", title: `Prueba ${group} en alquiler` }));
      expect(sale.status).toBe("PUBLISHED");
      expect(rent.status).toBe("PUBLISHED");
      expect(sale.category).toBe(group === "amarres" ? "MOORING" : "HOME");
    });
  }

  it("ningún tipo se puede publicar fuera de Cataluña", async () => {
    for (const sample of Object.values(SAMPLES)) {
      await expect(m.listings.createListing(admin, common({ ...sample, provinceCode: "46", municipality: "Valencia" }))).rejects.toThrow(/Cataluña/);
    }
  });
});

describe("cada tipo guarda y exige solo sus campos", () => {
  it("un garaje no guarda habitaciones ni certificado energético; sí sus medidas", async () => {
    const l = await m.listings.createListing(admin, common({ ...SAMPLES.garajes, bedrooms: "3", energyRating: "A", landClassification: "URBAN" }));
    expect(l.bedrooms).toBeNull();
    expect(l.energyRating).toBeNull();
    expect(l.landClassification).toBeNull();
    expect(l.berthWidth).toBe(2.5);
    expect(m.listings.publishProblems(l, 1).join(" ")).not.toMatch(/energética/);
  });

  it("un local exige el certificado energético y guarda la distribución; una vivienda no", async () => {
    const local = await m.listings.createListing(admin, common({ ...SAMPLES.locales, energyRating: "", checkEnergy: "" }));
    expect(m.listings.publishProblems(local, 1).join(" ")).toMatch(/energética/);
    expect(local.distribution).toBe("Planta diáfana con almacén");
    const piso = await m.listings.createListing(admin, common({ ...SAMPLES.pisos, distribution: "No debería guardarse" }));
    expect(piso.distribution).toBeNull();
  });

  it("un terreno guarda su clasificación y su uso; no admite características de vivienda", async () => {
    const t = await m.listings.createListing(admin, common(SAMPLES.terrenos));
    expect(t.landClassification).toBe("URBAN");
    expect(t.bathrooms).toBeNull();
    await expect(m.listings.createListing(admin, common({ ...SAMPLES.terrenos, features: ["ELEVATOR"] }))).rejects.toThrow(/no válida para este tipo/);
  });

  it("el formulario deduce la sección: el tipo «Amarre» va a amarres", () => {
    const fd = new FormData();
    fd.set("propertyType", "AMARRE");
    expect(m.listings.listingFormToObject(fd).category).toBe("MOORING");
    fd.set("propertyType", "LOCAL");
    expect(m.listings.listingFormToObject(fd).category).toBe("HOME");
  });
});

describe("filtros por tipo", () => {
  it("grupo, estado, clasificación, uso y baños", async () => {
    const refs = (r: Awaited<ReturnType<typeof m.listings.searchPublic>>) => r.items.map((i) => i.propertyType);
    expect(new Set(refs(await m.listings.searchPublic("SALE", { grupo: "locales" })))).toEqual(new Set(["LOCAL"]));
    expect(new Set(refs(await m.listings.searchPublic("SALE", { grupo: "pisos" })))).toEqual(new Set(["PISO"]));
    expect(new Set(refs(await m.listings.searchPublic("SALE", { grupo: "terrenos", clas: "URBAN", uso: "RESIDENTIAL" })))).toEqual(new Set(["TERRENO"]));
    expect((await m.listings.searchPublic("SALE", { grupo: "terrenos", clas: "RUSTIC" })).total).toBe(0);
    expect(refs(await m.listings.searchPublic("SALE", { estado: "GOOD" }))).toContain("PISO");
    expect(refs(await m.listings.searchPublic("SALE", { car: "EV_CHARGER" }))).toEqual(["GARAJE"]);
    expect(m.listings.parseSearch({ grupo: "no-existe" }).grupo).toBeUndefined();
  });

  it("amarres: disponibles ya", async () => {
    const future = await publish(common({ ...SAMPLES.amarres, availableFrom: "2099-01-01", portName: "Port Futuro" }));
    const items = (await m.listings.searchPublic("SALE", { disp: "ya" }, "MOORING")).items.map((i) => i.reference);
    expect(items).not.toContain(future.reference);
  });

  it("páginas por tipo: dirección y recuento", async () => {
    expect(m.seo.groupPath("RENT", "locales")).toBe("/alquilar/locales");
    expect(m.seo.groupPath("SALE", "amarres")).toBe("/amarres/comprar");
    expect(await m.seo.groupCount("SALE", "garajes")).toBeGreaterThanOrEqual(1);
    expect(m.seo.isHomeGroup("pisos")).toBe(true);
    expect(m.seo.isHomeGroup("girona")).toBe(false);
  });
});

describe("panel: duplicar, SEO y anuncios retirados", () => {
  it("duplica como borrador con fotos propias y sin comprobaciones", async () => {
    const orig = await publish(common({ ...SAMPLES.pisos, title: "Piso original de prueba" }));
    const copy = await m.listings.duplicateListing(admin, orig.id);
    const full = await m.listings.getListing(admin, copy.id);
    expect(full.status).toBe("DRAFT");
    expect(full.title).toBe("Copia de Piso original de prueba");
    expect(full.reference).not.toBe(orig.reference);
    expect(full.checkAuthorization).toBe(false);
    expect(full.photos).toHaveLength(1);
    const origPhoto = await m.prisma.listingPhoto.findFirstOrThrow({ where: { listingId: orig.id } });
    expect(full.photos[0].key).not.toBe(origPhoto.key);
  });

  it("guarda los campos SEO y usa el texto de la dirección", async () => {
    const l = await m.listings.createListing(admin, common({ ...SAMPLES.pisos, seoTitle: "Piso en venta en Terrassa", seoDescription: "Descripción SEO de prueba", slugText: "Piso Venta Terrassa Céntrico" }));
    expect(l.seoTitle).toBe("Piso en venta en Terrassa");
    expect(l.slug).toBe(`piso-venta-terrassa-centrico-${l.reference.toLowerCase()}`);
  });

  it("un anuncio vendido sabe adónde redirigir; uno inexistente no", async () => {
    const l = await publish(common({ ...SAMPLES.casas, municipality: "Sabadell" }));
    await m.listings.transitionListing(admin, l.id, "close");
    expect(await m.listings.goneListingTarget(l.reference)).toEqual({ category: "HOME", operation: "SALE", municipality: "Sabadell" });
    expect(await m.listings.goneListingTarget("F360-ZZZZZZ")).toBeNull();
  });
});

describe("IA de redacción de anuncios", () => {
  const raw = common({ ...SAMPLES.pisos, municipality: "Girona", provinceCode: "17", zone: "Eixample", price: "245000", description: "piso luminoso, cerca del centro" });
  const reply = (obj: Record<string, string>) => ({ text: JSON.stringify(obj), inputTokens: 500, outputTokens: 300 });

  beforeEach(() => {
    claudeReply.mockReset();
    process.env.ANTHROPIC_API_KEY = "clave-ficticia-de-prueba";
    process.env.AI_LISTING_DAILY_LIMIT = "60";
  });

  it("sin clave configurada no se simula nada: se redacta a mano", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await m.ai.generateListingCopy({ raw, mode: "ALL", adminId: "admin-test" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/a mano/);
    expect(claudeReply).not.toHaveBeenCalled();
  });

  it("los datos que recibe la IA son solo los del anuncio y de su tipo", () => {
    const facts = m.ai.listingFacts(common({ ...SAMPLES.garajes, bedrooms: "3", municipality: "Terrassa" }));
    expect(facts["Tipo"]).toBe("Garaje");
    expect(facts["Habitaciones"]).toBeUndefined();
    expect(facts["Largo de la plaza"]).toBe("5 m");
    expect(JSON.stringify(facts)).not.toMatch(/@|teléfono/i);
  });

  it("propone título, descripción y campos SEO editables, y registra el uso", async () => {
    claudeReply.mockResolvedValue(
      reply({
        title: "Piso en venta de 3 habitaciones en Girona",
        description: "Piso de 80 m² en el Eixample de Girona, con 3 habitaciones y 2 baños.\n\nDispone de ascensor y terraza. Precio: 245.000 €.",
        seoTitle: "Piso en venta en Girona · 3 habitaciones",
        seoDescription: "Piso de 3 habitaciones y 2 baños en el Eixample de Girona, con ascensor y terraza.",
        slugText: "Piso Venta 3 Habitaciones Girona",
      }),
    );
    const r = await m.ai.generateListingCopy({ raw, mode: "ALL", adminId: "admin-test" });
    expect(r.ok).toBe(true);
    expect(r.copy?.title).toBe("Piso en venta de 3 habitaciones en Girona");
    expect(r.copy?.slugText).toBe("piso-venta-3-habitaciones-girona");
    expect(r.warnings).toEqual([]);
    const prompt = claudeReply.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toMatch(/Municipio: Girona/);
    expect(prompt).toMatch(/Texto del anunciante: piso luminoso/);
    expect(await m.prisma.aiUsage.count({ where: { ok: true } })).toBeGreaterThanOrEqual(1);
  });

  it("avisa si el texto menciona cifras que no están en los datos (posible invención)", async () => {
    claudeReply.mockResolvedValue(reply({ title: "Piso en venta en Girona", description: "Piso de 120 m² a 5 minutos de la playa, con 3 habitaciones." }));
    const r = await m.ai.generateListingCopy({ raw, mode: "ALL", adminId: "admin-test" });
    expect(r.ok).toBe(true);
    expect(r.warnings?.[0]).toMatch(/120/);
    expect(r.warnings?.[0]).toMatch(/5/);
  });

  it("el prompt prohíbe inventar datos", async () => {
    claudeReply.mockResolvedValue(reply({ title: "Piso en venta en Girona" }));
    await m.ai.generateListingCopy({ raw, mode: "TITLE", adminId: "admin-test" });
    const system = claudeReply.mock.calls[0][0].system as string;
    expect(system).toMatch(/No inventes nada/);
    expect(system).toMatch(/No prometas posiciones en Google/);
  });

  it("si la IA falla o responde mal, se informa y se puede redactar a mano", async () => {
    claudeReply.mockResolvedValue({ text: "esto no es JSON", inputTokens: 10, outputTokens: 5 });
    const bad = await m.ai.generateListingCopy({ raw, mode: "ALL", adminId: "admin-test" });
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/no ha devuelto un texto válido/);
    claudeReply.mockRejectedValue(new Error("HTTP 529 overloaded"));
    const down = await m.ai.generateListingCopy({ raw, mode: "ALL", adminId: "admin-test" });
    expect(down.ok).toBe(false);
    expect(down.error).toMatch(/a mano/);
    expect(await m.prisma.aiUsage.count({ where: { ok: false } })).toBeGreaterThanOrEqual(2);
  });

  it("respeta el límite diario de usos", async () => {
    process.env.AI_LISTING_DAILY_LIMIT = "1";
    const r = await m.ai.generateListingCopy({ raw, mode: "ALL", adminId: "admin-test" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/límite diario/);
    expect(claudeReply).not.toHaveBeenCalled();
  });
});

describe("formulario de contacto", () => {
  it("guarda el mensaje con el consentimiento; sin consentimiento no", async () => {
    const msg = await m.contact.submitContactMessage({ name: "Persona Ficticia", email: "Ficticia@Example.com", message: "Mensaje de prueba ficticio", privacy: true, elapsedMs: 5000 });
    expect(msg.email).toBe("ficticia@example.com");
    expect(msg.consentText).toMatch(/política de privacidad/);
    await expect(m.contact.submitContactMessage({ name: "Persona Ficticia", email: "f@example.com", message: "Mensaje de prueba ficticio", privacy: false })).rejects.toThrow(/privacidad/);
    await expect(m.contact.submitContactMessage({ name: "Bot", email: "b@example.com", message: "Mensaje de prueba ficticio", privacy: true, website: "spam" })).rejects.toThrow();
  });
});
