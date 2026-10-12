// Etiquetas de los catálogos del portal (tipos, características, estados…) en cada idioma.
// En español se usan las del catálogo (services/listings/catalog.ts), que son la referencia.
import {
  ALL_FEATURE_LABELS,
  BUSINESS_FEATURES,
  BUSINESS_TYPES,
  CONDITIONS,
  ENERGY_RATINGS,
  LAND_CLASSIFICATIONS,
  LAND_USES,
  MOORING_TYPES,
  PROPERTY_TYPES,
  RENTAL_TYPES,
  RENT_PERIODS,
} from "@/services/listings/catalog";
import type { SiteLang } from "../site";

export interface CatalogLabels {
  types: Record<string, string>;
  features: Record<string, string>;
  conditions: Record<string, string>;
  energy: Record<string, string>;
  rentalTypes: Record<string, string>;
  mooringTypes: Record<string, string>;
  rentPeriods: Record<string, string>;
  landClasses: Record<string, string>;
  landUses: Record<string, string>;
}

const es: CatalogLabels = {
  types: { ...PROPERTY_TYPES, AMARRE: "Amarre" },
  features: ALL_FEATURE_LABELS,
  conditions: CONDITIONS,
  energy: ENERGY_RATINGS,
  rentalTypes: RENTAL_TYPES,
  mooringTypes: MOORING_TYPES,
  rentPeriods: RENT_PERIODS,
  landClasses: LAND_CLASSIFICATIONS,
  landUses: LAND_USES,
};

const ca: CatalogLabels = {
  types: { PISO: "Pis", ATICO: "Àtic", DUPLEX: "Dúplex", ESTUDIO: "Estudi", CASA: "Casa", CHALET: "Xalet", LOCAL: "Local", OFICINA: "Oficina", GARAJE: "Garatge", TERRENO: "Terreny", OTRO: "Altres", AMARRE: "Amarrador" },
  features: {
    ELEVATOR: "Ascensor", TERRACE: "Terrassa", BALCONY: "Balcó", PARKING: "Plaça d'aparcament", STORAGE: "Traster", POOL: "Piscina", GARDEN: "Jardí", AC: "Aire condicionat",
    HEATING: "Calefacció", FURNISHED: "Moblat", EQUIPPED_KITCHEN: "Cuina equipada", BUILT_IN_WARDROBES: "Armaris encastats", EXTERIOR: "Exterior", VIEWS: "Vistes", ACCESSIBLE: "Accessible", PETS: "S'admeten animals",
    STREET_LEVEL: "A peu de carrer", SHOP_WINDOW: "Aparador", CORNER: "Fent cantonada", SMOKE_OUTLET: "Sortida de fums", ACTIVITY_LICENSE: "Llicència d'activitat", FITTED_OUT: "Condicionat, a punt per fer servir",
    STOREROOM: "Magatzem", MEETING_ROOM: "Sala de reunions", RECEPTION: "Recepció", SECURITY: "Vigilància",
    COVERED: "Coberta", CLOSED_BOX: "Plaça tancada (box)", AUTO_DOOR: "Porta automàtica", EASY_ACCESS: "Fàcil maniobra", EV_CHARGER: "Punt de càrrega elèctrica", MOTORBIKE: "Apta per a moto",
    WATER_SUPPLY: "Escomesa d'aigua", POWER_SUPPLY: "Escomesa de llum", SEWER: "Clavegueram", PAVED_ACCESS: "Accés asfaltat", FENCED: "Tancat",
    WATER: "Presa d'aigua", ELECTRICITY: "Presa d'electricitat", WIFI: "Wifi", SHOWERS: "Dutxes i lavabos", PARKING_CAR: "Aparcament per a cotxe", FUEL: "Benzinera", TRAVEL_LIFT: "Grua o travel-lift",
    BOATYARD: "Varador", RESTAURANTS: "Restaurants i serveis", SHELTERED: "Zona arrecerada", SEAFRONT: "Accés directe al mar",
  },
  conditions: { NEW: "Obra nova", GOOD: "Bon estat", TO_REFORM: "Per reformar" },
  energy: { ...ENERGY_RATINGS, IN_PROGRESS: "En tràmit", EXEMPT: "Exempt" },
  rentalTypes: { HABITUAL: "Habitatge habitual (llarga durada)", SEASONAL: "Temporada" },
  mooringTypes: { PONTOON: "Pantalà", FINGER: "Pantalà amb finger", DOCK: "Moll", BUOY: "Boia o fondeig", DRY_STACK: "Marina seca (a terra)", OTHER: "Altres" },
  rentPeriods: { DAY: "dia", WEEK: "setmana", MONTH: "mes", SEASON: "temporada", YEAR: "any" },
  landClasses: { URBAN: "Sòl urbà", DEVELOPABLE: "Sòl urbanitzable", RUSTIC: "Sòl rústic (no urbanitzable)" },
  landUses: { RESIDENTIAL: "Residencial", COMMERCIAL: "Terciari o comercial", INDUSTRIAL: "Industrial", AGRICULTURAL: "Agrícola", MIXED: "Mixt", OTHER: "Altres" },
};

