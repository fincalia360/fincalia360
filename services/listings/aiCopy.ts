// IA de redacción de anuncios (panel de administración). Propone título, descripción y campos SEO a
// partir SOLO de los datos del anuncio; el administrador revisa, edita y decide si publica.
// - Llamada desde el servidor (la clave ANTHROPIC_API_KEY nunca llega al navegador).
// - Límite diario de usos (AI_LISTING_DAILY_LIMIT, por defecto 60) y registro de tokens en AiUsage.
// - Sin clave o si el servicio falla, se informa y el anuncio se redacta a mano: nunca se simula.
// - Control antiinvención: cualquier cifra del texto que no esté en los datos se señala al administrador.
import { prisma } from "@/db/client";
import { claudeConfigured, claudeModel, claudeReply } from "@/services/ai/claudeClient";
import { getProvince } from "@/services/study/geo";
import {
  ALL_FEATURE_LABELS,
  CONDITIONS,
  ENERGY_RATINGS,
  LAND_CLASSIFICATIONS,
  LAND_USES,
  MOORING_TYPES,
  PROPERTY_TYPES,
  RENT_PERIODS,
  formatMeters,
  formatPrice,
  kindOf,
  slugify,
} from "./catalog";

export type CopyMode = "ALL" | "TITLE" | "DESCRIPTION";

export interface ListingCopy {
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  slugText: string;
}

export interface CopyResult {
  ok: boolean;
  error?: string;
  copy?: Partial<ListingCopy>;
  /** Avisos para el administrador (p. ej. cifras que no constan en los datos). */
  warnings?: string[];
}

export class AiCopyError extends Error {}

const dailyLimit = () => Number(process.env.AI_LISTING_DAILY_LIMIT ?? 60);
const model = () => claudeModel();

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
};

/** Datos del anuncio en lenguaje claro: lo ÚNICO que la IA puede usar. */
export function listingFacts(raw: Raw): Record<string, string> {
  const category = str(raw.propertyType) === "AMARRE" || str(raw.category) === "MOORING" ? "MOORING" : "HOME";
  const propertyType = category === "MOORING" ? "AMARRE" : str(raw.propertyType);
  const kind = kindOf({ category, propertyType });
  const operation = str(raw.operation) === "RENT" ? "RENT" : "SALE";
  const f: Record<string, string> = {};
  f["Tipo"] = category === "MOORING" ? "Amarre náutico" : (PROPERTY_TYPES[propertyType as keyof typeof PROPERTY_TYPES] ?? "Inmueble");
  f["Operación"] = operation === "RENT" ? "Alquiler" : "Venta";
  if (str(raw.municipality)) f["Municipio"] = str(raw.municipality);
  if (str(raw.zone)) f[category === "MOORING" ? "Ubicación en el puerto" : "Zona o barrio"] = str(raw.zone);
  const province = getProvince(str(raw.provinceCode))?.name;
  if (province) f["Provincia"] = province;
  const price = num(raw.price);
  if (price) f["Precio"] = formatPrice(price, operation, category === "MOORING" ? str(raw.rentPeriod) || "MONTH" : null);
  const fee = num(raw.communityFee);
  if (fee) f[category === "MOORING" ? "Gastos de mantenimiento" : "Gastos de comunidad"] = `${fee} €/mes`;
  const built = num(raw.builtArea);
  if (built) f[kind === "LAND" ? "Superficie del terreno" : "Superficie construida"] = `${built} m²`;
  const useful = num(raw.usefulArea);
  if (useful && kind !== "LAND" && kind !== "GARAGE" && kind !== "MOORING") f["Superficie útil"] = `${useful} m²`;
  if (kind === "DWELLING" || kind === "OTHER") {
    const b = num(raw.bedrooms);
    if (b != null) f["Habitaciones"] = String(b);
  }
  if (kind === "DWELLING" || kind === "COMMERCIAL" || kind === "OTHER") {
    const b = num(raw.bathrooms);
    if (b != null) f["Baños"] = String(b);
  }
  if (str(raw.floor) && kind !== "LAND" && kind !== "MOORING") f["Planta"] = str(raw.floor);
  const year = num(raw.yearBuilt);
  if (year && kind !== "LAND" && kind !== "MOORING") f["Año de construcción"] = String(year);
  const cond = str(raw.condition);
  if (cond && kind !== "LAND" && kind !== "MOORING") f["Estado"] = CONDITIONS[cond as keyof typeof CONDITIONS] ?? cond;
  if (kind === "COMMERCIAL" && str(raw.distribution)) f["Distribución"] = str(raw.distribution);
  if (kind === "LAND") {
    const c = str(raw.landClassification);
    if (c) f["Clasificación urbanística"] = LAND_CLASSIFICATIONS[c as keyof typeof LAND_CLASSIFICATIONS] ?? c;
    const u = str(raw.landUse);
    if (u) f["Uso permitido"] = LAND_USES[u as keyof typeof LAND_USES] ?? u;
  }
  if (kind === "GARAGE" || kind === "MOORING") {
    const len = num(raw.berthLength);
    const wid = num(raw.berthWidth);
    if (len) f[kind === "MOORING" ? "Longitud del amarre" : "Largo de la plaza"] = formatMeters(len)!;
    if (wid) f[kind === "MOORING" ? "Anchura del amarre" : "Ancho de la plaza"] = formatMeters(wid)!;
  }
  if (kind === "MOORING") {
    if (str(raw.portName)) f["Puerto"] = str(raw.portName);
    const ml = num(raw.maxBoatLength);
    if (ml) f["Eslora máxima admitida"] = formatMeters(ml)!;
    const mb = num(raw.maxBoatBeam);
    if (mb) f["Manga máxima admitida"] = formatMeters(mb)!;
    const d = num(raw.berthDepth);
    if (d) f["Calado"] = formatMeters(d)!;
    const t = str(raw.mooringType);
    if (t) f["Tipo de amarre"] = MOORING_TYPES[t as keyof typeof MOORING_TYPES] ?? t;
    const ce = num(raw.concessionEnd);
    if (ce) f["Fin de la concesión"] = String(ce);
    if (operation === "RENT") f["Periodicidad del alquiler"] = `por ${RENT_PERIODS[(str(raw.rentPeriod) || "MONTH") as keyof typeof RENT_PERIODS]}`;
  }
  const features = (Array.isArray(raw.features) ? raw.features : []).map((c) => ALL_FEATURE_LABELS[String(c)]).filter(Boolean);
  if (features.length) f["Características"] = features.join(", ");
  const energy = str(raw.energyRating);
  if (energy && kind !== "LAND" && kind !== "GARAGE" && kind !== "MOORING") f["Certificado energético"] = ENERGY_RATINGS[energy as keyof typeof ENERGY_RATINGS] ?? energy;
  if (str(raw.availableFrom)) f["Disponible desde"] = new Date(str(raw.availableFrom)).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  if (str(raw.rentConditions) && operation === "RENT") f["Condiciones del alquiler"] = str(raw.rentConditions);
  if (str(raw.extraInfo)) f["Información adicional"] = str(raw.extraInfo);
  if (str(raw.description)) f["Texto del anunciante"] = str(raw.description);
  return f;
}

