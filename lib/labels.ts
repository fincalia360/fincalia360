// Etiquetas en español para el CRM interno (/admin).
import type {
  AppointmentStatus,
  Condition,
  ContactChannel,
  Intent,
  Language,
  LeadStatus,
  Location,
  Motivation,
  PropertyType,
  ScoreTier,
  Situation,
  Timeline,
} from "@/types";

export const LANGUAGE_NAMES: Record<Language, string> = {
  es: "Español",
  ca: "Català",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  nl: "Nederlands",
  it: "Italiano",
  pt: "Português",
};

export const LOCATION_LABELS: Record<Location, string> = {
  ROSES: "Roses",
  EMPURIABRAVA: "Empuriabrava",
  CADAQUES: "Cadaqués",
  LLANCA: "Llançà",
  CASTELLO: "Castelló d'Empúries",
  FIGUERES: "Figueres",
  OTHER: "Otra",
};

export const PROPERTY_LABELS: Record<PropertyType, string> = {
  APARTMENT: "Apartamento",
  HOUSE: "Casa",
  VILLA: "Villa",
  LAND: "Terreno",
  COMMERCIAL: "Local",
  OTHER: "Otro",
};

export const TIMELINE_LABELS: Record<Timeline, string> = {
  NOW: "Ahora",
  M1_3: "1-3 meses",
  M3_6: "3-6 meses",
  M6_12: "6-12 meses",
  LATER: "Más adelante",
  INFO_ONLY: "Solo informarse",
};

export const SITUATION_LABELS: Record<Situation, string> = {
  PRIMARY: "Vivienda habitual",
  SECOND_HOME: "Segunda residencia",
  TOURIST: "Vivienda turística",
  RENTED: "Alquilada",
  INHERITED: "Heredada",
  EMPTY: "Vacía",
};

export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: "Nueva / reformada",
  GOOD: "Buen estado",
  TO_REFORM: "A reformar",
};

export const MOTIVATION_LABELS: Record<Motivation, string> = {
  RELOCATION: "Cambio de residencia",
  INHERITANCE: "Herencia",
  LIQUIDITY: "Liquidez / inversión",
  UNUSED: "Ya no la usa / gastos",
  LIFE_CHANGE: "Cambio vital (jubilación, separación…)",
  UPGRADE: "Cambiar a otra vivienda",
  OTHER: "Otra",
};

export const CONTACT_LABELS: Record<ContactChannel, string> = {
  PHONE: "Teléfono",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  QUALIFIED: "Cualificado",
  APPOINTMENT: "Cita",
  CONVERTED: "Convertido",
  LOST: "Perdido",
};

export const TIER_LABELS: Record<ScoreTier, string> = {
  LOW: "Bajo",
  MEDIUM: "Medio",
  HIGH: "Alto",
  HOT: "Caliente",
};

export const INTENT_LABELS: Record<Intent, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  REQUESTED: "Sugerida",
  BOOKED: "Reservada",
  COMPLETED: "Realizada",
  CANCELLED: "Cancelada",
};

export const SOURCE_LABELS: Record<string, string> = {
  WEB_FORM: "Web (formulario)",
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  SEO: "SEO",
  PARTNERS: "Partners",
  DEMO: "Simulación",
  STUDY: "Estudio vender/alquilar",
};

export const EVENT_LABELS: Record<string, string> = {
  LEAD_CREATED: "Lead creado",
  LEAD_QUALIFIED: "Lead cualificado",
  APPOINTMENT_BOOKED: "Cita reservada",
  LEAD_ASSIGNED: "Asignado a inmobiliaria",
  LEAD_CONVERTED: "Lead convertido",
  LEAD_LOST: "Lead descartado",
  STATUS_CHANGED: "Cambio de estado",
  CONTACT_REQUESTED: "Pide que le contacten",
  NOTE_ADDED: "Nota añadida",
  landing_view: "Visita a la landing",
  valuation_started: "Valoración iniciada",
  valuation_completed: "Valoración completada",
  lead_created: "Lead creado",
  agent_started: "Conversación con agente iniciada",
  lead_qualified: "Lead cualificado",
  appointment_started: "Abre selector de cita",
  appointment_booked: "Cita reservada",
};

export function label<T extends string>(map: Record<T, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return (map as Record<string, string>)[key] ?? key;
}