const en: CatalogLabels = {
  types: { PISO: "Flat", ATICO: "Penthouse", DUPLEX: "Duplex", ESTUDIO: "Studio", CASA: "House", CHALET: "Detached house", LOCAL: "Commercial premises", OFICINA: "Office", GARAJE: "Parking space", TERRENO: "Land", OTRO: "Other", AMARRE: "Mooring" },
  features: {
    ELEVATOR: "Lift", TERRACE: "Terrace", BALCONY: "Balcony", PARKING: "Parking space", STORAGE: "Storage room", POOL: "Swimming pool", GARDEN: "Garden", AC: "Air conditioning",
    HEATING: "Heating", FURNISHED: "Furnished", EQUIPPED_KITCHEN: "Fitted kitchen", BUILT_IN_WARDROBES: "Built-in wardrobes", EXTERIOR: "Exterior-facing", VIEWS: "Views", ACCESSIBLE: "Accessible", PETS: "Pets allowed",
    STREET_LEVEL: "Street level", SHOP_WINDOW: "Shop window", CORNER: "Corner location", SMOKE_OUTLET: "Smoke extraction", ACTIVITY_LICENSE: "Business licence", FITTED_OUT: "Fitted out, ready to use",
    STOREROOM: "Storeroom", MEETING_ROOM: "Meeting room", RECEPTION: "Reception", SECURITY: "Security",
    COVERED: "Covered", CLOSED_BOX: "Closed garage (box)", AUTO_DOOR: "Automatic door", EASY_ACCESS: "Easy manoeuvring", EV_CHARGER: "EV charging point", MOTORBIKE: "Suitable for motorbike",
    WATER_SUPPLY: "Water connection", POWER_SUPPLY: "Electricity connection", SEWER: "Sewerage", PAVED_ACCESS: "Paved access", FENCED: "Fenced",
    WATER: "Water point", ELECTRICITY: "Electricity point", WIFI: "Wi-Fi", SHOWERS: "Showers and toilets", PARKING_CAR: "Car parking", FUEL: "Fuel station", TRAVEL_LIFT: "Crane or travel lift",
    BOATYARD: "Boatyard", RESTAURANTS: "Restaurants and services", SHELTERED: "Sheltered area", SEAFRONT: "Direct sea access",
  },
  conditions: { NEW: "New build", GOOD: "Good condition", TO_REFORM: "Needs renovation" },
  energy: { ...ENERGY_RATINGS, IN_PROGRESS: "Pending", EXEMPT: "Exempt" },
  rentalTypes: { HABITUAL: "Main residence (long term)", SEASONAL: "Seasonal" },
  mooringTypes: { PONTOON: "Pontoon", FINGER: "Pontoon with finger", DOCK: "Quay", BUOY: "Buoy or anchorage", DRY_STACK: "Dry stack (on land)", OTHER: "Other" },
  rentPeriods: { DAY: "day", WEEK: "week", MONTH: "month", SEASON: "season", YEAR: "year" },
  landClasses: { URBAN: "Urban land", DEVELOPABLE: "Developable land", RUSTIC: "Rural land (non-developable)" },
  landUses: { RESIDENTIAL: "Residential", COMMERCIAL: "Commercial", INDUSTRIAL: "Industrial", AGRICULTURAL: "Agricultural", MIXED: "Mixed", OTHER: "Other" },
};