const SYSTEM = `Eres redactor inmobiliario profesional en España y experto en SEO. Escribes anuncios de inmuebles y amarres en Cataluña, en español de España, claros, naturales y útiles.

REGLAS OBLIGATORIAS:
- Usa EXCLUSIVAMENTE los datos que te doy. No inventes nada: ni superficies, habitaciones, baños, precios, distancias, vistas, orientación, servicios cercanos, materiales, reformas, estado, transporte, colegios ni características que no aparezcan en los datos.
- Si un dato no está, no lo menciones ni lo supongas. No escribas cifras que no estén en los datos.
- No uses superlativos vacíos («increíble», «único», «el mejor», «oportunidad irrepetible») ni frases genéricas de relleno.
- No prometas posiciones en Google ni rentabilidades.
- Adapta el texto al tipo de inmueble y a si se vende o se alquila.
- Ortografía y gramática impecables.

FORMATO DE RESPUESTA: solo un objeto JSON válido, sin texto antes ni después, con estas claves:
{"title": "...", "description": "...", "seoTitle": "...", "seoDescription": "...", "slugText": "..."}
- title: 40–90 caracteres; natural, con el tipo de inmueble, la operación y la ubicación cuando se conozcan (ej.: «Piso en venta de 3 habitaciones en Girona»).
- description: 3–5 párrafos separados por una línea en blanco, sin títulos, sin viñetas ni markdown; 120–260 palabras; primero lo esencial (tipo, operación, ubicación, superficie, distribución), luego características y equipamiento, y al final condiciones (alquiler, disponibilidad) si constan.
- seoTitle: máximo 60 caracteres, con la palabra clave principal (tipo + operación + municipio).
- seoDescription: 120–155 caracteres, resumen atractivo y veraz.
- slugText: 3–8 palabras en minúsculas sin acentos separadas por guiones (tipo-operacion-municipio-rasgo).`;

function userPrompt(facts: Record<string, string>, mode: CopyMode, current: { title?: string; description?: string }) {
  const data = Object.entries(facts)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  const task =
    mode === "TITLE"
      ? `Mejora SOLO el título actual («${current.title ?? ""}»). Devuelve el JSON con "title" y "seoTitle" (deja las demás claves vacías).`
      : mode === "DESCRIPTION"
        ? `Mejora SOLO la descripción actual, conservando la información real. Devuelve el JSON con "description" y "seoDescription" (deja las demás claves vacías).\nDescripción actual:\n${current.description ?? ""}`
        : "Redacta el anuncio completo.";
  return `DATOS DEL ANUNCIO (únicos datos que puedes usar):\n${data}\n\nTAREA: ${task}`;
}

