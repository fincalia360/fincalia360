// «Publica tu inmueble gratis»: solicitudes de propietarios para anunciar una vivienda o un amarre.
// - No crean ningún anuncio: llegan al administrador, que las revisa y, si procede, crea el borrador.
// - Las fotos se guardan PRIVADAS (sin metadatos ni GPS) y solo las ve el administrador.
// - Consentimientos explícitos y nunca premarcados; se guarda el texto exacto aceptado.
// - El aviso por correo al equipo solo se envía si el proveedor está configurado (nunca se simula).
import { z } from "zod";
import { prisma } from "@/db/client";
import { audit } from "@/services/audit";
import { emailConfig, sendEmail } from "@/services/email/emailService";
import { getProvince } from "@/services/study/geo";
import { deleteFile, getFile, newKey, putFile } from "@/services/storage/storage";
import { MOORING_PROPERTY_TYPE, PROPERTY_TYPES, formatPrice, isPortalProvince, type PublicationRequestStatus } from "./catalog";
import { ListingError, addPhoto, createListing, processPhoto } from "./listings";

export const PUBLICATION_CONSENT_VERSION = "publicar-v1-2026-10";
export const PUBLICATION_PRIVACY_TEXT =
  "He leído la política de privacidad y acepto que FINCALIA360 trate mis datos y las fotos que envío para revisar mi solicitud, contactarme y, si lo acordamos, publicar el anuncio.";
export const PUBLICATION_OWNER_TEXT = "Soy el propietario o titular, o tengo su autorización para anunciarlo.";
export const PUBLICATION_MARKETING_TEXT = "Quiero recibir información comercial de FINCALIA360 (opcional).";

export const MAX_REQUEST_PHOTOS = 15;
export const MAX_REQUEST_PHOTO_BYTES = 15 * 1024 * 1024;
/** Tamaño máximo del envío completo (límite del servidor web). */
export const MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024;

const optText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());
const optInt = (max: number) => z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number({ invalid_type_error: "Número no válido" }).int().min(0).max(max).nullable());
const optMeters = z.preprocess(
  (v) => (v === "" || v == null ? null : typeof v === "string" ? v.replace(",", ".") : v),
  z.coerce.number({ invalid_type_error: "Medida no válida" }).positive().max(200).nullable(),
);
const checked = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

export const publicationRequestSchema = z
  .object({
    category: z.enum(["HOME", "MOORING"]).default("HOME"),
    operation: z.enum(["SALE", "RENT"], { errorMap: () => ({ message: "Indica si quieres vender o alquilar" }) }),
    propertyType: z.string().optional(),
    provinceCode: z.string().refine(isPortalProvince, "Solo publicamos en Cataluña: elige Barcelona, Girona, Lleida o Tarragona"),
    municipality: z.string().trim().min(2, "Indica el municipio").max(80),
    zone: optText(80),
    address: optText(160),
    price: optInt(100_000_000),
    builtArea: optInt(100_000),
    bedrooms: optInt(50),
    bathrooms: optInt(50),
    portName: optText(100),
    berthLength: optMeters,
    berthWidth: optMeters,
    description: z.string().trim().max(4000).default(""),
    name: z.string().trim().min(2, "Indica tu nombre").max(100),
    email: z.string().trim().toLowerCase().email("Email no válido").max(150),
    phone: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().regex(/^[+\d][\d\s().-]{6,19}$/, "Teléfono no válido").nullable().optional()),
    isOwner: checked.refine((v) => v, "Confirma que eres el propietario o que tienes su autorización"),
    privacy: checked.refine((v) => v, "Debes aceptar la política de privacidad para enviar la solicitud"),
    marketing: checked.default(false),
    // Antispam: campo oculto y tiempo mínimo de rellenado
    website: z.string().optional(),
    elapsedMs: z.coerce.number().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.category === "MOORING") {
      if (!v.portName) ctx.addIssue({ code: "custom", path: ["portName"], message: "Indica el puerto deportivo" });
      if (!v.berthLength || !v.berthWidth) ctx.addIssue({ code: "custom", path: ["berthLength"], message: "Indica la longitud y la anchura del amarre" });
    } else if (!v.propertyType || !(v.propertyType in PROPERTY_TYPES)) {
      ctx.addIssue({ code: "custom", path: ["propertyType"], message: "Elige el tipo de inmueble" });
    }
  });

