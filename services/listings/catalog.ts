// Catálogos del portal inmobiliario (etiquetas en español). Sin dependencias de servidor: se usan
// también en componentes de cliente.

export const OPERATIONS = { SALE: "Venta", RENT: "Alquiler" } as const;
export type Operation = keyof typeof OPERATIONS;

export const PROPERTY_TYPES = {
  PISO: "Piso",
  ATICO: "Ático",
  DUPLEX: "Dúplex",
  ESTUDIO: "Estudio",
  CASA: "Casa",
  CHALET: "Chalet",
  LOCAL: "Local",
  OFICINA: "Oficina",
  GARAJE: "Garaje",
  TERRENO: "Terreno",
  OTRO: "Otro",
} as const;
export type PropertyTypeCode = keyof typeof PROPERTY_TYPES;

export const CONDITIONS = { NEW: "Obra nueva", GOOD: "Buen estado", TO_REFORM: "A reformar" } as const;

export const FEATURES = {
  ELEVATOR: "Ascensor",
  TERRACE: "Terraza",
  BALCONY: "Balcón",
  PARKING: "Plaza de garaje",
  STORAGE: "Trastero",
  POOL: "Piscina",
  GARDEN: "Jardín",
  AC: "Aire acondicionado",
  HEATING: "Calefacción",
  FURNISHED: "Amueblado",
  EQUIPPED_KITCHEN: "Cocina equipada",
  BUILT_IN_WARDROBES: "Armarios empotrados",
  EXTERIOR: "Exterior",
  VIEWS: "Vistas",
  ACCESSIBLE: "Accesible",
  PETS: "Admite mascotas",
} as const;
export type FeatureCode = keyof typeof FEATURES;

export const ENERGY_RATINGS = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  E: "E",
  F: "F",
  G: "G",
  IN_PROGRESS: "En trámite",
  EXEMPT: "Exento",
} as const;

export const RENTAL_TYPES = { HABITUAL: "Vivienda habitual (larga duración)", SEASONAL: "Temporada" } as const;

export const AUTHORIZATION_TYPES = {
  MANDATE_EXCLUSIVE: "Hoja de encargo en exclusiva",
  MANDATE_SHARED: "Hoja de encargo sin exclusiva",
  OWNER_SIGNED: "Autorización firmada por el propietario",
} as const;

export const LISTING_STATUSES = {
  DRAFT: "Borrador",
  REVIEW: "Pendiente de revisión",
  PUBLISHED: "Publicado",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  RENTED: "Alquilado",
  UNPUBLISHED: "Despublicado",
  ARCHIVED: "Archivado",
} as const;
export type ListingStatus = keyof typeof LISTING_STATUSES;

/** Estados que se ven en la web pública (reservado se muestra con su etiqueta). */
export const PUBLIC_STATUSES: ListingStatus[] = ["PUBLISHED", "RESERVED"];
/** Estados que cuentan para el límite de inmuebles activos de una inmobiliaria. */
export const ACTIVE_STATUSES: ListingStatus[] = ["DRAFT", "REVIEW", "PUBLISHED", "RESERVED"];

export const LISTING_STATUS_TONES: Record<string, "neutral" | "amber" | "green" | "terracotta" | "ink" | "violet" | "blue"> = {
  DRAFT: "neutral",
  REVIEW: "amber",
  PUBLISHED: "green",
  RESERVED: "terracotta",
  SOLD: "ink",
  RENTED: "ink",
  UNPUBLISHED: "neutral",
  ARCHIVED: "neutral",
};

export const INQUIRY_STATUSES = { NEW: "Nueva", HANDLED: "Atendida", DISCARDED: "Descartada" } as const;

export const MAX_PHOTOS = 30;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

export function formatPrice(price: number, operation: string) {
  const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(price);
  return operation === "RENT" ? `${eur}/mes` : eur;
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

/** Dirección clara: /inmueble/piso-3-habitaciones-girona-f360-ab12cd */
export function buildSlug(l: { propertyType: string; bedrooms?: number | null; municipality: string; operation: string; reference: string }) {
  const type = PROPERTY_TYPES[l.propertyType as PropertyTypeCode] ?? "inmueble";
  const parts = [type, l.operation === "RENT" ? "alquiler" : "venta", l.bedrooms ? `${l.bedrooms}-habitaciones` : "", l.municipality];
  return `${slugify(parts.filter(Boolean).join(" "))}-${l.reference.toLowerCase()}`;
}

/** La referencia va al final de la dirección: así un cambio de título no rompe los enlaces compartidos. */
export function referenceFromSlug(slug: string) {
  const m = slug.match(/(f360-[a-z0-9]{6})$/i);
  return m ? m[1].toUpperCase() : null;
}

export function listingPath(l: { slug: string }) {
  return `/inmueble/${l.slug}`;
}

export function photoUrl(key: string, thumb = false) {
  return `/media/${thumb ? key.replace(/\.webp$/, "-thumb.webp") : key}`;
}
