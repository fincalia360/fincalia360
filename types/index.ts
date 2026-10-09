// Tipos de dominio compartidos. Los valores se guardan como String en SQLite.

export const LANGUAGES = ["es", "ca", "en", "fr", "de", "nl", "it", "pt"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LOCATIONS = ["ROSES", "EMPURIABRAVA", "CADAQUES", "LLANCA", "CASTELLO", "FIGUERES", "OTHER"] as const;
export type Location = (typeof LOCATIONS)[number];

export const PROPERTY_TYPES = ["APARTMENT", "HOUSE", "VILLA", "LAND", "COMMERCIAL", "OTHER"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const TIMELINES = ["NOW", "M1_3", "M3_6", "M6_12", "LATER", "INFO_ONLY"] as const;
export type Timeline = (typeof TIMELINES)[number];

export const SITUATIONS = ["PRIMARY", "SECOND_HOME", "TOURIST", "RENTED", "INHERITED", "EMPTY"] as const;
export type Situation = (typeof SITUATIONS)[number];

export const CONDITIONS = ["NEW", "GOOD", "TO_REFORM"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONTACT_CHANNELS = ["PHONE", "WHATSAPP", "EMAIL"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const MOTIVATIONS = ["RELOCATION", "INHERITANCE", "LIQUIDITY", "UNUSED", "LIFE_CHANGE", "UPGRADE", "OTHER"] as const;
export type Motivation = (typeof MOTIVATIONS)[number];

// Estados comerciales iniciales (códigos fijos; etiqueta, orden y estados extra se configuran en PipelineStage).
export const LEAD_STATUSES = ["NEW", "STUDY_DONE", "PENDING_CONTACT", "CONTACTED", "APPOINTMENT", "PROPOSAL_SENT", "CONVERTED", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const SCORE_TIERS = ["LOW", "MEDIUM", "HIGH", "HOT"] as const;
export type ScoreTier = (typeof SCORE_TIERS)[number];

export type Intent = "HIGH" | "MEDIUM" | "LOW";
export type Urgency = "HIGH" | "NORMAL" | "LOW";

export const LEAD_SOURCES = ["WEB_FORM", "GOOGLE_ADS", "META_ADS", "SEO", "PARTNERS", "DEMO", "STUDY"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const APPOINTMENT_STATUSES = ["REQUESTED", "BOOKED", "COMPLETED", "CANCELLED"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const AGENCY_STATUSES = ["PROSPECT", "ACTIVE", "PAUSED", "ENDED"] as const;
export const PARTNER_TYPES = ["INMOBILIARIA", "ABOGADO", "GESTOR", "TASADOR", "OTRO"] as const;
export type AgencyStatus = (typeof AGENCY_STATUSES)[number];

export const BUSINESS_EVENTS = [
  "LEAD_CREATED",
  "LEAD_QUALIFIED",
  "APPOINTMENT_BOOKED",
  "LEAD_ASSIGNED",
  "LEAD_CONVERTED",
  "LEAD_LOST",
  "STATUS_CHANGED",
  "CONTACT_REQUESTED",
  "NOTE_ADDED",
  // CRM comercial
  "REQUEST_RECEIVED",
  "STAGE_ENTERED",
  "CONTACT_LOGGED",
  "NEXT_ACTION_SET",
  "EMAIL_SENT",
  "EMAIL_FAILED",
  "EMAIL_NOT_CONFIGURED",
  "PARTNER_ASSIGNED",
  "PARTNER_UPDATED",
  "REVENUE_RECORDED",
  "DATA_EXPORTED",
  "DATA_ERASED",
  "CONTACT_DETAILS_UPDATED",
] as const;
export type BusinessEventType = (typeof BUSINESS_EVENTS)[number];

export const ANALYTICS_EVENTS = [
  "landing_view",
  "valuation_started",
  "valuation_completed",
  "lead_created",
  "agent_started",
  "lead_qualified",
  "appointment_started",
  "appointment_booked",
  // Embudo del estudio
  "study_started",
  "study_completed",
  "report_generated",
  "final_screen_view",
  "request_form_started",
  "chat_message",
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENTS)[number];

export interface ScoreItem {
  category: "intent" | "value" | "property" | "situation" | "contact" | "engagement";
  label: string;
  points: number;
}

export interface ScoreResult {
  score: number;
  tier: ScoreTier;
  breakdown: ScoreItem[];
}

export interface ValuationResult {
  min: number;
  max: number;
  mid: number;
  pricePerSqm: number;
  assumptions: string[];
}

/** Datos estructurados que el agente extrae de la conversación. */
export interface ExtractedData {
  language?: Language;
  confirmedInterest?: boolean;
  intent?: Intent;
  timeline?: Timeline;
  motivation?: Motivation;
  motivationText?: string;
  urgency?: Urgency;
  propertyType?: PropertyType;
  location?: Location;
  situation?: Situation;
  sqm?: number;
  bedrooms?: number;
  features?: string[];
  estimatedValue?: number;
  ownerPriceExpectation?: number;
  preferredContact?: ContactChannel;
  agencyInterest?: boolean | null;
  appointmentInterest?: boolean;
}

export interface Slot {
  iso: string;
  dayKey: "today" | "tomorrow" | "later";
  label: string; // HH:mm
}