/** Extrae el objeto JSON de la respuesta del modelo. */
export function parseCopy(text: string): Partial<ListingCopy> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AiCopyError("La IA no ha devuelto un texto válido. Vuelve a intentarlo.");
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AiCopyError("La IA no ha devuelto un texto válido. Vuelve a intentarlo.");
  }
  const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+\n/g, "\n").trim().slice(0, max) : "");
  const out: Partial<ListingCopy> = {};
  const title = clean(obj.title, 110);
  if (title) out.title = title.replace(/^[«"']|[»"']$/g, "");
  const description = clean(obj.description, 6000).replace(/\n{3,}/g, "\n\n");
  if (description) out.description = description;
  const seoTitle = clean(obj.seoTitle, 70);
  if (seoTitle) out.seoTitle = seoTitle;
  const seoDescription = clean(obj.seoDescription, 170);
  if (seoDescription) out.seoDescription = seoDescription;
  const slugText = slugify(clean(obj.slugText, 120)).slice(0, 80);
  if (slugText) out.slugText = slugText;
  return out;
}

/** Números que aparecen en un texto, normalizados («250.000» → 250000, «3,5» → 3.5). */
export function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+(?:[.\s]\d{3})*(?:,\d+)?/g)]
    .map((m) => Number(m[0].replace(/[.\s](?=\d{3})/g, "").replace(",", ".")))
    .filter((n) => Number.isFinite(n));
}

/** Cifras del texto generado que NO están en los datos: posible invención que el administrador debe revisar. */
export function inventedNumbers(copy: Partial<ListingCopy>, facts: Record<string, string>): number[] {
  const known = new Set(numbersIn(Object.values(facts).join(" ")));
  const generated = numbersIn([copy.title, copy.description, copy.seoTitle, copy.seoDescription].filter(Boolean).join(" "));
  return [...new Set(generated.filter((n) => !known.has(n)))];
}

export function aiCopyConfigured() {
  return claudeConfigured();
}

export async function generateListingCopy(params: { raw: Raw; mode: CopyMode; adminId: string; listingId?: string | null }): Promise<CopyResult> {
  if (!aiCopyConfigured()) {
    return { ok: false, error: "La IA no está configurada (falta la clave ANTHROPIC_API_KEY en el servidor). Puedes redactar el anuncio a mano." };
  }
  const facts = listingFacts(params.raw);
  if (!facts["Municipio"] && !facts["Texto del anunciante"]) {
    return { ok: false, error: "Rellena antes al menos el tipo, la operación, el municipio y algunos datos del inmueble." };
  }
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const used = await prisma.aiUsage.count({ where: { createdAt: { gte: startOfDay } } });
  if (used >= dailyLimit()) return { ok: false, error: `Se ha alcanzado el límite diario de ${dailyLimit()} usos de la IA. Mañana vuelve a estar disponible; mientras, puedes redactar a mano.` };

  const kind = params.mode === "ALL" ? "LISTING_COPY" : params.mode === "TITLE" ? "LISTING_TITLE" : "LISTING_DESCRIPTION";
  try {
    const reply = await claudeReply({
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt(facts, params.mode, { title: str(params.raw.title), description: str(params.raw.description) }) }],
      maxTokens: params.mode === "TITLE" ? 300 : 1500,
    });
    const copy = parseCopy(reply.text);
    await prisma.aiUsage.create({
      data: { kind, adminId: params.adminId, listingId: params.listingId ?? null, model: model(), inputTokens: reply.inputTokens, outputTokens: reply.outputTokens },
    });
    const invented = inventedNumbers(copy, facts);
    const warnings = invented.length
      ? [`Revisa el texto: menciona ${invented.map((n) => n.toLocaleString("es-ES")).join(", ")}, que no está en los datos del anuncio. Corrígelo o bórralo antes de publicar.`]
      : [];
    return { ok: true, copy, warnings };
  } catch (e) {
    const message = e instanceof AiCopyError ? e.message : "El servicio de IA no ha respondido. Inténtalo de nuevo o redacta el anuncio a mano.";
    await prisma.aiUsage
      .create({ data: { kind, adminId: params.adminId, listingId: params.listingId ?? null, model: model(), ok: false, error: (e as Error).message.slice(0, 300) } })
      .catch(() => undefined);
    return { ok: false, error: message };
  }
}

/** Uso de hoy (para mostrarlo en el panel). */
export async function aiUsageToday() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await prisma.aiUsage.findMany({ where: { createdAt: { gte: startOfDay } }, select: { inputTokens: true, outputTokens: true } });
  return { count: rows.length, limit: dailyLimit(), inputTokens: rows.reduce((s, r) => s + r.inputTokens, 0), outputTokens: rows.reduce((s, r) => s + r.outputTokens, 0) };
}
