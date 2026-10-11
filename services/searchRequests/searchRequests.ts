// «Busco comprar»: solicitudes de personas que buscan un inmueble (compra o alquiler).
// - Se validan en el servidor y se guardan como «Pendiente de revisión».
// - Solo se ven en la web cuando el administrador las publica, y nunca con datos de contacto.
// - Consentimiento de privacidad obligatorio y publicidad opcional (nunca premarcada); se guarda el texto aceptado.
// - Gratuito: no hay comisión ni pago para quien busca vivienda.
// - El aviso por correo al equipo solo se envía si el proveedor está configurado (nunca se simula).
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { audit } from "@/services/audit";
import { emailConfig, sendEmail } from "@/services/email/emailService";
import { isPortalProvince } from "@/services/listings/catalog";
import { getProvince } from "@/services/study/geo";
import { MAX_MUNICIPALITIES, MUNICIPALITY_SEPARATOR, SEARCH_CONDITIONS, SEARCH_TYPES, isDwellingSearch, splitMunicipalities, type SearchStatus } from "./catalog";

// v2: textos con «inmueble» en lugar de «vivienda» (sección «Busco comprar»)
export const SEARCH_CONSENT_VERSION = "busco-comprar-v2-2026-10";

export class SearchRequestError extends Error {}

const optText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());
const optInt = (max: number, msg: string) =>
  z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number({ invalid_type_error: msg }).int(msg).min(0, msg).max(max, msg).nullable().optional());
const pref = z.enum(["YES", "NO", "ANY"]).default("ANY");
const checked = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());
const municipalities = z
  .preprocess(
    (v) => (Array.isArray(v) ? v : typeof v === "string" ? splitMunicipalities(v) : []),
    z.array(z.string().trim().min(2).max(80)).min(1, "Indica al menos una población").max(MAX_MUNICIPALITIES, `Como máximo ${MAX_MUNICIPALITIES} poblaciones`),
  )
  .transform((list) => [...new Set(list.map((m) => m.replace(/\|/g, " ").trim()))]);

/** Campos de la búsqueda (los mismos para el formulario público y la edición del administrador). */
const searchFields = {
  operation: z.enum(["SALE", "RENT"], { errorMap: () => ({ message: "Indica si quieres comprar o alquilar" }) }),
  propertyType: z.enum(Object.keys(SEARCH_TYPES) as [keyof typeof SEARCH_TYPES, ...Array<keyof typeof SEARCH_TYPES>], {
    errorMap: () => ({ message: "Elige el tipo de inmueble" }),
  }),
  provinceCode: z.string().refine(isPortalProvince, "Elige Barcelona, Girona, Lleida o Tarragona"),
  municipalities,
  zone: optText(120),
  minPrice: optInt(100_000_000, "El precio mínimo no es válido"),
  maxPrice: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce
      .number({ required_error: "Indica el presupuesto máximo", invalid_type_error: "El presupuesto máximo no es válido" })
      .int("El presupuesto máximo no es válido")
      .min(1, "El presupuesto máximo debe ser mayor que 0")
      .max(100_000_000, "El presupuesto máximo no es válido"),
  ),
  minBedrooms: optInt(20, "Número de habitaciones no válido"),
  minBathrooms: optInt(20, "Número de baños no válido"),
  minArea: optInt(100_000, "Superficie mínima no válida"),
  maxArea: optInt(100_000, "Superficie máxima no válida"),
  terrace: pref,
  elevator: pref,
  parking: pref,
  exterior: pref,
  condition: z.enum(Object.keys(SEARCH_CONDITIONS) as [keyof typeof SEARCH_CONDITIONS, ...Array<keyof typeof SEARCH_CONDITIONS>]).default("ANY"),
  description: z.string().trim().max(2000, "La descripción es demasiado larga (máximo 2.000 caracteres)").default(""),
};

