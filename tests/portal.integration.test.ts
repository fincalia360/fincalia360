// Portal inmobiliario y Zona inmobiliarias con una base de datos SQLite propia (prisma/test-portal.db).
// Todos los datos son FICTICIOS. Lo más importante: ninguna inmobiliaria puede leer ni tocar datos de otra.
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB_FILE = path.join(__dirname, "..", "prisma", "test-portal.db");
process.env.DATABASE_URL = `file:${DB_FILE}`;
const UPLOADS = mkdtempSync(path.join(os.tmpdir(), "fincalia-uploads-"));
process.env.UPLOAD_DIR = UPLOADS;
process.env.SITE_URL = "https://fincalia360.test";
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;

type Mods = {
  prisma: typeof import("@/db/client").prisma;
  listings: typeof import("@/services/listings/listings");
  inquiries: typeof import("@/services/listings/inquiries");
  auth: typeof import("@/services/agency/auth");
  accounts: typeof import("@/services/agency/accounts");
  crm: typeof import("@/services/agency/crm");
  password: typeof import("@/lib/password");
};
let m: Mods;
let agencyA: string;
let agencyB: string;
const admin = { kind: "admin" as const, id: "admin-test" };
const actorA = () => ({ kind: "agency" as const, agencyId: agencyA, userId: "user-a", userName: "Agente A (ficticio)" });
const actorB = () => ({ kind: "agency" as const, agencyId: agencyB, userId: "user-b", userName: "Agente B (ficticio)" });

const baseListing = (over: Record<string, unknown> = {}) => ({
  operation: "SALE",
  title: "Piso ficticio de prueba con terraza",
  description: "Descripción ficticia de prueba para el portal. Piso luminoso con terraza, cocina equipada y ascensor, cerca de servicios.",
  propertyType: "PISO",
  price: "250000",
  provinceCode: "17",
  municipality: "Girona",
  zone: "Centro",
  postalCode: "17001",
  builtArea: "90",
  bedrooms: "3",
  bathrooms: "2",
  features: ["ELEVATOR", "TERRACE"],
  energyRating: "D",
  authorizationType: "MANDATE_SHARED",
  authorizationDate: "2026-10-01",
  checkData: "on",
  checkAuthorization: "on",
  checkEnergy: "on",
  ...over,
});

