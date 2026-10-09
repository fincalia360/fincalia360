// Simuladores para presentaciones: "Crear lead demo" y "Simular lead caliente".
// Todos los datos son ficticios (emails @example.com, teléfonos de prueba).
import { getDictionary } from "@/lib/i18n";
import { pick } from "@/lib/utils";
import type { ValuationFormInput } from "@/lib/validation";
import type { Language, LeadSource } from "@/types";
import { runGuidedConversation } from "./agentService";
import { trackEvent } from "./analyticsService";
import { bookAppointment, getAvailableSlots } from "./appointmentService";
import { createLead } from "./leadService";

export const DEMO_NAMES: Record<Language, string[]> = {
  es: ["Lucía Navarro", "Javier Ortega", "Elena Ruiz", "Miguel Serrano", "Paula Castro"],
  ca: ["Marta Soler", "Oriol Casals", "Núria Pujol", "Arnau Roca", "Laia Vila"],
  en: ["Emma Clarke", "Oliver Bennett", "Charlotte Hughes", "George Mitchell"],
  fr: ["Camille Lefèvre", "Antoine Moreau", "Julie Bernard", "Nicolas Petit"],
  de: ["Sabine Wagner", "Thomas Schneider", "Katrin Hoffmann", "Michael Weber"],
  nl: ["Sanne Bakker", "Joost Visser", "Femke Smit", "Daan Mulder"],
  it: ["Giulia Ferrari", "Luca Bianchi", "Chiara Romano"],
  pt: ["Inês Carvalho", "Tiago Almeida", "Beatriz Sousa"],
};

function emailFor(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, ".");
  return `${slug}.${Math.floor(Math.random() * 900 + 100)}@example.com`;
}

function demoPhone() {
  return `+34 600 ${String(Math.floor(Math.random() * 900 + 100))} ${String(Math.floor(Math.random() * 900 + 100))}`;
}

async function trackVisit(createdAt?: Date) {
  await trackEvent("landing_view", { payload: { simulated: true }, createdAt });
  await trackEvent("valuation_started", { payload: { simulated: true }, createdAt });
}

export async function createDemoLead() {
  const language = pick(["es", "ca", "en", "fr", "de", "nl", "it", "pt"] as const);
  const name = pick(DEMO_NAMES[language]);
  const type = pick(["APARTMENT", "APARTMENT", "HOUSE", "VILLA", "LAND"] as const);
  const input: ValuationFormInput = {
    location: pick(["ROSES", "EMPURIABRAVA", "CADAQUES", "LLANCA", "CASTELLO", "FIGUERES"] as const),
    type,
    timeline: pick(["NOW", "M1_3", "M3_6", "M6_12", "LATER", "INFO_ONLY"] as const),
    situation: pick(["PRIMARY", "SECOND_HOME", "SECOND_HOME", "TOURIST", "RENTED", "INHERITED", "EMPTY"] as const),
    sqm: type === "LAND" ? pick([450, 600, 800]) : type === "VILLA" ? pick([180, 220, 260]) : pick([55, 70, 85, 110, 140]),
    bedrooms: type === "LAND" ? undefined : pick([1, 2, 3, 4]),
    bathrooms: type === "LAND" ? undefined : pick([1, 2, 3]),
    terrace: Math.random() > 0.4,
    pool: type === "VILLA" || Math.random() > 0.8,
    parking: Math.random() > 0.5,
    condition: pick(["NEW", "GOOD", "GOOD", "TO_REFORM"] as const),
    name,
    email: emailFor(name),
    phone: Math.random() > 0.25 ? demoPhone() : "",
    language,
    preferredContact: pick(["PHONE", "WHATSAPP", "EMAIL"] as const),
    consentContact: true,
    consentMarketing: Math.random() > 0.5,
  };
  await trackVisit();
  const source = pick(["GOOGLE_ADS", "META_ADS", "SEO", "PARTNERS", "WEB_FORM"] as const) as LeadSource;
  return createLead(input, { source, isDemo: true });
}

/**
 * Lead caliente: intención alta, plazo corto, villa con piscina, conversación
 * con el agente completada y cita sugerida en el primer hueco disponible.
 */
export async function simulateHotLead() {
  const language = pick(["de", "nl", "fr", "en"] as const);
  const name = pick(DEMO_NAMES[language]);
  const input: ValuationFormInput = {
    location: pick(["CADAQUES", "ROSES"] as const),
    type: "VILLA",
    timeline: "NOW",
    situation: pick(["TOURIST", "INHERITED"] as const),
    sqm: pick([220, 240, 280]),
    bedrooms: 4,
    bathrooms: 3,
    terrace: true,
    pool: true,
    parking: true,
    condition: "GOOD",
    name,
    email: emailFor(name),
    phone: demoPhone(),
    language,
    preferredContact: "WHATSAPP",
    consentContact: true,
    consentMarketing: true,
  };
  await trackVisit();
  const lead = await createLead(input, { source: pick(["GOOGLE_ADS", "META_ADS"] as const), isDemo: true });

  const dict = getDictionary(language);
  // Se detiene en OFFER_APPOINTMENT: la cita queda "sugerida" para que el equipo la confirme.
  await runGuidedConversation(lead.id, {
    CONFIRM_INTEREST: { text: dict.agent.quick.yes, value: "YESNO:YES" },
    MOTIVATION: { text: dict.options.motivation.RELOCATION, value: "MOTIVATION:RELOCATION" },
    TIMELINE: { text: dict.agent.quick.yes, value: "TIMELINE:KEEP" },
    FEATURES: { text: dict.agent.quick.seaView, value: "FEATURE:SEA_VIEW" },
    AGENCY_INTEREST: { text: dict.agent.quick.yes, value: "AGENCY:YES" },
  });

  const [slot] = await getAvailableSlots();
  const date = slot ? new Date(slot.iso) : new Date(Date.now() + 2 * 3600 * 1000);
  await bookAppointment(lead.id, date, { source: "SIMULATION", status: "REQUESTED", notes: "Cita sugerida automáticamente (simulación)" });
  return lead;
}