type Coherent = { minPrice?: number | null; maxPrice: number; minArea?: number | null; maxArea?: number | null; operation: string };
function checkCoherence(v: Coherent, ctx: z.RefinementCtx) {
  if (v.minPrice != null && v.minPrice > v.maxPrice) ctx.addIssue({ code: "custom", path: ["minPrice"], message: "El precio mínimo no puede superar al máximo" });
  if (v.minArea != null && v.maxArea != null && v.minArea > v.maxArea)
    ctx.addIssue({ code: "custom", path: ["minArea"], message: "La superficie mínima no puede superar a la máxima" });
  // Alquiler: importes mensuales. Un máximo de más de 100.000 €/mes casi seguro es un precio de compra.
  if (v.operation === "RENT" && v.maxPrice > 100_000) ctx.addIssue({ code: "custom", path: ["maxPrice"], message: "En alquiler el presupuesto es mensual: revisa el importe" });
  if (v.operation === "SALE" && v.maxPrice < 1_000) ctx.addIssue({ code: "custom", path: ["maxPrice"], message: "En compra el presupuesto es el precio total: revisa el importe" });
}

export const searchRequestSchema = z
  .object({
    ...searchFields,
    name: z.string().trim().min(2, "Indica tu nombre").max(100),
    email: z.string().trim().toLowerCase().email("Email no válido").max(150),
    phone: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z
        .string()
        .trim()
        .regex(/^[+\d][\d\s().-]{6,19}$/, "Teléfono no válido")
        .nullable()
        .optional(),
    ),
    privacy: checked.refine((v) => v, "Debes aceptar la política de privacidad para enviar la solicitud"),
    marketing: checked.default(false),
    lang: z.enum(["es", "ca", "en", "de", "fr"]).default("es"),
    consentText: z.string().trim().min(10).max(600),
    // Antispam: campo oculto y tiempo mínimo de rellenado
    website: z.string().optional(),
    elapsedMs: z.coerce.number().optional(),
  })
  .superRefine(checkCoherence);

/** Edición del administrador: los campos de la búsqueda, el texto público y la nota interna (no el contacto). */
export const adminEditSchema = z
  .object({
    ...searchFields,
    publicText: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(2000).nullable().optional()),
    adminNote: optText(2000),
  })
  .superRefine(checkCoherence);

/** Detecta datos de contacto en un texto que se va a publicar (email, teléfono, web). */
export function contactDataIn(text: string | null | undefined) {
  if (!text) return [] as string[];
  const found: string[] = [];
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text)) found.push("un email");
  if (/(\+?\d[\d\s.-]{7,}\d)/.test(text)) found.push("un número de teléfono");
  if (/(https?:\/\/|www\.)\S+/i.test(text)) found.push("una dirección web");
  return found;
}

async function newReference() {
  for (let i = 0; i < 5; i++) {
    const ref = `BP-${randomBytes(4).toString("hex").slice(0, 6).toUpperCase()}`;
    if (!(await prisma.searchRequest.findUnique({ where: { reference: ref }, select: { id: true } }))) return ref;
  }
  throw new Error("No se pudo generar la referencia");
}

function dataFrom(v: z.infer<typeof searchRequestSchema> | z.infer<typeof adminEditSchema>) {
  // Habitaciones, baños, terraza, ascensor, exterior y estado solo tienen sentido en viviendas;
  // en un amarre no se pide superficie (se busca por las medidas en la descripción).
  const dwelling = isDwellingSearch(v.propertyType);
  const mooring = v.propertyType === "AMARRE";
  return {
    operation: v.operation,
    propertyType: v.propertyType,
    provinceCode: v.provinceCode,
    municipalities: v.municipalities.join(MUNICIPALITY_SEPARATOR),
    zone: v.zone ?? null,
    minPrice: v.minPrice ?? null,
    maxPrice: v.maxPrice,
    minBedrooms: dwelling ? (v.minBedrooms ?? null) : null,
    minBathrooms: dwelling ? (v.minBathrooms ?? null) : null,
    minArea: mooring ? null : (v.minArea ?? null),
    maxArea: mooring ? null : (v.maxArea ?? null),
    terrace: dwelling ? v.terrace : "ANY",
    elevator: dwelling ? v.elevator : "ANY",
    parking: dwelling ? v.parking : "ANY",
    exterior: dwelling ? v.exterior : "ANY",
    condition: dwelling ? v.condition : "ANY",
    description: v.description,
  };
}

