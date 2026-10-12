// Catálogos del portal inmobiliario (etiquetas en español). Sin dependencias de servidor: se usan
// también en componentes de cliente.

/** El portal de compra y alquiler solo publica inmuebles de Cataluña (la valoración es para toda España). */
export const PORTAL_REGION = "Cataluña";
export const PORTAL_PROVINCE_CODES: readonly string[] = ["08", "17", "25", "43"]; // Barcelona, Girona, Lleida, Tarragona
export const isPortalProvince = (code: string | null | undefined) => Boolean(code && PORTAL_PROVINCE_CODES.includes(code));

export const OPERATIONS = { SALE: "Venta", RENT: "Alquiler", TRANSFER: "Traspaso" } as const;
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

/** Viviendas e inmuebles, o amarres náuticos (sección propia del portal). */
export const CATEGORIES = { HOME: "Vivienda o inmueble", MOORING: "Amarre", BUSINESS: "Negocio en traspaso" } as const;
export type Category = keyof typeof CATEGORIES;
/** Tipo interno de los anuncios de amarre (no aparece en los filtros de viviendas). */
export const MOORING_PROPERTY_TYPE = "AMARRE";

/**
 * Negocios en traspaso (category = BUSINESS, operation = TRANSFER). El tipo es la actividad del negocio.
 * El precio es el del traspaso (pago único); el alquiler mensual del local va aparte (premisesRent).
 */
export const BUSINESS_TYPES = {
  NEG_BAR_RESTAURANTE: "Bar o restaurante",
  NEG_CAFETERIA: "Cafetería",
  NEG_COMERCIO: "Comercio",
  NEG_ESTETICA: "Peluquería o centro de estética",
  NEG_HOSTELERIA: "Hostelería y alojamiento",
  NEG_OFICINA: "Oficina y servicios",
  NEG_OTRO: "Otro negocio",
} as const;
export type BusinessTypeCode = keyof typeof BUSINESS_TYPES;
export const isBusinessType = (t: string | null | undefined) => Boolean(t && t in BUSINESS_TYPES);

export const BUSINESS_FEATURES = {
  ACTIVITY_LICENSE: "Licencia de actividad en vigor",
  TERRACE_LICENSE: "Licencia de terraza",
  SMOKE_OUTLET: "Salida de humos",
  EQUIPMENT_INCLUDED: "Mobiliario y maquinaria incluidos",
  FITTED_OUT: "Local acondicionado, listo para abrir",
  STREET_LEVEL: "A pie de calle",
  SHOP_WINDOW: "Escaparate",
  STOREROOM: "Almacén",
  AC: "Aire acondicionado",
  ACCESSIBLE: "Accesible",
  STAFF: "Posibilidad de mantener el personal",
  CLIENTELE: "Clientela consolidada",
} as const;

export const MOORING_TYPES = {
  PONTOON: "Pantalán",
  FINGER: "Pantalán con finger",
  DOCK: "Muelle",
  BUOY: "Boya o fondeo",
  DRY_STACK: "Marina seca (en tierra)",
  OTHER: "Otro",
} as const;
export type MooringTypeCode = keyof typeof MOORING_TYPES;

export const MOORING_FEATURES = {
  WATER: "Toma de agua",
  ELECTRICITY: "Toma de electricidad",
  WIFI: "Wifi",
  SECURITY: "Vigilancia 24 h",
  SHOWERS: "Duchas y aseos",
  PARKING_CAR: "Aparcamiento para coche",
  FUEL: "Gasolinera",
  TRAVEL_LIFT: "Grúa o travel-lift",
  BOATYARD: "Varadero",
  RESTAURANTS: "Restaurantes y servicios",
  SHELTERED: "Zona abrigada",
  SEAFRONT: "Acceso directo al mar",
} as const;
export type MooringFeatureCode = keyof typeof MOORING_FEATURES;

export const RENT_PERIODS = { DAY: "día", WEEK: "semana", MONTH: "mes", SEASON: "temporada", YEAR: "año" } as const;
export type RentPeriod = keyof typeof RENT_PERIODS;

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

