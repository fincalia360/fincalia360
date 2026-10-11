// Traducción de los anuncios (título y textos) al catalán, inglés, alemán y francés con IA.
// - El original es siempre el español que escribe el administrador; las traducciones se guardan con
//   una «huella» del original y se descartan solas si el texto en español cambia.
// - La IA se llama desde el servidor (clave nunca en el navegador), con registro de uso en AiUsage.
// - El administrador puede revisar y corregir cada traducción en el panel.
// - Sin IA configurada o si falla, la ficha se muestra con el texto original en español.
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/db/client";
import { claudeConfigured, claudeModel, claudeReply } from "@/services/ai/claudeClient";

export const TRANSLATION_LANGS = ["ca", "en", "de", "fr"] as const;
export type TranslationLang = (typeof TRANSLATION_LANGS)[number];
const LANG_NAMES: Record<TranslationLang, string> = { ca: "catalán", en: "inglés (británico)", de: "alemán", fr: "francés" };

export const TRANSLATABLE = ["title", "description", "extraInfo", "distribution", "rentConditions"] as const;
type Field = (typeof TRANSLATABLE)[number];
export type ListingTexts = Partial<Record<Field, string>>;

export interface StoredTranslations {
  sourceHash: string;
  updatedAt: string;
  /** Traducciones revisadas o corregidas a mano por el administrador. */
  reviewed?: Partial<Record<TranslationLang, boolean>>;
  langs: Partial<Record<TranslationLang, ListingTexts>>;
}

type Source = { title: string; description: string; extraInfo?: string | null; distribution?: string | null; rentConditions?: string | null };

export function sourceTexts(l: Source): ListingTexts {
  const out: ListingTexts = {};
  for (const f of TRANSLATABLE) {
    const v = l[f];
    if (typeof v === "string" && v.trim()) out[f] = v.trim();
  }
  return out;
}

export function sourceHash(l: Source) {
  return createHash("sha256").update(JSON.stringify(sourceTexts(l))).digest("hex").slice(0, 16);
}

export function parseStored(json: string | null | undefined): StoredTranslations | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as StoredTranslations;
    return v && typeof v === "object" && v.langs ? v : null;
  } catch {
    return null;
  }
}

/** ¿Las traducciones guardadas corresponden al texto actual en español? */
export function translationsFresh(l: Source & { translations?: string | null }) {
  const t = parseStored(l.translations);
  return Boolean(t && t.sourceHash === sourceHash(l));
}

/** Textos del anuncio en el idioma pedido (o el original en español si no hay traducción vigente). */
export function localizedTexts<T extends Source & { translations?: string | null }>(l: T, lang: string): ListingTexts & { translated: boolean } {
  const original = { ...sourceTexts(l), translated: false };
  if (lang === "es") return original;
  const t = parseStored(l.translations);
  if (!t || t.sourceHash !== sourceHash(l)) return original;
  const tr = t.langs[lang as TranslationLang];
  if (!tr?.title) return original;
  return { ...sourceTexts(l), ...tr, translated: true };
}

const SYSTEM = `Eres traductor profesional de anuncios inmobiliarios. Traduces del español al idioma indicado con naturalidad, como lo escribiría un nativo, manteniendo el tono profesional.

REGLAS:
- Traduce fielmente: no añadas, quites ni inventes información. Mantén cifras, medidas, precios, nombres propios, nombres de calles, municipios y puertos tal cual.
- Respeta los saltos de párrafo.
- Términos inmobiliarios correctos en cada idioma.
- Responde SOLO con un objeto JSON válido, sin texto antes ni después, con las mismas claves que recibes.`;

const textsSchema = z.object(Object.fromEntries(TRANSLATABLE.map((f) => [f, z.string().max(8000).optional()])) as Record<Field, z.ZodOptional<z.ZodString>>);

function parseJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Respuesta no válida");
  return JSON.parse(text.slice(start, end + 1));
}

export class TranslationError extends Error {}

/** Traduce el anuncio a los cuatro idiomas y guarda el resultado (sobrescribe las traducciones anteriores). */
export async function translateListing(listingId: string, adminId: string | null) {
  if (!claudeConfigured()) throw new TranslationError("La IA no está configurada (falta la clave ANTHROPIC_API_KEY en el servidor). El anuncio se mostrará en español en los otros idiomas.");
  const l = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!l) throw new TranslationError("Anuncio no encontrado");
  const texts = sourceTexts(l);
  const langs: StoredTranslations["langs"] = {};
  for (const lang of TRANSLATION_LANGS) {
    try {
      const reply = await claudeReply({
        system: SYSTEM,
        messages: [{ role: "user", content: `Traduce al ${LANG_NAMES[lang]} este anuncio (JSON):\n${JSON.stringify(texts)}` }],
        maxTokens: 2500,
      });
      const parsed = textsSchema.parse(parseJson(reply.text));
      langs[lang] = Object.fromEntries(Object.entries(parsed).filter(([k, v]) => v && k in texts)) as ListingTexts;
      await prisma.aiUsage.create({ data: { kind: "LISTING_TRANSLATE", adminId, listingId, model: claudeModel(), inputTokens: reply.inputTokens, outputTokens: reply.outputTokens } });
    } catch (e) {
      await prisma.aiUsage.create({ data: { kind: "LISTING_TRANSLATE", adminId, listingId, model: claudeModel(), ok: false, error: (e as Error).message.slice(0, 300) } }).catch(() => undefined);
      throw new TranslationError(`No se ha podido traducir al ${LANG_NAMES[lang]}. Inténtalo de nuevo más tarde.`);
    }
  }
  const stored: StoredTranslations = { sourceHash: sourceHash(l), updatedAt: new Date().toISOString(), langs };
  await prisma.listing.update({ where: { id: l.id }, data: { translations: JSON.stringify(stored) } });
  return stored;
}

/** Guarda las traducciones revisadas o corregidas por el administrador. */
export async function saveTranslations(listingId: string, langs: StoredTranslations["langs"]) {
  const l = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!l) throw new TranslationError("Anuncio no encontrado");
  const clean: StoredTranslations["langs"] = {};
  const reviewed: StoredTranslations["reviewed"] = {};
  for (const lang of TRANSLATION_LANGS) {
    const t = langs[lang];
    if (!t) continue;
    const parsed = textsSchema.parse(t);
    const filtered = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v && v.trim())) as ListingTexts;
    if (filtered.title) {
      clean[lang] = filtered;
      reviewed[lang] = true;
    }
  }
  const stored: StoredTranslations = { sourceHash: sourceHash(l), updatedAt: new Date().toISOString(), reviewed, langs: clean };
  await prisma.listing.update({ where: { id: l.id }, data: { translations: JSON.stringify(stored) } });
  return stored;
}

/** Al publicar: si hay IA y las traducciones no están al día, se traducen (si falla, se publica igualmente en español). */
export async function translateIfStale(listingId: string, adminId: string | null) {
  if (!claudeConfigured()) return { ok: false as const, reason: "not_configured" };
  const l = await prisma.listing.findUnique({ where: { id: listingId }, select: { title: true, description: true, extraInfo: true, distribution: true, rentConditions: true, translations: true } });
  if (!l || translationsFresh(l)) return { ok: true as const, reason: "fresh" };
  try {
    await translateListing(listingId, adminId);
    return { ok: true as const, reason: "translated" };
  } catch (e) {
    return { ok: false as const, reason: (e as Error).message };
  }
}
