// «Busco piso»: tipos, estados y equivalencias con los tipos de inmueble de los anuncios.

export const SEARCH_STATUSES = {
  PENDING: "Pendiente de revisión",
  PUBLISHED: "Publicada",
  HIDDEN: "Oculta / retirada",
  REJECTED: "Rechazada",
  RESOLVED: "Resuelta (ya encontró vivienda)",
} as const;
export type SearchStatus = keyof typeof SEARCH_STATUSES;
/** Color de la etiqueta de estado en el panel. */
export const SEARCH_TONES = { PENDING: "blue", PUBLISHED: "green", HIDDEN: "amber", REJECTED: "neutral", RESOLVED: "neutral" } as const;

/** Tipos que puede pedir quien busca vivienda. */
export const SEARCH_TYPES = {
  PISO: "Piso",
  ATICO: "Ático",
  CASA_CHALET: "Casa o chalet",
  ADOSADA: "Casa adosada",
  ESTUDIO: "Estudio",
  TERRENO: "Terreno",
  LOCAL: "Local comercial",
  GARAJE: "Garaje",
  OTRO: "Otro",
} as const;
export type SearchType = keyof typeof SEARCH_TYPES;

/**
 * Tipos de anuncio que corresponden a cada tipo buscado (catálogo de services/listings/catalog.ts).
 * Los anuncios no distinguen «casa adosada»: se comparan con «Casa» y se indica en el motivo.
 * «Otro» no limita el tipo.
 */
export const LISTING_TYPES_FOR: Record<SearchType, string[]> = {
  PISO: ["PISO", "DUPLEX"],
  ATICO: ["ATICO"],
  CASA_CHALET: ["CASA", "CHALET"],
  ADOSADA: ["CASA"],
  ESTUDIO: ["ESTUDIO"],
  TERRENO: ["TERRENO"],
  LOCAL: ["LOCAL"],
  GARAJE: ["GARAJE"],
  OTRO: [],
};

/** Tipos parecidos: no coinciden exactamente, pero pueden interesar (coincidencia parcial). */
export const RELATED_LISTING_TYPES: Record<SearchType, string[]> = {
  PISO: ["ATICO", "ESTUDIO"],
  ATICO: ["PISO", "DUPLEX"],
  CASA_CHALET: [],
  ADOSADA: ["CHALET"],
  ESTUDIO: ["PISO"],
  TERRENO: [],
  LOCAL: ["OFICINA"],
  GARAJE: [],
  OTRO: [],
};

export const PREFERENCES = { YES: "Sí", NO: "No", ANY: "Indiferente" } as const;
export type Preference = keyof typeof PREFERENCES;

export const SEARCH_CONDITIONS = { NEW: "A estrenar", GOOD: "Buen estado", TO_REFORM: "Para reformar", ANY: "Indiferente" } as const;
export type SearchCondition = keyof typeof SEARCH_CONDITIONS;

/** Característica del anuncio (lista «features») que corresponde a cada preferencia. */
export const PREFERENCE_FEATURES = { terrace: "TERRACE", elevator: "ELEVATOR", parking: "PARKING", exterior: "EXTERIOR" } as const;

export const MAX_MUNICIPALITIES = 10;
export const MUNICIPALITY_SEPARATOR = "|";

export function splitMunicipalities(value: string) {
  return value
    .split(MUNICIPALITY_SEPARATOR)
    .map((m) => m.trim())
    .filter(Boolean);
}

/** Compara nombres de municipio sin acentos, artículos ni el orden oficial del INE («Hospitalet de Llobregat, L'»). */
export function normalizeMunicipality(name: string) {
  let s = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .trim();
  const tail = s.match(/^(.*),\s*(l'|el|la|els|les|lo|los|las|s')$/);
  if (tail) s = tail[1];
  s = s.replace(/^(l'|el |la |els |les |lo |los |las |s')/, "");
  return s.replace(/[^a-z0-9]+/g, " ").trim();
}