/** Locales comerciales y oficinas. */
export const COMMERCIAL_FEATURES = {
  STREET_LEVEL: "A pie de calle",
  SHOP_WINDOW: "Escaparate",
  CORNER: "Haciendo esquina",
  SMOKE_OUTLET: "Salida de humos",
  ACTIVITY_LICENSE: "Licencia de actividad",
  FITTED_OUT: "Acondicionado, listo para usar",
  STOREROOM: "Almacén",
  MEETING_ROOM: "Sala de reuniones",
  RECEPTION: "Recepción",
  AC: "Aire acondicionado",
  HEATING: "Calefacción",
  ELEVATOR: "Ascensor",
  ACCESSIBLE: "Accesible",
  PARKING: "Plaza de garaje",
  SECURITY: "Vigilancia o alarma",
} as const;

/** Garajes y plazas de aparcamiento. */
export const GARAGE_FEATURES = {
  COVERED: "Cubierta",
  CLOSED_BOX: "Plaza cerrada (box)",
  AUTO_DOOR: "Puerta automática",
  EASY_ACCESS: "Fácil maniobra",
  EV_CHARGER: "Punto de carga eléctrica",
  MOTORBIKE: "Apta para moto",
  SECURITY: "Vigilancia o alarma",
  STORAGE: "Trastero",
} as const;

/** Terrenos y solares. */
export const LAND_FEATURES = {
  WATER_SUPPLY: "Acometida de agua",
  POWER_SUPPLY: "Acometida de luz",
  SEWER: "Alcantarillado",
  PAVED_ACCESS: "Acceso asfaltado",
  FENCED: "Vallado",
  VIEWS: "Vistas",
} as const;

/** Clasificación urbanística (solo si consta en información verificada). */
export const LAND_CLASSIFICATIONS = { URBAN: "Suelo urbano", DEVELOPABLE: "Suelo urbanizable", RUSTIC: "Suelo rústico (no urbanizable)" } as const;
export const LAND_USES = {
  RESIDENTIAL: "Residencial",
  COMMERCIAL: "Terciario o comercial",
  INDUSTRIAL: "Industrial",
  AGRICULTURAL: "Agrícola",
  MIXED: "Mixto",
  OTHER: "Otro",
} as const;

/**
 * Qué campos tiene cada tipo de inmueble. El formulario del panel, los filtros y la ficha
 * muestran solo los que corresponden.
 */
export type FieldKind = "DWELLING" | "COMMERCIAL" | "GARAGE" | "LAND" | "MOORING" | "BUSINESS" | "OTHER";

/** Grupos del menú VENTA / ALQUILER (submenús y filtro «tipo de inmueble»). */
export const PROPERTY_GROUPS = {
  pisos: { label: "Pisos y apartamentos", types: ["PISO", "ATICO", "DUPLEX", "ESTUDIO"], kind: "DWELLING" },
  casas: { label: "Casas y chalets", types: ["CASA", "CHALET"], kind: "DWELLING" },
  locales: { label: "Locales comerciales", types: ["LOCAL"], kind: "COMMERCIAL" },
  oficinas: { label: "Oficinas", types: ["OFICINA"], kind: "COMMERCIAL" },
  garajes: { label: "Garajes y plazas de aparcamiento", types: ["GARAJE"], kind: "GARAGE" },
  terrenos: { label: "Terrenos y solares", types: ["TERRENO"], kind: "LAND" },
  amarres: { label: "Amarres náuticos", types: ["AMARRE"], kind: "MOORING" },
  otros: { label: "Otros inmuebles", types: ["OTRO"], kind: "OTHER" },
} as const satisfies Record<string, { label: string; types: readonly string[]; kind: FieldKind }>;
export type PropertyGroup = keyof typeof PROPERTY_GROUPS;
/** Grupos que se buscan en /comprar y /alquilar (los amarres tienen su propia búsqueda, con el mismo diseño). */
export const HOME_SEARCH_GROUPS = (Object.keys(PROPERTY_GROUPS) as PropertyGroup[]).filter((g) => g !== "amarres");

export function kindOf(l: { category?: string | null; propertyType: string }): FieldKind {
  if (l.category === "MOORING" || l.propertyType === MOORING_PROPERTY_TYPE) return "MOORING";
  if (l.category === "BUSINESS" || isBusinessType(l.propertyType)) return "BUSINESS";
  return (Object.values(PROPERTY_GROUPS).find((g) => (g.types as readonly string[]).includes(l.propertyType))?.kind ?? "OTHER") as FieldKind;
}

export function groupOfType(propertyType: string): PropertyGroup | null {
  return (Object.keys(PROPERTY_GROUPS) as PropertyGroup[]).find((g) => (PROPERTY_GROUPS[g].types as readonly string[]).includes(propertyType)) ?? null;
}