async function tinyJpeg() {
  const sharp = (await import("sharp")).default;
  // Imagen con metadatos EXIF (incluido GPS ficticio) para comprobar que se eliminan
  return sharp({ create: { width: 1200, height: 900, channels: 3, background: "#88aacc" } })
    .jpeg()
    .withExif({ IFD0: { Make: "CamaraFicticia" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 59/1 0/1" } })
    .toBuffer();
}

async function publishableListing(actor: ReturnType<typeof actorA> | typeof admin, over: Record<string, unknown> = {}) {
  const l = await m.listings.createListing(actor, baseListing(over));
  await m.listings.addPhoto(actor, l.id, await tinyJpeg());
  return l;
}

beforeAll(async () => {
  for (const f of [DB_FILE, `${DB_FILE}-journal`]) if (existsSync(f)) rmSync(f);
  execSync("npx prisma db push --skip-generate", { env: { ...process.env, DATABASE_URL: `file:${DB_FILE}` }, stdio: "ignore" });
  m = {
    prisma: (await import("@/db/client")).prisma,
    listings: await import("@/services/listings/listings"),
    inquiries: await import("@/services/listings/inquiries"),
    auth: await import("@/services/agency/auth"),
    accounts: await import("@/services/agency/accounts"),
    crm: await import("@/services/agency/crm"),
    password: await import("@/lib/password"),
  };
  const mk = (name: string) =>
    m.prisma.agency.create({ data: { name, zones: "", email: `${name.toLowerCase().replace(/\W/g, "")}@example.com`, phone: "600000000", languages: "es", propertyTypes: "", crmAccess: true, maxListings: 3, maxUsers: 2 } });
  agencyA = (await mk("Inmobiliaria Ficticia A")).id;
  agencyB = (await mk("Inmobiliaria Ficticia B")).id;
}, 120_000);

afterAll(async () => {
  await m?.prisma.$disconnect();
  rmSync(UPLOADS, { recursive: true, force: true });
});

describe("contraseñas y tokens", () => {
  it("verifica la contraseña correcta y rechaza la incorrecta; aplica la política", async () => {
    const hash = await m.password.hashPassword("ClaveFicticia123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await m.password.verifyPassword("ClaveFicticia123", hash)).toBe(true);
    expect(await m.password.verifyPassword("otra-clave-1", hash)).toBe(false);
    expect(m.password.passwordProblem("corta1")).toMatch(/10 caracteres/);
    expect(m.password.passwordProblem("solamenteletras")).toMatch(/letras y números/);
    expect(m.password.passwordProblem("BuenaClave2026")).toBeNull();
  });
});

describe("inmuebles: publicación con comprobaciones", () => {
  it("crea un borrador con referencia y dirección clara", async () => {
    const l = await m.listings.createListing(admin, baseListing());
    expect(l.status).toBe("DRAFT");
    expect(l.reference).toMatch(/^F360-[A-Z0-9]{6}$/);
    expect(l.slug).toBe(`piso-venta-3-habitaciones-girona-${l.reference.toLowerCase()}`);
    expect((await import("@/services/listings/catalog")).referenceFromSlug(l.slug)).toBe(l.reference);
  });

  it("no se puede publicar sin foto, ni sin autorización, ni sin certificado energético", async () => {
    const l = await m.listings.createListing(admin, baseListing({ checkAuthorization: "", energyRating: "" }));
    await expect(m.listings.transitionListing(admin, l.id, "publish")).rejects.toThrow(/Antes de publicar/);
    const full = await m.listings.getListing(admin, l.id);
    const problems = m.listings.publishProblems(full, 0);
    expect(problems.join(" ")).toMatch(/fotografía/);
    expect(problems.join(" ")).toMatch(/calificación energética/);
    expect(problems.join(" ")).toMatch(/autorización del propietario/);
  });

  it("alquiler de temporada exige el número de registro y la revisión de la normativa", async () => {
    const l = await publishableListing(admin, { operation: "RENT", price: "1200", rentalType: "SEASONAL", depositMonths: "1" });
    const full = await m.listings.getListing(admin, l.id);
    const problems = m.listings.publishProblems(full, full.photos.length).join(" ");
    expect(problems).toMatch(/Registro Único de Arrendamientos/);
    expect(problems).toMatch(/normativa de alquiler/);
  });

  it("el administrador publica cuando todo está completo; la foto se guarda sin metadatos", async () => {
    const l = await publishableListing(admin);
    const published = await m.listings.transitionListing(admin, l.id, "publish");
    expect(published.status).toBe("PUBLISHED");
    const pub = await m.listings.getPublicListing(l.reference);
    expect(pub?.reference).toBe(l.reference);
    // La web pública nunca recibe la dirección exacta ni la referencia catastral
    expect(pub).not.toHaveProperty("address");
    expect(pub).not.toHaveProperty("cadastralRef");
    expect(pub).not.toHaveProperty("authorizationDoc");
    const photo = (await m.prisma.listingPhoto.findFirstOrThrow({ where: { listingId: l.id } })).key;
    const sharp = (await import("sharp")).default;
    const { getFile } = await import("@/services/storage/storage");
    const meta = await sharp((await getFile(photo))!).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect((await m.listings.isPublicPhoto(photo)).isPublic).toBe(true);
  });

  it("rechaza archivos que no son imágenes", async () => {
    const l = await m.listings.createListing(admin, baseListing());
    await expect(m.listings.addPhoto(admin, l.id, Buffer.from("esto no es una imagen"))).rejects.toThrow(/imagen válida/);
  });

  it("solo se eliminan borradores; un vendido no aparece en la web", async () => {
    const l = await publishableListing(admin);
    await m.listings.transitionListing(admin, l.id, "publish");
    await expect(m.listings.deleteListing(admin, l.id)).rejects.toThrow(/Solo se pueden eliminar borradores/);
    await m.listings.transitionListing(admin, l.id, "close");
    expect(await m.listings.getPublicListing(l.reference)).toBeNull();
  });
});

describe("inmobiliarias: revisión y aislamiento", () => {
  it("una inmobiliaria no puede publicar: envía a revisión y publica el administrador", async () => {
    const l = await publishableListing(actorA());
    expect(m.listings.availableTransitions(actorA(), "DRAFT")).not.toContain("publish");
    await expect(m.listings.transitionListing(actorA(), l.id, "publish")).rejects.toThrow(/no está disponible/);
    expect((await m.listings.transitionListing(actorA(), l.id, "submit")).status).toBe("REVIEW");
    expect(await m.listings.getPublicListing(l.reference)).toBeNull();
    expect((await m.listings.transitionListing(admin, l.id, "publish")).status).toBe("PUBLISHED");
    // Si la inmobiliaria cambia el anuncio publicado, vuelve a revisión y deja de verse
    const { backToReview } = await m.listings.updateListing(actorA(), l.id, baseListing({ price: "240000" }));
    expect(backToReview).toBe(true);
    expect(await m.listings.getPublicListing(l.reference)).toBeNull();
  });

  it("la inmobiliaria B no puede leer, editar, publicar, borrar ni ver fotos de un inmueble de A", async () => {
    const l = await publishableListing(actorA());
    const photo = await m.prisma.listingPhoto.findFirstOrThrow({ where: { listingId: l.id } });
    await expect(m.listings.getListing(actorB(), l.id)).rejects.toThrow(/no encontrado/i);
    await expect(m.listings.updateListing(actorB(), l.id, baseListing({ price: "1" }))).rejects.toThrow(/no encontrado/i);
    await expect(m.listings.transitionListing(actorB(), l.id, "submit")).rejects.toThrow(/no encontrado/i);
    await expect(m.listings.deleteListing(actorB(), l.id)).rejects.toThrow(/no encontrado/i);
    await expect(m.listings.addPhoto(actorB(), l.id, await tinyJpeg())).rejects.toThrow(/no encontrado/i);
    await expect(m.listings.deletePhoto(actorB(), photo.id)).rejects.toThrow(/no encontrada/i);
    await expect(m.listings.setMainPhoto(actorB(), photo.id)).rejects.toThrow(/no encontrada/i);
    expect(await m.listings.canSeePhoto(actorB(), photo.key)).toBe(false);
    expect(await m.listings.canSeePhoto(actorA(), photo.key)).toBe(true);
    expect((await m.listings.listListings(actorB())).some((x) => x.id === l.id)).toBe(false);
    expect((await m.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).price).toBe(250000);
  });

  it("aplica el límite de inmuebles activos del plan", async () => {
    await m.prisma.agency.update({ where: { id: agencyB }, data: { maxListings: 1 } });
    await m.listings.createListing(actorB(), baseListing());
    await expect(m.listings.createListing(actorB(), baseListing())).rejects.toThrow(/límite de 1 inmuebles/);
    await m.prisma.agency.update({ where: { id: agencyB }, data: { maxListings: 3 } });
  });

  it("los contactos de una inmobiliaria son invisibles para otra", async () => {
    const tA = { agencyId: agencyA, userId: "user-a", userName: "Agente A" };
    const tB = { agencyId: agencyB, userId: "user-b", userName: "Agente B" };
    const c = await m.crm.createContact(tA, { kind: "BUYER", name: "Comprador Ficticio", email: "comprador.ficticio@example.com", phone: "600111222" });
    await expect(m.crm.createContact(tA, { kind: "BUYER", name: "Duplicado", email: "comprador.ficticio@example.com" })).rejects.toThrow(/Ya tienes este contacto/);
    // B puede tener su propio contacto con el mismo email (son empresas distintas)
    await m.crm.createContact(tB, { kind: "BUYER", name: "Otro Ficticio", email: "comprador.ficticio@example.com" });
    await expect(m.crm.getContact(tB, c.id)).rejects.toThrow(/no encontrado/i);
    await expect(m.crm.updateContact(tB, c.id, { kind: "BUYER", name: "Hackeado", email: "x@example.com" })).rejects.toThrow(/no encontrado/i);
    await expect(m.crm.changeContactStatus(tB, c.id, "WON")).rejects.toThrow(/no encontrado/i);
    await expect(m.crm.logActivity(tB, c.id, "CALL", "intento", new Date())).rejects.toThrow(/no encontrado/i);
    await expect(m.crm.scheduleVisit(tB, c.id, new Date(Date.now() + 86400_000), null, null)).rejects.toThrow(/no encontrado/i);
    await expect(m.crm.deleteContact(tB, c.id)).rejects.toThrow(/no encontrado/i);
    await expect(m.crm.exportContact(tB, c.id)).rejects.toThrow(/no encontrado/i);
    expect((await m.crm.listContacts(tB)).some((x) => x.id === c.id)).toBe(false);
    // Una visita no puede asociarse a un inmueble de otra inmobiliaria
    const otherListing = await m.listings.createListing(actorB(), baseListing());
    await expect(m.crm.scheduleVisit(tA, c.id, new Date(Date.now() + 86400_000), otherListing.id, null)).rejects.toThrow(/Inmueble no encontrado/);
    expect((await m.crm.getContact(tA, c.id)).name).toBe("Comprador Ficticio");
  });

  it("registrar una llamada marca el contacto como contactado y deja historial", async () => {
    const t = { agencyId: agencyA, userId: "user-a", userName: "Agente A" };
    const c = await m.crm.createContact(t, { kind: "OWNER_SELL", name: "Propietaria Ficticia", phone: "611222333" });
    await m.crm.logActivity(t, c.id, "CALL", "Primera llamada (ficticia)", new Date());
    const full = await m.crm.getContact(t, c.id);
    expect(full.status).toBe("CONTACTED");
    expect(full.activities.map((a) => a.type)).toEqual(expect.arrayContaining(["CALL", "STATUS", "SYSTEM"]));
    await expect(m.crm.logActivity(t, c.id, "CALL", "futuro", new Date(Date.now() + 86400_000))).rejects.toThrow(/futura/);
  });
});

describe("solicitudes desde la ficha pública", () => {
  it("llegan al CRM de la inmobiliaria anunciante (y solo al suyo), con consentimiento", async () => {
    const l = await publishableListing(actorA());
    await m.listings.transitionListing(actorA(), l.id, "submit");
    await m.listings.transitionListing(admin, l.id, "publish");
    const req = { name: "Interesado Ficticio", email: "interesado.ficticio@example.com", phone: "622333444", message: "¿Se puede visitar?", wantsVisit: true, consent: true, elapsedMs: 9000 };
    expect(await m.inquiries.submitInquiry(l.reference, { ...req, consent: false })).toMatchObject({ ok: false, status: 400 });
    expect(await m.inquiries.submitInquiry(l.reference, { ...req, website: "spam" })).toMatchObject({ ok: false });
    expect(await m.inquiries.submitInquiry(l.reference, req)).toEqual({ ok: true });
    const tA = { agencyId: agencyA, userId: "user-a", userName: "Agente A" };
    const tB = { agencyId: agencyB, userId: "user-b", userName: "Agente B" };
    const inq = (await m.crm.listInquiries(tA)).find((i) => i.listing.reference === l.reference)!;
    expect(inq.consentText).toContain("Inmobiliaria Ficticia A");
    expect(inq.contact).not.toBeNull();
    const contact = await m.crm.getContact(tA, inq.contact!.id);
    expect(contact.source).toBe("PORTAL");
    expect(contact.nextAction).toMatch(/quiere visitarlo/);
    expect((await m.crm.listInquiries(tB)).some((i) => i.id === inq.id)).toBe(false);
    await expect(m.crm.setInquiryStatus(tB, inq.id, "HANDLED")).rejects.toThrow(/no encontrada/i);
    // Una segunda solicitud de la misma persona no duplica el contacto
    await m.inquiries.submitInquiry(l.reference, { ...req, message: "Otra pregunta" });
    expect(await m.prisma.agencyContact.count({ where: { agencyId: agencyA, emailNormalized: req.email } })).toBe(1);
  });

  it("no se aceptan solicitudes de inmuebles no publicados", async () => {
    const l = await m.listings.createListing(admin, baseListing());
    expect(await m.inquiries.submitInquiry(l.reference, { name: "X Ficticio", email: "x@example.com", consent: true, elapsedMs: 9000 })).toMatchObject({ ok: false, status: 404 });
  });
});

describe("cuentas de la Zona inmobiliarias", () => {
  it("invitación → contraseña → acceso; bloqueo tras 5 fallos; mensajes genéricos", async () => {
    // Sin correo configurado no se simula el envío: el administrador recibe el enlace para copiarlo
    const { user, link, email } = await m.accounts.addAgencyUser("admin-test", agencyA, { name: "Responsable Ficticia", email: "responsable.ficticia@example.com", role: "OWNER" });
    expect(email.status).toBe("NOT_CONFIGURED");
    expect(link).toMatch(/^https:\/\/fincalia360\.test\/zona-inmobiliarias\/activar#/);
    const token = link.split("#")[1];
    await expect(m.auth.verifyCredentials(user.email, "ClaveFicticia2026")).rejects.toThrow(/incorrectos/);
    await expect(m.auth.consumeToken(token, "INVITE", "corta")).rejects.toThrow(/10 caracteres/);
    await m.auth.consumeToken(token, "INVITE", "ClaveFicticia2026");
    await expect(m.auth.consumeToken(token, "INVITE", "OtraClave2026x")).rejects.toThrow(/no es válido o ha caducado/);
    const ok = await m.auth.verifyCredentials("RESPONSABLE.ficticia@example.com ", "ClaveFicticia2026");
    expect(ok.agencyId).toBe(agencyA);
    // Sesión: solo se guarda el hash del token
    const { token: sessionToken } = await m.auth.createSession(ok.id);
    expect(await m.prisma.agencySession.findUnique({ where: { id: sessionToken } })).toBeNull();
    const ctx = await m.auth.sessionFromToken(sessionToken);
    expect(ctx).toMatchObject({ agencyId: agencyA, role: "OWNER" });
    // Un email que no existe da el mismo error que una contraseña mala
    await expect(m.auth.verifyCredentials("noexiste@example.com", "loquesea12")).rejects.toThrow(/Email o contraseña incorrectos/);
    for (let i = 0; i < 5; i++) await expect(m.auth.verifyCredentials(user.email, "MalaClave123")).rejects.toThrow();
    await expect(m.auth.verifyCredentials(user.email, "ClaveFicticia2026")).rejects.toThrow(/Demasiados intentos/);
    await m.prisma.agencyUser.update({ where: { id: user.id }, data: { lockedUntil: null } });
    // Al quitar el acceso a la inmobiliaria, la sesión deja de valer
    await m.accounts.setAgencyAccess("admin-test", agencyA, { crmAccess: false, maxListings: 3, maxUsers: 2 });
    expect(await m.auth.sessionFromToken(sessionToken)).toBeNull();
    await expect(m.auth.verifyCredentials(user.email, "ClaveFicticia2026")).rejects.toThrow(/no está activo/);
    await m.accounts.setAgencyAccess("admin-test", agencyA, { crmAccess: true, maxListings: 3, maxUsers: 2 });
  });

  it("respeta el límite de usuarios y no permite emails repetidos", async () => {
    await expect(m.accounts.addAgencyUser("admin-test", agencyA, { name: "Repetida", email: "responsable.ficticia@example.com", role: "AGENT" })).rejects.toThrow(/Ya existe/);
    await m.accounts.addAgencyUser("admin-test", agencyA, { name: "Agente Ficticio", email: "agente.ficticio@example.com", role: "AGENT" });
    await expect(m.accounts.addAgencyUser("admin-test", agencyA, { name: "Tercero", email: "tercero.ficticio@example.com", role: "AGENT" })).rejects.toThrow(/límite/);
  });

  it("el enlace de recuperación cambia la contraseña y cierra las sesiones abiertas", async () => {
    const user = await m.prisma.agencyUser.findUniqueOrThrow({ where: { email: "responsable.ficticia@example.com" } });
    const { token: s1 } = await m.auth.createSession(user.id);
    const link = await m.accounts.createResetLinkForUser("admin-test", agencyA, user.id);
    await m.auth.consumeToken(link.split("#")[1], "RESET", "NuevaClave2026");
    expect(await m.auth.sessionFromToken(s1)).toBeNull();
    await expect(m.auth.verifyCredentials(user.email, "ClaveFicticia2026")).rejects.toThrow();
    expect((await m.auth.verifyCredentials(user.email, "NuevaClave2026")).id).toBe(user.id);
    // Un enlace de invitación no sirve como enlace de recuperación (y al revés)
    const reset = await m.accounts.createResetLinkForUser("admin-test", agencyA, user.id);
    await expect(m.auth.consumeToken(reset.split("#")[1], "INVITE", "OtraClave2026")).rejects.toThrow(/no es válido/);
    // Un administrador no puede gestionar el usuario de A como si fuera de B
    await expect(m.accounts.createResetLinkForUser("admin-test", agencyB, user.id)).rejects.toThrow(/no encontrado/i);
  });
});