/** Formulario público. Devuelve solo la referencia (nunca los datos guardados). */
export async function submitSearchRequest(raw: unknown) {
  const parsed = searchRequestSchema.safeParse(raw);
  if (!parsed.success) throw new SearchRequestError(parsed.error.issues[0]?.message ?? "Datos no válidos");
  const v = parsed.data;
  if (v.website || (v.elapsedMs != null && v.elapsedMs < 3000)) throw new SearchRequestError("No se ha podido enviar la solicitud. Inténtalo de nuevo.");

  const created = await prisma.searchRequest.create({
    data: {
      ...dataFrom(v),
      reference: await newReference(),
      status: "PENDING",
      name: v.name,
      email: v.email,
      phone: v.phone ?? null,
      lang: v.lang,
      privacyAccepted: true,
      consentVersion: SEARCH_CONSENT_VERSION,
      consentText: v.consentText,
      marketingConsent: v.marketing,
    },
    select: { id: true, reference: true },
  });
  await audit({ type: "PUBLIC" }, "searchRequest.create", "SearchRequest", created.id, null, null);

  const team = emailConfig().team;
  if (team) {
    await sendEmail({
      to: team,
      subject: `Nueva solicitud «Busco comprar» ${created.reference}`,
      text: [
        `${v.operation === "RENT" ? "Alquiler" : "Compra"} · ${SEARCH_TYPES[v.propertyType]} · ${v.municipalities.join(", ")} (${getProvince(v.provinceCode)?.name ?? v.provinceCode})`,
        `Presupuesto máximo: ${v.maxPrice.toLocaleString("es-ES")} €${v.operation === "RENT" ? "/mes" : ""}`,
        "",
        "Revísala en el panel: Solicitudes Busco comprar. Está pendiente de revisión y no se publica hasta que la apruebes.",
      ].join("\n"),
    }).catch((e) => console.error("[busco-piso] aviso por correo", (e as Error).message));
  }
  return created;
}

export interface AdminSearchFilters {
  status?: string;
  operation?: string;
  provinceCode?: string;
  municipality?: string;
  budgetMin?: number;
  budgetMax?: number;
}

function budgetWhere(min?: number, max?: number): Prisma.SearchRequestWhereInput {
  // Presupuesto: solicitudes cuyo máximo está en el rango indicado
  if (min == null && max == null) return {};
  return { maxPrice: { ...(min != null ? { gte: min } : {}), ...(max != null ? { lte: max } : {}) } };
}