export class PublicationRequestError extends Error {}

export async function submitPublicationRequest(raw: Record<string, unknown>, photos: Buffer[]) {
  const parsed = publicationRequestSchema.safeParse(raw);
  if (!parsed.success) throw new PublicationRequestError(parsed.error.issues[0]?.message ?? "Datos no válidos");
  const d = parsed.data;
  if (d.website || (d.elapsedMs != null && d.elapsedMs < 3000)) throw new PublicationRequestError("No se ha podido enviar la solicitud. Inténtalo de nuevo.");
  if (photos.length > MAX_REQUEST_PHOTOS) throw new PublicationRequestError(`Puedes enviar como máximo ${MAX_REQUEST_PHOTOS} fotos`);

  // Fotos: se procesan antes de guardar nada (si una no es válida, no queda nada a medias)
  const processed = [];
  for (const buffer of photos) {
    if (buffer.length > MAX_REQUEST_PHOTO_BYTES) throw new PublicationRequestError("Alguna foto supera los 15 MB");
    try {
      processed.push(await processPhoto(buffer));
    } catch (e) {
      throw new PublicationRequestError(e instanceof ListingError ? e.message : "Alguna foto no es una imagen válida");
    }
  }
  const keys: string[] = [];
  for (const img of processed) {
    const key = newKey("private", "requests", "webp");
    await putFile(key, img.large);
    keys.push(key);
  }

  const mooring = d.category === "MOORING";
  const request = await prisma.publicationRequest.create({
    data: {
      name: d.name,
      email: d.email,
      phone: d.phone ?? null,
      category: d.category,
      operation: d.operation,
      propertyType: mooring ? MOORING_PROPERTY_TYPE : d.propertyType!,
      provinceCode: d.provinceCode,
      municipality: d.municipality,
      zone: d.zone ?? null,
      address: d.address ?? null,
      price: d.price ?? null,
      builtArea: mooring ? null : (d.builtArea ?? null),
      bedrooms: mooring ? null : (d.bedrooms ?? null),
      bathrooms: mooring ? null : (d.bathrooms ?? null),
      portName: mooring ? (d.portName ?? null) : null,
      berthLength: mooring ? (d.berthLength ?? null) : null,
      berthWidth: mooring ? (d.berthWidth ?? null) : null,
      description: d.description,
      photos: keys.join(","),
      isOwnerConfirmed: true,
      privacyAccepted: true,
      consentVersion: PUBLICATION_CONSENT_VERSION,
      consentText: [PUBLICATION_OWNER_TEXT, PUBLICATION_PRIVACY_TEXT, d.marketing ? PUBLICATION_MARKETING_TEXT : null].filter(Boolean).join(" "),
      marketingConsent: d.marketing,
    },
  });
  await audit({ type: "PUBLIC" }, "publication_request.create", "PublicationRequest", request.id, null, null);

  const team = emailConfig().team;
  if (team) {
    const what = mooring ? `Amarre en ${d.portName}` : PROPERTY_TYPES[d.propertyType as keyof typeof PROPERTY_TYPES];
    await sendEmail({
      to: team,
      replyTo: d.email,
      subject: `Nueva solicitud de publicación: ${what} en ${d.municipality}`.slice(0, 140),
      text: [
        "Un propietario quiere publicar gratis en FINCALIA360.",
        "",
        `${what} · ${d.operation === "RENT" ? "Alquiler" : "Venta"} · ${d.municipality} (${getProvince(d.provinceCode)?.name ?? d.provinceCode})`,
        d.price ? `Precio indicado: ${formatPrice(d.price, d.operation)}` : null,
        `Fotos: ${keys.length}`,
        `Nombre: ${d.name}`,
        `Email: ${d.email}`,
        d.phone ? `Teléfono: ${d.phone}` : null,
        "",
        "Revísala en el panel: Solicitudes de publicación.",
      ]
        .filter((l) => l !== null)
        .join("\n"),
    });
  }
  return request;
}