const de: CatalogLabels = {
  types: { PISO: "Wohnung", ATICO: "Penthouse", DUPLEX: "Maisonette", ESTUDIO: "Studio", CASA: "Haus", CHALET: "Villa", LOCAL: "Gewerbefläche", OFICINA: "Büro", GARAJE: "Stellplatz", TERRENO: "Grundstück", OTRO: "Sonstiges", AMARRE: "Liegeplatz" },
  features: {
    ELEVATOR: "Aufzug", TERRACE: "Terrasse", BALCONY: "Balkon", PARKING: "Stellplatz", STORAGE: "Abstellraum", POOL: "Pool", GARDEN: "Garten", AC: "Klimaanlage",
    HEATING: "Heizung", FURNISHED: "Möbliert", EQUIPPED_KITCHEN: "Einbauküche", BUILT_IN_WARDROBES: "Einbauschränke", EXTERIOR: "Außenlage", VIEWS: "Aussicht", ACCESSIBLE: "Barrierefrei", PETS: "Haustiere erlaubt",
    STREET_LEVEL: "Ebenerdig zur Straße", SHOP_WINDOW: "Schaufenster", CORNER: "Ecklage", SMOKE_OUTLET: "Rauchabzug", ACTIVITY_LICENSE: "Gewerbegenehmigung", FITTED_OUT: "Ausgebaut, sofort nutzbar",
    STOREROOM: "Lager", MEETING_ROOM: "Besprechungsraum", RECEPTION: "Empfang", SECURITY: "Sicherheitsdienst",
    COVERED: "Überdacht", CLOSED_BOX: "Geschlossene Box", AUTO_DOOR: "Automatisches Tor", EASY_ACCESS: "Leichtes Rangieren", EV_CHARGER: "E-Ladestation", MOTORBIKE: "Für Motorrad geeignet",
    WATER_SUPPLY: "Wasseranschluss", POWER_SUPPLY: "Stromanschluss", SEWER: "Kanalisation", PAVED_ACCESS: "Asphaltierte Zufahrt", FENCED: "Eingezäunt",
    WATER: "Wasseranschluss", ELECTRICITY: "Stromanschluss", WIFI: "WLAN", SHOWERS: "Duschen und WCs", PARKING_CAR: "Autoparkplatz", FUEL: "Tankstelle", TRAVEL_LIFT: "Kran oder Travellift",
    BOATYARD: "Werft", RESTAURANTS: "Restaurants und Service", SHELTERED: "Geschützter Bereich", SEAFRONT: "Direkter Meerzugang",
  },
  conditions: { NEW: "Neubau", GOOD: "Guter Zustand", TO_REFORM: "Renovierungsbedürftig" },
  energy: { ...ENERGY_RATINGS, IN_PROGRESS: "In Bearbeitung", EXEMPT: "Befreit" },
  rentalTypes: { HABITUAL: "Hauptwohnsitz (langfristig)", SEASONAL: "Saisonmiete" },
  mooringTypes: { PONTOON: "Steg", FINGER: "Steg mit Fingersteg", DOCK: "Kai", BUOY: "Boje oder Ankerplatz", DRY_STACK: "Trockenliegeplatz (an Land)", OTHER: "Sonstiges" },
  rentPeriods: { DAY: "Tag", WEEK: "Woche", MONTH: "Monat", SEASON: "Saison", YEAR: "Jahr" },
  landClasses: { URBAN: "Bauland", DEVELOPABLE: "Bauerwartungsland", RUSTIC: "Außenbereich (nicht bebaubar)" },
  landUses: { RESIDENTIAL: "Wohnen", COMMERCIAL: "Gewerbe", INDUSTRIAL: "Industrie", AGRICULTURAL: "Landwirtschaft", MIXED: "Gemischt", OTHER: "Sonstiges" },
};

