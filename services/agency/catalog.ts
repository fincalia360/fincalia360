// Catálogos del CRM de las inmobiliarias (sin dependencias de servidor: se usan también en el navegador).

export const AGENCY_STAGES = {
  NEW: { label: "Nuevo contacto", kind: "OPEN" },
  PENDING_CONTACT: { label: "Pendiente de contactar", kind: "OPEN" },
  CONTACTED: { label: "Contactado", kind: "OPEN" },
  VISIT_SCHEDULED: { label: "Visita concertada", kind: "OPEN" },
  PROPOSAL_SENT: { label: "Propuesta enviada", kind: "OPEN" },
  NEGOTIATION: { label: "Negociación", kind: "OPEN" },
  WON: { label: "Operación cerrada", kind: "WON" },
  LOST: { label: "Perdido", kind: "LOST" },
} as const;
export type AgencyStage = keyof typeof AGENCY_STAGES;
export const STAGE_CODES = Object.keys(AGENCY_STAGES) as [AgencyStage, ...AgencyStage[]];
/** Operaciones en curso: ya hay conversación y aún no está cerrada. */
export const IN_PROGRESS: AgencyStage[] = ["CONTACTED", "VISIT_SCHEDULED", "PROPOSAL_SENT", "NEGOTIATION"];

export const CONTACT_KINDS = {
  OWNER_SELL: "Propietario (vender)",
  OWNER_RENT: "Propietario (alquilar)",
  BUYER: "Comprador",
  TENANT: "Inquilino",
  OTHER: "Otro",
} as const;
export const CONTACT_SOURCES = { MANUAL: "Alta manual", PORTAL: "Portal FINCALIA360", FINCALIA360: "Enviado por FINCALIA360" } as const;
export const ACTIVITY_TYPES = { NOTE: "Nota", CALL: "Llamada", EMAIL: "Email", WHATSAPP: "WhatsApp", MEETING: "Reunión", STATUS: "Cambio de estado", SYSTEM: "Sistema" } as const;
export const VISIT_STATUSES = { SCHEDULED: "Programada", DONE: "Realizada", CANCELLED: "Cancelada" } as const;