// ---------------------------------------------------------------------------
// Panel de administración
// ---------------------------------------------------------------------------

export async function listPublicationRequests(status?: string) {
  return prisma.publicationRequest.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
  });
}

export async function getPublicationRequest(id: string) {
  const r = await prisma.publicationRequest.findUnique({ where: { id } });
  if (!r) throw new PublicationRequestError("Solicitud no encontrada");
  return r;
}

export async function setPublicationRequestStatus(adminId: string, id: string, status: PublicationRequestStatus, note: string | null) {
  const r = await getPublicationRequest(id);
  if (status === "CONVERTED" && !r.listingId) throw new PublicationRequestError("Crea el anuncio desde la solicitud para marcarla así");
  await prisma.publicationRequest.update({ where: { id: r.id }, data: { status, adminNote: note?.trim().slice(0, 1000) || null } });
  await audit({ type: "ADMIN", id: adminId }, "publication_request.status", "PublicationRequest", r.id, status, null);
}

/** Crea un BORRADOR de anuncio con los datos y las fotos de la solicitud. Publicarlo exige las comprobaciones habituales. */
export async function convertPublicationRequest(adminId: string, id: string, input: { title: string; price: number }) {
  const r = await getPublicationRequest(id);
  if (r.listingId) throw new PublicationRequestError("Esta solicitud ya tiene un anuncio creado");
  const actor = { kind: "admin" as const, id: adminId };
  const listing = await createListing(actor, {
    category: r.category,
    operation: r.operation,
    title: input.title,
    description: r.description,
    propertyType: r.propertyType,
    price: String(input.price),
    provinceCode: r.provinceCode,
    municipality: r.municipality,
    zone: r.zone ?? "",
    address: r.address ?? "",
    builtArea: r.builtArea != null ? String(r.builtArea) : "",
    bedrooms: r.bedrooms != null ? String(r.bedrooms) : "",
    bathrooms: r.bathrooms != null ? String(r.bathrooms) : "",
    portName: r.portName ?? "",
    berthLength: r.berthLength != null ? String(r.berthLength) : "",
    berthWidth: r.berthWidth != null ? String(r.berthWidth) : "",
    features: [],
  });
  for (const key of r.photos.split(",").filter(Boolean)) {
    const file = await getFile(key);
    if (file) await addPhoto(actor, listing.id, file);
  }
  await prisma.publicationRequest.update({ where: { id: r.id }, data: { status: "CONVERTED", listingId: listing.id } });
  await audit({ type: "ADMIN", id: adminId }, "publication_request.convert", "PublicationRequest", r.id, listing.reference, null);
  return listing;
}

/** Borra la solicitud y sus fotos (p. ej. si el propietario ejerce su derecho de supresión). */
export async function deletePublicationRequest(adminId: string, id: string) {
  const r = await getPublicationRequest(id);
  await prisma.publicationRequest.delete({ where: { id: r.id } });
  for (const key of r.photos.split(",").filter(Boolean)) await deleteFile(key);
  await audit({ type: "ADMIN", id: adminId }, "publication_request.delete", "PublicationRequest", r.id, null, null);
}

/** ¿Es una foto de una solicitud? (para servirla solo al administrador) */
export async function isRequestPhoto(key: string) {
  if (!/^private\/requests\/[a-f0-9]+\.webp$/.test(key)) return false;
  return (await prisma.publicationRequest.count({ where: { photos: { contains: key } } })) > 0;
}