export async function listSearchRequestsAdmin(f: AdminSearchFilters = {}) {
  return prisma.searchRequest.findMany({
    where: {
      ...(f.status ? { status: f.status } : {}),
      ...(f.operation ? { operation: f.operation } : {}),
      ...(f.provinceCode ? { provinceCode: f.provinceCode } : {}),
      ...(f.municipality ? { municipalities: { contains: f.municipality.trim() } } : {}),
      ...budgetWhere(f.budgetMin, f.budgetMax),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function countPendingSearchRequests() {
  return prisma.searchRequest.count({ where: { status: "PENDING" } });
}

export async function getSearchRequest(id: string) {
  const r = await prisma.searchRequest.findUnique({ where: { id } });
  if (!r) throw new SearchRequestError("Solicitud no encontrada");
  return r;
}

export async function updateSearchRequest(adminId: string, id: string, raw: unknown) {
  await getSearchRequest(id);
  const v = adminEditSchema.parse(raw);
  const r = await prisma.searchRequest.update({
    where: { id },
    data: { ...dataFrom(v), publicText: v.publicText ?? null, adminNote: v.adminNote ?? null },
  });
  // Si ya está publicada, el texto público no puede contener datos de contacto
  if (r.status === "PUBLISHED" && contactDataIn(r.publicText).length) {
    await prisma.searchRequest.update({ where: { id }, data: { status: "HIDDEN" } });
    await audit({ type: "ADMIN", id: adminId }, "searchRequest.hide", "SearchRequest", id, "datos de contacto en el texto público", null);
    throw new SearchRequestError("Guardado, pero se ha ocultado: el texto público contiene datos de contacto. Quítalos y vuelve a publicarla.");
  }
  await audit({ type: "ADMIN", id: adminId }, "searchRequest.update", "SearchRequest", id, null, null);
  return r;
}

export type SearchAction = "publish" | "hide" | "reject" | "resolve" | "pending";
const NEXT_STATUS: Record<SearchAction, SearchStatus> = { publish: "PUBLISHED", hide: "HIDDEN", reject: "REJECTED", resolve: "RESOLVED", pending: "PENDING" };

export async function setSearchRequestStatus(adminId: string, id: string, action: SearchAction) {
  const r = await getSearchRequest(id);
  if (action === "publish") {
    const found = contactDataIn(r.publicText);
    if (found.length) throw new SearchRequestError(`El texto público contiene ${found.join(" y ")}: quítalo antes de publicar.`);
  }
  const status = NEXT_STATUS[action];
  const updated = await prisma.searchRequest.update({
    where: { id },
    data: {
      status,
      ...(action === "publish" ? { publishedAt: r.publishedAt ?? new Date() } : {}),
      ...(action === "resolve" ? { resolvedAt: new Date() } : {}),
    },
  });
  await audit({ type: "ADMIN", id: adminId }, `searchRequest.${action}`, "SearchRequest", id, `${r.status} → ${status}`, null);
  return updated;
}

/** Supresión definitiva (a petición del interesado o cuando proceda). */
export async function deleteSearchRequest(adminId: string, id: string) {
  await getSearchRequest(id);
  await prisma.searchRequest.delete({ where: { id } });
  await audit({ type: "ADMIN", id: adminId }, "searchRequest.delete", "SearchRequest", id, null, null);
}

/** Campos que se pueden mostrar en la web. Nunca nombre, email, teléfono, texto original ni notas. */
export const PUBLIC_SEARCH_SELECT = {
  reference: true,
  publishedAt: true,
  operation: true,
  propertyType: true,
  provinceCode: true,
  municipalities: true,
  zone: true,
  minPrice: true,
  maxPrice: true,
  minBedrooms: true,
  minBathrooms: true,
  minArea: true,
  maxArea: true,
  terrace: true,
  elevator: true,
  parking: true,
  exterior: true,
  condition: true,
  publicText: true,
} satisfies Prisma.SearchRequestSelect;
export type PublicSearchRequest = Prisma.SearchRequestGetPayload<{ select: typeof PUBLIC_SEARCH_SELECT }>;

export interface PublicSearchFilters {
  operation?: string;
  provinceCode?: string;
  municipality?: string;
  budgetMin?: number;
  budgetMax?: number;
}

export async function listPublicSearchRequests(f: PublicSearchFilters = {}) {
  return prisma.searchRequest.findMany({
    where: {
      status: "PUBLISHED",
      ...(f.operation === "SALE" || f.operation === "RENT" ? { operation: f.operation } : {}),
      ...(f.provinceCode && isPortalProvince(f.provinceCode) ? { provinceCode: f.provinceCode } : {}),
      ...(f.municipality ? { municipalities: { contains: f.municipality.trim() } } : {}),
      ...budgetWhere(f.budgetMin, f.budgetMax),
    },
    select: PUBLIC_SEARCH_SELECT,
    orderBy: { publishedAt: "desc" },
    take: 200,
  });
}