const fr: CatalogLabels = {
  types: { PISO: "Appartement", ATICO: "Attique", DUPLEX: "Duplex", ESTUDIO: "Studio", CASA: "Maison", CHALET: "Villa", LOCAL: "Local commercial", OFICINA: "Bureau", GARAJE: "Place de parking", TERRENO: "Terrain", OTRO: "Autre", AMARRE: "Anneau d'amarrage" },
  features: {
    ELEVATOR: "Ascenseur", TERRACE: "Terrasse", BALCONY: "Balcon", PARKING: "Place de parking", STORAGE: "Cave / débarras", POOL: "Piscine", GARDEN: "Jardin", AC: "Climatisation",
    HEATING: "Chauffage", FURNISHED: "Meublé", EQUIPPED_KITCHEN: "Cuisine équipée", BUILT_IN_WARDROBES: "Placards intégrés", EXTERIOR: "Donnant sur l'extérieur", VIEWS: "Vue", ACCESSIBLE: "Accessible", PETS: "Animaux acceptés",
    STREET_LEVEL: "Plain-pied sur rue", SHOP_WINDOW: "Vitrine", CORNER: "Situé à l'angle", SMOKE_OUTLET: "Extraction de fumées", ACTIVITY_LICENSE: "Licence d'activité", FITTED_OUT: "Aménagé, prêt à l'emploi",
    STOREROOM: "Réserve", MEETING_ROOM: "Salle de réunion", RECEPTION: "Accueil", SECURITY: "Surveillance",
    COVERED: "Couverte", CLOSED_BOX: "Box fermé", AUTO_DOOR: "Porte automatique", EASY_ACCESS: "Manœuvre facile", EV_CHARGER: "Borne de recharge", MOTORBIKE: "Adaptée aux motos",
    WATER_SUPPLY: "Raccordement à l'eau", POWER_SUPPLY: "Raccordement électrique", SEWER: "Tout-à-l'égout", PAVED_ACCESS: "Accès goudronné", FENCED: "Clôturé",
    WATER: "Prise d'eau", ELECTRICITY: "Prise électrique", WIFI: "Wi-Fi", SHOWERS: "Douches et sanitaires", PARKING_CAR: "Parking voiture", FUEL: "Station-service", TRAVEL_LIFT: "Grue ou travel-lift",
    BOATYARD: "Chantier naval", RESTAURANTS: "Restaurants et services", SHELTERED: "Zone abritée", SEAFRONT: "Accès direct à la mer",
  },
  conditions: { NEW: "Neuf", GOOD: "Bon état", TO_REFORM: "À rénover" },
  energy: { ...ENERGY_RATINGS, IN_PROGRESS: "En cours", EXEMPT: "Exempté" },
  rentalTypes: { HABITUAL: "Résidence principale (longue durée)", SEASONAL: "Saisonnière" },
  mooringTypes: { PONTOON: "Ponton", FINGER: "Ponton avec catway", DOCK: "Quai", BUOY: "Bouée ou mouillage", DRY_STACK: "Port à sec (à terre)", OTHER: "Autre" },
  rentPeriods: { DAY: "jour", WEEK: "semaine", MONTH: "mois", SEASON: "saison", YEAR: "an" },
  landClasses: { URBAN: "Terrain urbain", DEVELOPABLE: "Terrain à urbaniser", RUSTIC: "Terrain rural (non constructible)" },
  landUses: { RESIDENTIAL: "Résidentiel", COMMERCIAL: "Tertiaire ou commercial", INDUSTRIAL: "Industriel", AGRICULTURAL: "Agricole", MIXED: "Mixte", OTHER: "Autre" },
};

const LABELS: Record<SiteLang, CatalogLabels> = { es, ca, en, de, fr };

