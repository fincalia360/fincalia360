// Inmuebles del portal. Todas las operaciones reciben quién actúa (administrador o usuario de una
// inmobiliaria) y filtran SIEMPRE por la inmobiliaria de la sesión: una inmobiliaria nunca puede
// leer ni modificar inmuebles de otra, aunque cambie el identificador en la URL.
//  - El administrador publica directamente (tras pasar las comprobaciones).
//  - Una inmobiliaria envía a revisión; publica el administrador. Si edita un inmueble publicado,
//    vuelve a revisión (no se publican cambios sin revisar).
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { getProvince } from "@/services/study/geo";
import { audit, type Actor } from "@/services/audit";
import { deleteFile, newKey, putFile } from "@/services/storage/storage";
import {
  ACTIVE_STATUSES,
  PORTAL_PROVINCE_CODES,
  isPortalProvince,
  AUTHORIZATION_TYPES,
  CONDITIONS,
  ENERGY_RATINGS,
  FEATURES,
  MAX_DOC_BYTES,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  PROPERTY_TYPES,
  PUBLIC_STATUSES,
  RENTAL_TYPES,
  buildSlug,
  type ListingStatus,
} from "./catalog";

export type ListingActor = { kind: "admin"; id: string } | { kind: "agency"; agencyId: string; userId: string; userName: string };

export class ListingError extends Error {}

function auditActor(actor: ListingActor): Actor {
  return actor.kind === "admin" ? { type: "ADMIN", id: actor.id } : { type: "AGENCY_USER", id: actor.userId, agencyId: actor.agencyId };
}

/** Condición de acceso: el administrador ve todo; una inmobiliaria, solo lo suyo. */
export function scopeWhere(actor: ListingActor): Prisma.ListingWhereInput {
  return actor.kind === "admin" ? {} : { agencyId: actor.agencyId };
}

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const optInt = (max: number) =>
  z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number({ invalid_type_error: "Número no válido" }).int("Sin decimales").min(0).max(max).nullable());
const optFloat = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number({ invalid_type_error: "Número no válido" }).min(0).max(100000).nullable());
const optText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());
const optDate = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date({ invalid_type_error: "Fecha no válida" }).nullable());
const bool = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

export const listingSchema = z
  .object({
    operation: z.enum(["SALE", "RENT"], { errorMap: () => ({ message: "Indica si es venta o alquiler" }) }),
    title: z.string().trim().min(10, "El título debe tener al menos 10 caracteres").max(110),
    description: z.string().trim().max(6000).default(""),
    propertyType: z.enum(keys(PROPERTY_TYPES), { errorMap: () => ({ message: "Elige el tipo de inmueble" }) }),
    price: z.coerce.number({ invalid_type_error: "Precio no válido" }).int("Precio en euros, sin decimales").min(1, "Indica el precio").max(100_000_000),
    communityFee: optInt(100_000),
    provinceCode: z
      .string()
      .refine((c) => Boolean(getProvince(c)), "Elige la provincia")
      .refine(isPortalProvince, "Solo publicamos inmuebles en Cataluña (Barcelona, Girona, Lleida o Tarragona)"),
    municipality: z.string().trim().min(2, "Indica el municipio").max(80),
    zone: optText(80),
    postalCode: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{5}$/, "Código postal de 5 cifras").nullable().optional()),
    address: optText(160),
    cadastralRef: z.preprocess((v) => (typeof v === "string" ? v.replace(/\s/g, "").toUpperCase() || null : v), z.string().regex(/^[0-9A-Z]{14}([0-9A-Z]{6})?$/, "Referencia catastral de 14 o 20 caracteres").nullable().optional()),
    builtArea: optInt(100_000),
    usefulArea: optInt(100_000),
    bedrooms: optInt(50),
    bathrooms: optInt(50),
    floor: optText(30),
    yearBuilt: optInt(2100),
    condition: z.preprocess((v) => (v === "" ? null : v), z.enum(keys(CONDITIONS)).nullable().optional()),
    features: z.array(z.enum(keys(FEATURES))).default([]),
    energyRating: z.preprocess((v) => (v === "" ? null : v), z.enum(keys(ENERGY_RATINGS)).nullable().optional()),
    energyConsumption: optFloat,
    energyEmissions: optFloat,
    rentalType: z.preprocess((v) => (v === "" ? null : v), z.enum(keys(RENTAL_TYPES)).nullable().optional()),
    depositMonths: optInt(12),
    minTermMonths: optInt(120),
    availableFrom: optDate,
    rentConditions: optText(1500),
    rentalRegistry: optText(60),
    authorizationType: z.preprocess((v) => (v === "" ? null : v), z.enum(keys(AUTHORIZATION_TYPES)).nullable().optional()),
    authorizationDate: optDate,
    checkData: bool,
    checkAuthorization: bool,
    checkEnergy: bool,
    checkLegalRent: bool,
    ownerContactId: optText(40),
  })
  .superRefine((v, ctx) => {
    if (v.postalCode && getProvince(v.postalCode.slice(0, 2))?.code !== v.provinceCode) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: "El código postal no corresponde a la provincia elegida" });
    }
    if (v.usefulArea && v.builtArea && v.usefulArea > v.builtArea) {
      ctx.addIssue({ code: "custom", path: ["usefulArea"], message: "La superficie útil no puede ser mayor que la construida" });
    }
  });