export const FEATURES_BY_KIND: Record<FieldKind, Record<string, string>> = {
  DWELLING: FEATURES,
  COMMERCIAL: COMMERCIAL_FEATURES,
  GARAGE: GARAGE_FEATURES,
  LAND: LAND_FEATURES,
  MOORING: MOORING_FEATURES,
  BUSINESS: BUSINESS_FEATURES,
  OTHER: FEATURES,
};

/** Todas las etiquetas de características (para mostrarlas en fichas y filtros). */
export const ALL_FEATURE_LABELS: Record<string, string> = { ...FEATURES, ...COMMERCIAL_FEATURES, ...GARAGE_FEATURES, ...LAND_FEATURES, ...MOORING_FEATURES, ...BUSINESS_FEATURES };

/** El certificado energético es obligatorio en viviendas, locales y oficinas (no en garajes, terrenos ni amarres). */
export const needsEnergyCertificate = (kind: FieldKind) => kind === "DWELLING" || kind === "COMMERCIAL";

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
  UNPUBLISHED: "Retirado",
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

export function formatPrice(price: number, operation: string, rentPeriod?: string | null) {
  const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(price);
  if (operation !== "RENT") return eur;
  return `${eur}/${RENT_PERIODS[(rentPeriod ?? "MONTH") as RentPeriod] ?? "mes"}`;
}

/** «12 m» / «3,5 m» */
export function formatMeters(v: number | null | undefined) {
  return v == null ? null : `${v.toLocaleString("es-ES", { maximumFractionDigits: 2 })} m`;
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

/** Dirección clara: /inmueble/piso-3-habitaciones-girona-f360-ab12cd · /amarre/amarre-venta-12-m-port-de-roses-f360-ab12cd */
export function buildSlug(l: {
  category?: string | null;
  propertyType: string;
  bedrooms?: number | null;
  municipality: string;
  operation: string;
  reference: string;
  berthLength?: number | null;
  portName?: string | null;
  slugText?: string | null;
}) {
  // Texto de la dirección elegido por el administrador (SEO); la referencia final la mantiene estable
  const custom = l.slugText ? slugify(l.slugText) : "";
  if (custom) return `${custom}-${l.reference.toLowerCase()}`;
  if (l.category === "BUSINESS") {
    const parts = ["traspaso", BUSINESS_TYPES[l.propertyType as BusinessTypeCode] ?? "negocio", l.municipality];
    return `${slugify(parts.filter(Boolean).join(" "))}-${l.reference.toLowerCase()}`;
  }
  if (l.category === "MOORING") {
    const parts = ["amarre", l.operation === "RENT" ? "alquiler" : "venta", l.berthLength ? `${String(l.berthLength).replace(".", "-")} m` : "", l.portName ?? "", l.municipality];
    return `${slugify(parts.filter(Boolean).join(" "))}-${l.reference.toLowerCase()}`;
  }
  const type = PROPERTY_TYPES[l.propertyType as PropertyTypeCode] ?? "inmueble";
  const parts = [type, l.operation === "RENT" ? "alquiler" : "venta", l.bedrooms ? `${l.bedrooms}-habitaciones` : "", l.municipality];
  return `${slugify(parts.filter(Boolean).join(" "))}-${l.reference.toLowerCase()}`;
}

/** La referencia va al final de la dirección: así un cambio de título no rompe los enlaces compartidos. */
export function referenceFromSlug(slug: string) {
  const m = slug.match(/(f360-[a-z0-9]{6})$/i);
  return m ? m[1].toUpperCase() : null;
}

export function listingPath(l: { slug: string; category?: string | null }) {
  if (l.category === "BUSINESS") return `/traspaso/${l.slug}`;
  return l.category === "MOORING" ? `/amarre/${l.slug}` : `/inmueble/${l.slug}`;
}

export function photoUrl(key: string, thumb = false) {
  return `/media/${thumb ? key.replace(/\.webp$/, "-thumb.webp") : key}`;
}

export const PUBLICATION_REQUEST_STATUSES = { NEW: "Nueva", IN_REVIEW: "En revisión", CONVERTED: "Anuncio creado", REJECTED: "Descartada" } as const;
export type PublicationRequestStatus = keyof typeof PUBLICATION_REQUEST_STATUSES;