/** Negocios en traspaso: actividades y características (en español, las del catálogo). */
const BUSINESS: Record<SiteLang, { types: Record<string, string>; features: Record<string, string> }> = {
  es: { types: { ...BUSINESS_TYPES }, features: { ...BUSINESS_FEATURES } },
  ca: {
    types: { NEG_BAR_RESTAURANTE: "Bar o restaurant", NEG_CAFETERIA: "Cafeteria", NEG_COMERCIO: "Comerç", NEG_ESTETICA: "Perruqueria o centre d'estètica", NEG_HOSTELERIA: "Hostaleria i allotjament", NEG_OFICINA: "Oficina i serveis", NEG_OTRO: "Altres negocis" },
    features: { ACTIVITY_LICENSE: "Llicència d'activitat vigent", TERRACE_LICENSE: "Llicència de terrassa", SMOKE_OUTLET: "Sortida de fums", EQUIPMENT_INCLUDED: "Mobiliari i maquinària inclosos", FITTED_OUT: "Local condicionat, a punt per obrir", STREET_LEVEL: "A peu de carrer", SHOP_WINDOW: "Aparador", STOREROOM: "Magatzem", AC: "Aire condicionat", ACCESSIBLE: "Accessible", STAFF: "Possibilitat de mantenir el personal", CLIENTELE: "Clientela consolidada" },
  },
  en: {
    types: { NEG_BAR_RESTAURANTE: "Bar or restaurant", NEG_CAFETERIA: "Café", NEG_COMERCIO: "Shop", NEG_ESTETICA: "Hair or beauty salon", NEG_HOSTELERIA: "Hospitality and accommodation", NEG_OFICINA: "Office and services", NEG_OTRO: "Other business" },
    features: { ACTIVITY_LICENSE: "Valid business licence", TERRACE_LICENSE: "Terrace licence", SMOKE_OUTLET: "Smoke extraction", EQUIPMENT_INCLUDED: "Furniture and equipment included", FITTED_OUT: "Fitted out, ready to open", STREET_LEVEL: "Street level", SHOP_WINDOW: "Shop window", STOREROOM: "Storeroom", AC: "Air conditioning", ACCESSIBLE: "Accessible", STAFF: "Staff can be kept on", CLIENTELE: "Established clientele" },
  },
  de: {
    types: { NEG_BAR_RESTAURANTE: "Bar oder Restaurant", NEG_CAFETERIA: "Café", NEG_COMERCIO: "Ladengeschäft", NEG_ESTETICA: "Friseur oder Kosmetikstudio", NEG_HOSTELERIA: "Gastgewerbe und Unterkunft", NEG_OFICINA: "Büro und Dienstleistungen", NEG_OTRO: "Sonstiges Geschäft" },
    features: { ACTIVITY_LICENSE: "Gültige Betriebserlaubnis", TERRACE_LICENSE: "Terrassengenehmigung", SMOKE_OUTLET: "Abluftanlage", EQUIPMENT_INCLUDED: "Mobiliar und Geräte inklusive", FITTED_OUT: "Eingerichtet, sofort betriebsbereit", STREET_LEVEL: "Ebenerdig", SHOP_WINDOW: "Schaufenster", STOREROOM: "Lager", AC: "Klimaanlage", ACCESSIBLE: "Barrierefrei", STAFF: "Personalübernahme möglich", CLIENTELE: "Fester Kundenstamm" },
  },
  fr: {
    types: { NEG_BAR_RESTAURANTE: "Bar ou restaurant", NEG_CAFETERIA: "Café", NEG_COMERCIO: "Commerce", NEG_ESTETICA: "Salon de coiffure ou d'esthétique", NEG_HOSTELERIA: "Hôtellerie et hébergement", NEG_OFICINA: "Bureau et services", NEG_OTRO: "Autre commerce" },
    features: { ACTIVITY_LICENSE: "Licence d'activité en vigueur", TERRACE_LICENSE: "Licence de terrasse", SMOKE_OUTLET: "Extraction de fumées", EQUIPMENT_INCLUDED: "Mobilier et équipement inclus", FITTED_OUT: "Local aménagé, prêt à ouvrir", STREET_LEVEL: "Rez-de-chaussée sur rue", SHOP_WINDOW: "Vitrine", STOREROOM: "Réserve", AC: "Climatisation", ACCESSIBLE: "Accessible", STAFF: "Possibilité de garder le personnel", CLIENTELE: "Clientèle fidèle" },
  },
};

export function catalogLabels(lang: SiteLang): CatalogLabels {
  const base = LABELS[lang] ?? es;
  const b = BUSINESS[lang] ?? BUSINESS.es;
  return { ...base, types: { ...base.types, ...b.types }, features: { ...base.features, ...b.features } };
}