export type ListingInput = z.infer<typeof listingSchema>;

/** Convierte el FormData del editor en un objeto para listingSchema. */
export function listingFormToObject(formData: FormData) {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && k !== "features") obj[k] = v;
  obj.features = formData.getAll("features").map(String);
  return obj;
}

function newReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  return `F360-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

function dataFromInput(input: ListingInput) {
  const { features, ownerContactId, ...rest } = input;
  void ownerContactId;
  const rent = input.operation === "RENT";
  return {
    ...rest,
    features: features.join(","),
    rentalType: rent ? (input.rentalType ?? null) : null,
    depositMonths: rent ? (input.depositMonths ?? null) : null,
    minTermMonths: rent ? (input.minTermMonths ?? null) : null,
    availableFrom: rent ? (input.availableFrom ?? null) : null,
    rentConditions: rent ? (input.rentConditions ?? null) : null,
    rentalRegistry: rent ? (input.rentalRegistry ?? null) : null,
    checkLegalRent: rent ? input.checkLegalRent : false,
  };
}

async function assertAgencyActive(actor: ListingActor) {
  if (actor.kind !== "agency") return null;
  const agency = await prisma.agency.findUnique({ where: { id: actor.agencyId } });
  if (!agency || !agency.crmAccess || agency.status !== "ACTIVE") throw new ListingError("La cuenta de la inmobiliaria no está activa");
  return agency;
}

/** El propietario asociado debe ser un contacto de la misma inmobiliaria. */
async function resolveOwnerContact(actor: ListingActor, ownerContactId: string | null | undefined) {
  if (!ownerContactId || actor.kind !== "agency") return null;
  const c = await prisma.agencyContact.findFirst({ where: { id: ownerContactId, agencyId: actor.agencyId }, select: { id: true } });
  if (!c) throw new ListingError("El contacto propietario no existe");
  return c.id;
}

export async function createListing(actor: ListingActor, raw: unknown) {
  const input = listingSchema.parse(raw);
  const agency = await assertAgencyActive(actor);
  if (agency) {
    const active = await prisma.listing.count({ where: { agencyId: agency.id, status: { in: ACTIVE_STATUSES } } });
    if (active >= agency.maxListings) throw new ListingError(`Has alcanzado el límite de ${agency.maxListings} inmuebles activos de tu plan`);
  }
  const ownerContactId = await resolveOwnerContact(actor, input.ownerContactId);
  let reference = newReference();
  while (await prisma.listing.findUnique({ where: { reference } })) reference = newReference();
  const listing = await prisma.listing.create({
    data: {
      ...dataFromInput(input),
      reference,
      slug: buildSlug({ ...input, reference }),
      agencyId: actor.kind === "agency" ? actor.agencyId : null,
      ownerContactId,
      status: "DRAFT",
    },
  });
  await audit(auditActor(actor), "listing.create", "Listing", listing.id, reference, listing.agencyId);
  return listing;
}

export async function getListing(actor: ListingActor, id: string) {
  const listing = await prisma.listing.findFirst({
    where: { id, ...scopeWhere(actor) },
    include: { photos: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] }, agency: { select: { id: true, name: true } } },
  });
  if (!listing) throw new ListingError("Inmueble no encontrado");
  return listing;
}

export async function updateListing(actor: ListingActor, id: string, raw: unknown) {
  const current = await getListing(actor, id);
  await assertAgencyActive(actor);
  const input = listingSchema.parse(raw);
  const ownerContactId = await resolveOwnerContact(actor, input.ownerContactId);
  // Una inmobiliaria que cambia un anuncio visible lo devuelve a revisión
  const backToReview = actor.kind === "agency" && (current.status === "PUBLISHED" || current.status === "RESERVED");
  const listing = await prisma.listing.update({
    where: { id: current.id },
    data: {
      ...dataFromInput(input),
      slug: buildSlug({ ...input, reference: current.reference }),
      ...(actor.kind === "agency" ? { ownerContactId } : {}),
      ...(backToReview ? { status: "REVIEW", reviewRequestedAt: new Date(), reviewNote: null } : {}),
    },
  });
  await audit(auditActor(actor), backToReview ? "listing.update_to_review" : "listing.update", "Listing", id, null, listing.agencyId);
  return { listing, backToReview };
}

/** Motivos que impiden publicar (vacío = se puede publicar). */
export function publishProblems(l: {
  operation: string;
  title: string;
  description: string;
  price: number;
  municipality: string;
  builtArea: number | null;
  energyRating: string | null;
  authorizationType: string | null;
  authorizationDate: Date | null;
  checkData: boolean;
  checkAuthorization: boolean;
  checkEnergy: boolean;
  checkLegalRent: boolean;
  rentalType: string | null;
  depositMonths: number | null;
  rentalRegistry: string | null;
  propertyType: string;
}, photoCount: number): string[] {
  const p: string[] = [];
  if (l.description.trim().length < 80) p.push("Escribe una descripción de al menos 80 caracteres");
  if (!l.price) p.push("Indica el precio");
  if (!l.municipality) p.push("Indica el municipio");
  if (!l.builtArea && !["GARAJE", "TERRENO"].includes(l.propertyType)) p.push("Indica la superficie construida");
  if (photoCount < 1) p.push("Añade al menos una fotografía");
  if (!l.energyRating) p.push("Indica la calificación energética (o «En trámite» / «Exento»)");
  if (!l.authorizationType || !l.authorizationDate) p.push("Indica el tipo y la fecha de la autorización del propietario");
  if (!l.checkAuthorization) p.push("Confirma que tienes la autorización del propietario para publicar");
  if (!l.checkEnergy) p.push("Confirma que el certificado energético es correcto (o que está en trámite o exento)");
  if (!l.checkData) p.push("Confirma que has comprobado los datos del inmueble");
  if (l.operation === "RENT") {
    if (!l.rentalType) p.push("Indica el tipo de alquiler");
    if (l.depositMonths == null) p.push("Indica la fianza (meses)");
    if (l.rentalType === "SEASONAL" && !l.rentalRegistry) p.push("Indica el número del Registro Único de Arrendamientos (obligatorio en alquiler de temporada)");
    if (!l.checkLegalRent) p.push("Confirma que has revisado la normativa de alquiler aplicable (zona tensionada, fianza, gastos)");
  }
  return p;
}

export const TRANSITIONS = {
  submit: "Enviar a revisión",
  publish: "Publicar",
  reject: "Devolver a borrador",
  reserve: "Marcar como reservado",
  unreserve: "Quitar reserva",
  close: "Marcar como vendido / alquilado",
  unpublish: "Despublicar",
  archive: "Archivar",
  reopen: "Reabrir como borrador",
} as const;
export type Transition = keyof typeof TRANSITIONS;

const FROM: Record<Transition, ListingStatus[]> = {
  submit: ["DRAFT", "UNPUBLISHED"],
  publish: ["DRAFT", "REVIEW", "UNPUBLISHED"],
  reject: ["REVIEW"],
  reserve: ["PUBLISHED"],
  unreserve: ["RESERVED"],
  close: ["PUBLISHED", "RESERVED", "UNPUBLISHED"],
  unpublish: ["PUBLISHED", "RESERVED"],
  archive: ["DRAFT", "REVIEW", "UNPUBLISHED", "SOLD", "RENTED"],
  reopen: ["SOLD", "RENTED", "ARCHIVED", "UNPUBLISHED"],
};

/** Transiciones disponibles para quien actúa en el estado actual. */
export function availableTransitions(actor: ListingActor, status: string): Transition[] {
  return (Object.keys(FROM) as Transition[]).filter((t) => {
    if (!FROM[t].includes(status as ListingStatus)) return false;
    if (actor.kind === "admin") return t !== "submit";
    return t !== "publish" && t !== "reject";
  });
}

export async function transitionListing(actor: ListingActor, id: string, transition: Transition, note?: string | null) {
  const l = await getListing(actor, id);
  if (!availableTransitions(actor, l.status).includes(transition)) throw new ListingError("Esta acción no está disponible en el estado actual");
  if (transition === "submit" || transition === "publish") {
    await assertAgencyActive(actor);
    const problems = publishProblems(l, l.photos.length);
    if (problems.length) throw new ListingError(`Antes de ${transition === "publish" ? "publicar" : "enviar a revisión"}: ${problems[0]}`);
  }
  if (transition === "publish" && l.agencyId) {
    const agency = await prisma.agency.findUnique({ where: { id: l.agencyId } });
    if (!agency?.crmAccess || agency.status !== "ACTIVE") throw new ListingError("La inmobiliaria no tiene la cuenta activa");
  }
  const now = new Date();
  const data: Prisma.ListingUpdateInput = (() => {
    switch (transition) {
      case "submit":
        return { status: "REVIEW", reviewRequestedAt: now, reviewNote: null };
      case "publish":
        return { status: "PUBLISHED", publishedAt: l.publishedAt ?? now, publishedBy: actor.kind === "admin" ? actor.id : null, reviewNote: null };
      case "reject":
        return { status: "DRAFT", reviewNote: note?.trim().slice(0, 500) || "Revisa los datos del anuncio" };
      case "reserve":
        return { status: "RESERVED" };
      case "unreserve":
        return { status: "PUBLISHED" };
      case "close":
        return { status: l.operation === "RENT" ? "RENTED" : "SOLD" };
      case "unpublish":
        return { status: "UNPUBLISHED" };
      case "archive":
        return { status: "ARCHIVED" };
      case "reopen":
        return { status: "DRAFT" };
    }
  })();
  // Reabrir cuenta para el límite de inmuebles activos
  if (transition === "reopen" && actor.kind === "agency") {
    const agency = await assertAgencyActive(actor);
    const active = await prisma.listing.count({ where: { agencyId: actor.agencyId, status: { in: ACTIVE_STATUSES } } });
    if (agency && active >= agency.maxListings) throw new ListingError(`Has alcanzado el límite de ${agency.maxListings} inmuebles activos de tu plan`);
  }
  // Volver a publicar algo de una inmobiliaria que estaba despublicado exige revisión: «publish» solo lo hace el administrador.
  const updated = await prisma.listing.update({ where: { id: l.id }, data });
  await audit(auditActor(actor), `listing.${transition}`, "Listing", l.id, `${l.status} → ${updated.status}`, l.agencyId);
  return updated;
}

/** Solo se pueden borrar borradores sin solicitudes (el resto se archiva para conservar el historial). */
export async function deleteListing(actor: ListingActor, id: string) {
  const l = await getListing(actor, id);
  if (l.status !== "DRAFT") throw new ListingError("Solo se pueden eliminar borradores. Archiva el inmueble para retirarlo.");
  const inquiries = await prisma.listingInquiry.count({ where: { listingId: l.id } });
  if (inquiries) throw new ListingError("Este inmueble tiene solicitudes: archívalo en lugar de eliminarlo");
  await prisma.listing.delete({ where: { id: l.id } });
  for (const p of l.photos) {
    await deleteFile(p.key);
    await deleteFile(p.key.replace(/\.webp$/, "-thumb.webp"));
  }
  if (l.authorizationDoc) await deleteFile(l.authorizationDoc);
  await audit(auditActor(actor), "listing.delete", "Listing", l.id, l.reference, l.agencyId);
}

export async function listListings(actor: ListingActor, filters: { status?: string; operation?: string; q?: string; agencyId?: string } = {}) {
  const where: Prisma.ListingWhereInput = { ...scopeWhere(actor) };
  if (filters.status === "ACTIVE") where.status = { in: ACTIVE_STATUSES };
  else if (filters.status) where.status = filters.status;
  if (filters.operation) where.operation = filters.operation;
  if (actor.kind === "admin" && filters.agencyId) where.agencyId = filters.agencyId === "OWN" ? null : filters.agencyId;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [{ reference: { contains: q.toUpperCase() } }, { title: { contains: q } }, { municipality: { contains: q } }];
  }
  return prisma.listing.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 300,
    include: {
      photos: { where: { isMain: true }, take: 1 },
      agency: { select: { name: true } },
      _count: { select: { inquiries: true, photos: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Fotografías y documento de autorización
// ---------------------------------------------------------------------------

/** Procesa la foto: orientación correcta, tamaño máximo, WebP y SIN metadatos (borra el GPS). */
async function processPhoto(buffer: Buffer) {
  const sharp = (await import("sharp")).default;
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: 80_000_000 }).metadata();
  } catch {
    throw new ListingError("El archivo no es una imagen válida");
  }
  if (!meta.format || !["jpeg", "png", "webp", "avif", "heif"].includes(meta.format)) throw new ListingError("Formato no admitido: usa JPG, PNG o WebP");
  try {
    const base = sharp(buffer, { limitInputPixels: 80_000_000 }).rotate();
    const large = await base.clone().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    const thumb = await base.clone().resize({ width: 720, height: 540, fit: "cover", position: "attention" }).webp({ quality: 74 }).toBuffer();
    return { large: large.data, width: large.info.width, height: large.info.height, thumb };
  } catch {
    throw new ListingError("No se ha podido procesar la imagen (formato no admitido). Usa JPG, PNG o WebP.");
  }
}

export async function addPhoto(actor: ListingActor, listingId: string, buffer: Buffer) {
  const l = await getListing(actor, listingId);
  await assertAgencyActive(actor);
  if (buffer.length > MAX_PHOTO_BYTES) throw new ListingError("La foto supera los 15 MB");
  if (l.photos.length >= MAX_PHOTOS) throw new ListingError(`Máximo ${MAX_PHOTOS} fotos por inmueble`);
  const img = await processPhoto(buffer);
  const key = newKey("public", "listings", "webp");
  await putFile(key, img.large);
  await putFile(key.replace(/\.webp$/, "-thumb.webp"), img.thumb);
  const photo = await prisma.listingPhoto.create({
    data: { listingId: l.id, key, width: img.width, height: img.height, position: l.photos.length, isMain: l.photos.length === 0 },
  });
  if (actor.kind === "agency" && (l.status === "PUBLISHED" || l.status === "RESERVED")) {
    await prisma.listing.update({ where: { id: l.id }, data: { status: "REVIEW", reviewRequestedAt: new Date() } });
  }
  return photo;
}

async function photoOf(actor: ListingActor, photoId: string) {
  const photo = await prisma.listingPhoto.findFirst({ where: { id: photoId, listing: scopeWhere(actor) }, include: { listing: true } });
  if (!photo) throw new ListingError("Foto no encontrada");
  return photo;
}

export async function deletePhoto(actor: ListingActor, photoId: string) {
  const photo = await photoOf(actor, photoId);
  const remaining = await prisma.listingPhoto.count({ where: { listingId: photo.listingId } });
  if (remaining <= 1 && PUBLIC_STATUSES.includes(photo.listing.status as ListingStatus)) throw new ListingError("Un inmueble publicado necesita al menos una foto");
  await prisma.listingPhoto.delete({ where: { id: photo.id } });
  await deleteFile(photo.key);
  await deleteFile(photo.key.replace(/\.webp$/, "-thumb.webp"));
  if (photo.isMain) {
    const next = await prisma.listingPhoto.findFirst({ where: { listingId: photo.listingId }, orderBy: { position: "asc" } });
    if (next) await prisma.listingPhoto.update({ where: { id: next.id }, data: { isMain: true } });
  }
}

export async function setMainPhoto(actor: ListingActor, photoId: string) {
  const photo = await photoOf(actor, photoId);
  await prisma.$transaction([
    prisma.listingPhoto.updateMany({ where: { listingId: photo.listingId }, data: { isMain: false } }),
    prisma.listingPhoto.update({ where: { id: photo.id }, data: { isMain: true } }),
  ]);
}

export async function movePhoto(actor: ListingActor, photoId: string, direction: -1 | 1) {
  const photo = await photoOf(actor, photoId);
  const photos = await prisma.listingPhoto.findMany({ where: { listingId: photo.listingId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const i = photos.findIndex((p) => p.id === photo.id);
  const j = i + direction;
  if (j < 0 || j >= photos.length) return;
  [photos[i], photos[j]] = [photos[j], photos[i]];
  await prisma.$transaction(photos.map((p, position) => prisma.listingPhoto.update({ where: { id: p.id }, data: { position } })));
}

function docType(buffer: Buffer): "pdf" | "jpg" | "png" | null {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  return null;
}

/** Documento de autorización del propietario: privado, nunca se sirve en la web pública. */
export async function setAuthorizationDoc(actor: ListingActor, listingId: string, buffer: Buffer) {
  const l = await getListing(actor, listingId);
  await assertAgencyActive(actor);
  if (buffer.length > MAX_DOC_BYTES) throw new ListingError("El documento supera los 10 MB");
  const ext = docType(buffer);
  if (!ext) throw new ListingError("Sube el documento en PDF, JPG o PNG");
  const key = newKey("private", "authorizations", ext);
  await putFile(key, buffer);
  await prisma.listing.update({ where: { id: l.id }, data: { authorizationDoc: key } });
  if (l.authorizationDoc) await deleteFile(l.authorizationDoc);
  await audit(auditActor(actor), "listing.authorization_doc", "Listing", l.id, null, l.agencyId);
}

// ---------------------------------------------------------------------------
// Web pública
// ---------------------------------------------------------------------------

export const searchSchema = z.object({
  municipio: z.string().trim().max(80).optional(),
  zona: z.string().trim().max(80).optional(),
  provincia: z.string().regex(/^\d{2}$/).optional(),
  tipo: z.enum(keys(PROPERTY_TYPES)).optional(),
  min: z.coerce.number().int().min(0).max(100_000_000).optional(),
  max: z.coerce.number().int().min(0).max(100_000_000).optional(),
  hab: z.coerce.number().int().min(0).max(10).optional(),
  m2: z.coerce.number().int().min(0).max(100_000).optional(),
  orden: z.enum(["recientes", "precio-asc", "precio-desc"]).optional(),
  pagina: z.coerce.number().int().min(1).max(500).optional(),
});
export type SearchFilters = z.infer<typeof searchSchema>;

/** Filtros desde la URL. Los valores no válidos se ignoran (nunca rompen la página). */
export function parseSearch(params: Record<string, string | string[] | undefined>): SearchFilters {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (!value) continue;
    const single = searchSchema.shape[k as keyof typeof searchSchema.shape];
    if (!single) continue;
    const r = single.safeParse(value);
    if (r.success && r.data !== undefined) out[k] = r.data;
  }
  return out as SearchFilters;
}

export const PAGE_SIZE = 18;

/** Selección de campos públicos: nunca la dirección exacta, la referencia catastral ni los documentos. */
export const PUBLIC_SELECT = {
  id: true,
  reference: true,
  slug: true,
  status: true,
  operation: true,
  title: true,
  description: true,
  propertyType: true,
  price: true,
  communityFee: true,
  provinceCode: true,
  municipality: true,
  zone: true,
  postalCode: true,
  builtArea: true,
  usefulArea: true,
  bedrooms: true,
  bathrooms: true,
  floor: true,
  yearBuilt: true,
  condition: true,
  features: true,
  energyRating: true,
  energyConsumption: true,
  energyEmissions: true,
  rentalType: true,
  depositMonths: true,
  minTermMonths: true,
  availableFrom: true,
  rentConditions: true,
  rentalRegistry: true,
  publishedAt: true,
  updatedAt: true,
  agency: { select: { name: true } },
  photos: { orderBy: [{ isMain: "desc" }, { position: "asc" }], select: { key: true, width: true, height: true, alt: true, isMain: true } },
} satisfies Prisma.ListingSelect;

function publicVisibility(): Prisma.ListingWhereInput {
  // Un inmueble de una inmobiliaria deja de verse si su cuenta se desactiva
  return { status: { in: PUBLIC_STATUSES }, provinceCode: { in: [...PORTAL_PROVINCE_CODES] }, OR: [{ agencyId: null }, { agency: { crmAccess: true, status: "ACTIVE" } }] };
}

export async function searchPublic(operation: "SALE" | "RENT", f: SearchFilters) {
  const where: Prisma.ListingWhereInput = { ...publicVisibility(), operation };
  if (f.provincia) where.provinceCode = f.provincia;
  if (f.municipio) where.municipality = f.municipio; // nombre oficial elegido en el buscador
  if (f.zona) where.zone = { contains: f.zona };
  if (f.tipo) where.propertyType = f.tipo;
  if (f.min || f.max) where.price = { ...(f.min ? { gte: f.min } : {}), ...(f.max ? { lte: f.max } : {}) };
  if (f.hab) where.bedrooms = { gte: f.hab };
  if (f.m2) where.builtArea = { gte: f.m2 };
  const orderBy: Prisma.ListingOrderByWithRelationInput =
    f.orden === "precio-asc" ? { price: "asc" } : f.orden === "precio-desc" ? { price: "desc" } : { publishedAt: "desc" };
  const page = f.pagina ?? 1;
  const [total, items] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: PUBLIC_SELECT }),
  ]);
  return { total, items, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function publicMunicipalities(operation: "SALE" | "RENT") {
  const rows = await prisma.listing.groupBy({ by: ["municipality"], where: { ...publicVisibility(), operation }, _count: true, orderBy: { municipality: "asc" } });
  return rows.map((r) => r.municipality);
}

export async function getPublicListing(reference: string) {
  return prisma.listing.findFirst({ where: { reference, ...publicVisibility() }, select: PUBLIC_SELECT });
}

export async function publicListingsForSitemap() {
  return prisma.listing.findMany({ where: publicVisibility(), select: { slug: true, updatedAt: true }, take: 5000 });
}

/** ¿Se puede servir esta foto a cualquiera? (inmueble visible en la web) */
export async function isPublicPhoto(key: string) {
  const photo = await prisma.listingPhoto.findUnique({ where: { key: key.replace(/-thumb\.webp$/, ".webp") }, select: { listing: { select: { id: true } } } });
  if (!photo) return { exists: false, isPublic: false };
  const visible = await prisma.listing.count({ where: { id: photo.listing.id, ...publicVisibility() } });
  return { exists: true, isPublic: visible > 0 };
}

/** ¿Puede este usuario ver la foto de un inmueble no publicado? */
export async function canSeePhoto(actor: ListingActor, key: string) {
  const n = await prisma.listingPhoto.count({ where: { key: key.replace(/-thumb\.webp$/, ".webp"), listing: scopeWhere(actor) } });
  return n > 0;
}
