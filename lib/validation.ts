import { z } from "zod";
import {
  AGENCY_STATUSES,
  CONDITIONS,
  CONTACT_CHANNELS,
  LANGUAGES,
  LEAD_SOURCES,
  LOCATIONS,
  PROPERTY_TYPES,
  SITUATIONS,
  TIMELINES,
  PARTNER_TYPES,
} from "@/types";

const optionalInt = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).max(max).optional(),
  );

/** Formulario público de valoración (paso 1-6). */
export const valuationSchema = z.object({
  location: z.enum(LOCATIONS),
  locationOther: z.string().trim().max(80).optional(),
  type: z.enum(PROPERTY_TYPES),
  timeline: z.enum(TIMELINES),
  situation: z.enum(SITUATIONS),
  sqm: optionalInt(100_000),
  bedrooms: optionalInt(30),
  bathrooms: optionalInt(30),
  terrace: z.boolean().default(false),
  pool: z.boolean().default(false),
  parking: z.boolean().default(false),
  condition: z.enum(CONDITIONS).optional(),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+()\d\s.-]*$/, "Teléfono no válido")
    .optional()
    .or(z.literal("")),
  language: z.enum(LANGUAGES),
  preferredContact: z.enum(CONTACT_CHANNELS).optional(),
  // El consentimiento de contacto es obligatorio para crear un lead comercial.
  consentContact: z.literal(true, { errorMap: () => ({ message: "consent_contact es obligatorio" }) }),
  consentMarketing: z.boolean().default(false),
  source: z.enum(LEAD_SOURCES).optional(),
  sessionId: z.string().max(64).optional(),
});

export type ValuationFormInput = z.infer<typeof valuationSchema>;

export const agencySchema = z.object({
  name: z.string().trim().min(2).max(100),
  zones: z.array(z.string()).default([]),
  email: z.string().trim().email(),
  phone: z.string().trim().min(6).max(30),
  languages: z.array(z.enum(LANGUAGES)).min(1),
  propertyTypes: z.array(z.enum(PROPERTY_TYPES)).min(1),
  status: z.enum(AGENCY_STATUSES),
  monthlyFee: z.coerce.number().int().min(0).max(100_000),
  pricePerAppointment: z.coerce.number().int().min(0).max(10_000),
  // Colaborador de ámbito nacional
  partnerType: z.enum(PARTNER_TYPES),
  services: z.array(z.enum(["SELL", "RENT", "ADVICE"])).min(1, "Elige al menos un servicio"),
  provinces: z.array(z.string().regex(/^\d{2}$/)).default([]),
  municipalities: z.string().trim().max(1000).default(""),
  contactName: z.string().trim().max(100).optional().or(z.literal("")),
  agreementTerms: z.string().trim().max(3000).optional().or(z.literal("")),
  notes: z.string().trim().max(3000).optional().or(z.literal("")),
});

export type AgencyInput = z.infer<typeof agencySchema>;

export const agentMessageSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  value: z.string().max(60).optional(),
});

export const bookingSchema = z.object({
  slot: z.string().datetime({ offset: true }).or(z.string().datetime()),
  source: z.enum(["WEB_FORM", "AGENT", "ADMIN", "SIMULATION"]).optional(),
});
