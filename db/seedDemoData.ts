// Datos DEMO ficticios. Se usan desde prisma/seed.ts y desde "Restablecer datos demo".
// Los leads se crean a través de los servicios reales (scoring, agente, citas,
// asignación, eventos) para que todo el sistema sea coherente.
import { getDictionary } from "@/lib/i18n";
import type { ValuationFormInput } from "@/lib/validation";
import { bookFromAgent, runScriptedConversation } from "@/services/agentService";
import { trackEvent } from "@/services/analyticsService";
import { bookAppointment } from "@/services/appointmentService";
import { createLead, updateLeadStatus, addNote } from "@/services/leadService";
import { DEFAULT_SETTINGS, saveSettings } from "@/services/settingsService";
import type { Language, LeadSource, LeadStatus } from "@/types";
import { prisma } from "./client";

type Turn = { text: string; value?: string };

interface SeedLead {
  key: string;
  daysAgo: number;
  hour: number;
  source: LeadSource;
  input: Omit<ValuationFormInput, "consentContact" | "consentMarketing" | "email"> & { consentMarketing?: boolean };
  script?: (lang: Language) => Turn[];
  book?: { daysFromNow: number; time: string; status?: "BOOKED" | "REQUESTED" | "COMPLETED" };
  finalStatus?: LeadStatus;
  lostReason?: string;
  note?: string;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function at(daysAgo: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  // Nunca en el futuro (para leads de "hoy").
  const now = new Date();
  if (d > now) return new Date(now.getTime() - 45 * 60 * 1000);
  return d;
}

/** Hora de cita futura; si ya pasó hoy, se mueve al día siguiente. */
function slotAt(daysFromNow: number, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(h, m, 0, 0);
  if (daysFromNow >= 0 && d.getTime() < Date.now() + 30 * 60 * 1000) d.setDate(d.getDate() + 1);
  return d;
}

const q = (lang: Language) => getDictionary(lang).agent.quick;

const LEADS: SeedLead[] = [
  {
    key: "urgente",
    daysAgo: 2,
    hour: 11,
    source: "GOOGLE_ADS",
    input: { location: "ROSES", type: "APARTMENT", timeline: "NOW", situation: "PRIMARY", sqm: 85, bedrooms: 2, bathrooms: 1, terrace: true, pool: false, parking: true, condition: "GOOD", name: "Jordi Puig", phone: "+34 600 111 201", language: "ca", preferredContact: "PHONE" },
    script: (l) => [
      { text: "Sí, és clar" },
      { text: "Ens traslladem a Barcelona per feina" },
      { text: "Sí, com més aviat millor" },
      { text: q(l).renovated, value: "FEATURE:RENOVATED" },
      { text: q(l).yes, value: "AGENCY:YES" },
      { text: q(l).book, value: "BOOK:YES" },
    ],
    book: { daysFromNow: 1, time: "10:00" },
    note: "Vendedor urgente por traslado laboral. Prefiere llamadas por la mañana.",
  },
  {
    key: "aleman",
    daysAgo: 5,
    hour: 19,
    source: "META_ADS",
    input: { location: "EMPURIABRAVA", type: "HOUSE", timeline: "M1_3", situation: "SECOND_HOME", sqm: 160, bedrooms: 3, bathrooms: 2, terrace: true, pool: true, parking: true, condition: "GOOD", name: "Klaus Becker", phone: "+49 151 0000 1202", language: "de", preferredContact: "WHATSAPP", consentMarketing: true },
    script: (l) => [
      { text: "Ja, gerne." },
      { text: "Wir nutzen das Haus kaum noch und die Kosten sind hoch." },
      { text: "Ja, das passt noch." },
      { text: "Es hat einen Bootsliegeplatz am Kanal" },
      { text: q(l).yes, value: "AGENCY:YES" },
      { text: "Ja, gerne" },
    ],
    book: { daysFromNow: 1, time: "17:30" },
    note: "Propietario alemán no residente. Casa con amarre en canal. Hablar en alemán.",
  },
  {
    key: "frances",
    daysAgo: 3,
    hour: 9,
    source: "SEO",
    input: { location: "ROSES", type: "APARTMENT", timeline: "M3_6", situation: "SECOND_HOME", sqm: 70, bedrooms: 2, bathrooms: 1, terrace: true, pool: false, parking: false, condition: "GOOD", name: "Sophie Martin", phone: "+33 6 00 00 12 03", language: "fr", preferredContact: "EMAIL" },
    script: (l) => [
      { text: "Oui, volontiers" },
      { text: "Nous voulons acheter plus grand près de Lyon" },
      { text: "Oui" },
      { text: q(l).seaView, value: "FEATURE:SEA_VIEW" },
      { text: q(l).maybe, value: "AGENCY:MAYBE" },
    ],
  },
  {
    key: "segunda",
    daysAgo: 6,
    hour: 21,
    source: "WEB_FORM",
    input: { location: "LLANCA", type: "APARTMENT", timeline: "M6_12", situation: "SECOND_HOME", sqm: 65, bedrooms: 2, bathrooms: 1, terrace: true, pool: false, parking: false, condition: "GOOD", name: "Carmen López", phone: "+34 600 111 204", language: "es", preferredContact: "WHATSAPP" },
    script: () => [{ text: "Sí" }, { text: "Ya no venimos casi nunca y los gastos se acumulan" }],
  },
  {
    key: "turistica",
    daysAgo: 8,
    hour: 13,
    source: "META_ADS",
    input: { location: "EMPURIABRAVA", type: "APARTMENT", timeline: "M1_3", situation: "TOURIST", sqm: 80, bedrooms: 2, bathrooms: 2, terrace: true, pool: true, parking: true, condition: "NEW", name: "Pieter de Vries", phone: "+31 6 0000 1205", language: "nl", preferredContact: "WHATSAPP", consentMarketing: true },
    script: (l) => [
      { text: "Ja" },
      { text: "We willen investeren in iets anders" },
      { text: "Ja" },
      { text: q(l).seaView, value: "FEATURE:SEA_VIEW" },
      { text: q(l).yes, value: "AGENCY:YES" },
      { text: q(l).book, value: "BOOK:YES" },
    ],
    book: { daysFromNow: 2, time: "12:00" },
  },
  {
    key: "heredero",
    daysAgo: 18,
    hour: 10,
    source: "PARTNERS",
    input: { location: "FIGUERES", type: "HOUSE", timeline: "M1_3", situation: "INHERITED", sqm: 180, bedrooms: 4, bathrooms: 2, terrace: true, pool: false, parking: true, condition: "TO_REFORM", name: "Montse Ferrer", phone: "+34 600 111 206", language: "ca", preferredContact: "PHONE" },
    script: (l) => [
      { text: "Sí" },
      { text: "Sí, encara és així" },
      { text: q(l).toReform, value: "FEATURE:TO_REFORM" },
      { text: q(l).yes, value: "AGENCY:YES" },
      { text: q(l).book, value: "BOOK:YES" },
    ],
    book: { daysFromNow: -14, time: "10:00", status: "COMPLETED" },
    finalStatus: "CONVERTED",
    note: "Herencia de tres hermanos. Firmado encargo de venta con la inmobiliaria.",
  },
  {
    key: "investigando",
    daysAgo: 1,
    hour: 16,
    source: "SEO",
    input: { location: "CASTELLO", type: "APARTMENT", timeline: "INFO_ONLY", situation: "PRIMARY", sqm: 60, bedrooms: 2, bathrooms: 1, terrace: false, pool: false, parking: false, condition: "GOOD", name: "Laura Gómez", phone: "", language: "es", preferredContact: "EMAIL" },
  },
  {
    key: "doce-meses",
    daysAgo: 10,
    hour: 18,
    source: "GOOGLE_ADS",
    input: { location: "CADAQUES", type: "HOUSE", timeline: "M6_12", situation: "SECOND_HOME", sqm: 120, bedrooms: 3, bathrooms: 2, terrace: true, pool: false, parking: false, condition: "GOOD", name: "James Wilson", phone: "+44 7700 900123", language: "en", preferredContact: "EMAIL" },
    script: (l) => [
      { text: "Yes, please" },
      { text: "We're moving back to the UK" },
      { text: "Yes, still this year" },
      { text: q(l).seaView, value: "FEATURE:SEA_VIEW" },
      { text: q(l).yes, value: "AGENCY:YES" },
      { text: q(l).notNow, value: "BOOK:NO" },
      { text: "Email" },
    ],
  },
  {
    key: "villa",
    daysAgo: 4,
    hour: 12,
    source: "GOOGLE_ADS",
    input: { location: "ROSES", type: "VILLA", timeline: "NOW", situation: "SECOND_HOME", sqm: 280, bedrooms: 5, bathrooms: 4, terrace: true, pool: true, parking: true, condition: "NEW", name: "Hans Müller", phone: "+49 160 0000 1209", language: "de", preferredContact: "PHONE", consentMarketing: true },
    script: (l) => [
      { text: "Ja" },
      { text: "Wir möchten schnell verkaufen, wir brauchen Liquidität" },
      { text: "Ja" },
      { text: q(l).seaView, value: "FEATURE:SEA_VIEW" },
      { text: q(l).yes, value: "AGENCY:YES" },
      { text: q(l).book, value: "BOOK:YES" },
    ],
    book: { daysFromNow: 0, time: "19:00" },
  },
  {
    key: "apartamento",
    daysAgo: 12,
    hour: 20,
    source: "META_ADS",
    input: { location: "ROSES", type: "APARTMENT", timeline: "M3_6", situation: "RENTED", sqm: 55, bedrooms: 1, bathrooms: 1, terrace: true, pool: false, parking: false, condition: "GOOD", name: "Marco Rossi", phone: "+39 333 000 1210", language: "it", preferredContact: "WHATSAPP" },
    script: () => [{ text: "Sì, certo" }],
  },
  {
    key: "caliente",
    daysAgo: 0,
    hour: 9,
    source: "GOOGLE_ADS",
    input: { location: "CADAQUES", type: "VILLA", timeline: "NOW", situation: "TOURIST", sqm: 230, bedrooms: 4, bathrooms: 3, terrace: true, pool: true, parking: true, condition: "GOOD", name: "Isabelle Dubois", phone: "+33 6 00 00 12 11", language: "fr", preferredContact: "PHONE", consentMarketing: true },
  },
  {
    key: "frio",
    daysAgo: 15,
    hour: 22,
    source: "SEO",
    input: { location: "FIGUERES", type: "APARTMENT", timeline: "LATER", situation: "PRIMARY", sqm: 50, bedrooms: 1, bathrooms: 1, terrace: false, pool: false, parking: false, condition: "TO_REFORM", name: "Ana Ribeiro", phone: "", language: "pt", preferredContact: "EMAIL" },
    finalStatus: "LOST",
    lostReason: "Solo curiosidad; sin intención de vender en los próximos 12 meses",
  },
  {
    key: "vacia",
    daysAgo: 7,
    hour: 17,
    source: "PARTNERS",
    input: { location: "LLANCA", type: "HOUSE", timeline: "M3_6", situation: "EMPTY", sqm: 140, bedrooms: 3, bathrooms: 2, terrace: true, pool: false, parking: true, condition: "GOOD", name: "Ruth Janssen", phone: "+31 6 0000 1213", language: "nl", preferredContact: "EMAIL" },
    script: () => [{ text: "Ja" }, { text: "Verhuizing terug naar Nederland" }],
  },
  {
    key: "heredero-canal",
    daysAgo: 0,
    hour: 8,
    source: "WEB_FORM",
    input: { location: "EMPURIABRAVA", type: "HOUSE", timeline: "M1_3", situation: "INHERITED", sqm: 150, bedrooms: 3, bathrooms: 2, terrace: true, pool: true, parking: true, condition: "GOOD", name: "Pere Vidal", phone: "+34 600 111 214", language: "ca", preferredContact: "PHONE" },
    script: (l) => [
      { text: "Sí" },
      { text: "Sí" },
      { text: q(l).mooring, value: "FEATURE:MOORING" },
      { text: q(l).yes, value: "AGENCY:YES" },
    ],
    book: { daysFromNow: 1, time: "11:00", status: "REQUESTED" },
  },
];

const AGENCIES = [
  {
    name: "Mar i Vent Immobiliària",
    zones: "ROSES,CADAQUES,LLANCA",
    email: "oportunidades@marivent.example.com",
    phone: "+34 972 000 101",
    languages: "es,ca,en,fr",
    propertyTypes: "APARTMENT,HOUSE,VILLA",
    status: "ACTIVE",
    monthlyFee: 300,
    pricePerAppointment: 150,
  },
  {
    name: "Canal Blau Properties",
    zones: "EMPURIABRAVA,CASTELLO,ROSES",
    email: "leads@canalblau.example.com",
    phone: "+34 972 000 202",
    languages: "es,de,nl,en",
    propertyTypes: "APARTMENT,HOUSE,VILLA",
    status: "ACTIVE",
    monthlyFee: 250,
    pricePerAppointment: 140,
  },
  {
    name: "Terres de l'Empordà Finques",
    zones: "FIGUERES,CASTELLO,LLANCA,OTHER,COSTA_BRAVA",
    email: "info@terresemporda.example.com",
    phone: "+34 972 000 303",
    languages: "es,ca,fr,it,pt",
    propertyTypes: "HOUSE,APARTMENT,LAND,COMMERCIAL,OTHER",
    status: "ACTIVE",
    monthlyFee: 200,
    pricePerAppointment: 120,
  },
  {
    name: "Cap Norfeu Estates",
    zones: "CADAQUES,ROSES",
    email: "hello@capnorfeu.example.com",
    phone: "+34 972 000 404",
    languages: "en,de,fr,es",
    propertyTypes: "VILLA,HOUSE",
    status: "PAUSED",
    monthlyFee: 350,
    pricePerAppointment: 180,
  },
];

const CAMPAIGNS = [
  { channel: "GOOGLE_ADS", name: "Search · 'vender casa Roses' (ES/CA/FR/DE)", impressions: 18400, clicks: 610, leads: 24, spend: 520, appointments: 4 },
  { channel: "META_ADS", name: "Lead ads · propietarios no residentes", impressions: 42000, clicks: 980, leads: 31, spend: 480, appointments: 4 },
  { channel: "SEO", name: "Guías de venta por municipio", impressions: 6200, clicks: 340, leads: 9, spend: 90, appointments: 2 },
  { channel: "PARTNERS", name: "Gestorías y administradores de fincas", impressions: 1500, clicks: 120, leads: 6, spend: 150, appointments: 2 },
];

/** Reubica en el tiempo los registros generados "ahora" por los servicios, para que el histórico sea realista. */
async function backdate(leadId: string, base: Date) {
  const step = 6 * 60 * 1000;
  const events = await prisma.event.findMany({ where: { leadId }, orderBy: { createdAt: "asc" } });
  let i = 0;
  for (const e of events) {
    if (e.createdAt.getTime() <= base.getTime() + 1000) continue;
    i++;
    await prisma.event.update({ where: { id: e.id }, data: { createdAt: new Date(base.getTime() + i * step) } });
  }
  const conversations = await prisma.conversation.findMany({ where: { leadId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  for (const c of conversations) {
    const start = new Date(base.getTime() + 4 * 60 * 1000);
    await prisma.conversation.update({ where: { id: c.id }, data: { createdAt: start } });
    for (const [j, m] of c.messages.entries()) {
      await prisma.conversationMessage.update({ where: { id: m.id }, data: { createdAt: new Date(start.getTime() + j * 50 * 1000) } });
    }
  }
  await prisma.appointment.updateMany({ where: { leadId }, data: { createdAt: new Date(base.getTime() + 12 * 60 * 1000) } });
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      qualifiedAt: lead.qualifiedAt ? new Date(base.getTime() + 10 * 60 * 1000) : null,
      assignedAt: lead.assignedAt ? new Date(base.getTime() + 12 * 60 * 1000) : null,
    },
  });
  await prisma.note.updateMany({ where: { leadId }, data: { createdAt: new Date(base.getTime() + 60 * 60 * 1000) } });
}

export async function clearDatabase() {
  // Las cachés de fuentes oficiales (INE, zonas tensionadas) y las referencias de mercado se conservan.
  await prisma.study.deleteMany();
  await prisma.conversationMessage.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.note.deleteMany();
  await prisma.event.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.property.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.agency.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.setting.deleteMany();
}

export async function seedDemoData(log: (msg: string) => void = () => {}) {
  await clearDatabase();
  await saveSettings(DEFAULT_SETTINGS);
  for (const a of AGENCIES) await prisma.agency.create({ data: a });
  for (const c of CAMPAIGNS) await prisma.campaign.create({ data: { ...c, periodLabel: "Simulación · últimos 30 días", isDemo: true } });
  log(`${AGENCIES.length} inmobiliarias y ${CAMPAIGNS.length} campañas demo`);

  // Tráfico anónimo simulado (visitantes que no dejan datos) para el funnel.
  const rand = mulberry32(42);
  for (let day = 29; day >= 0; day--) {
    const views = 4 + Math.floor(rand() * 6);
    for (let v = 0; v < views; v++) {
      const when = at(day, 8 + Math.floor(rand() * 14), Math.floor(rand() * 60));
      await trackEvent("landing_view", { sessionId: `seed-${day}-${v}`, payload: { simulated: true }, createdAt: when });
      if (rand() < 0.22) await trackEvent("valuation_started", { sessionId: `seed-${day}-${v}`, payload: { simulated: true }, createdAt: when });
    }
  }

  for (const seed of LEADS) {
    const base = at(seed.daysAgo, seed.hour, 10);
    const sessionId = `seed-lead-${seed.key}`;
    await trackEvent("landing_view", { sessionId, createdAt: base });
    await trackEvent("valuation_started", { sessionId, createdAt: base });
    const email = `${seed.input.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, ".")}@example.com`;
    const lead = await createLead(
      { ...seed.input, email, consentContact: true, consentMarketing: seed.input.consentMarketing ?? false },
      { source: seed.source, sessionId, isDemo: true, createdAt: base },
    );

    if (seed.script) await runScriptedConversation(lead.id, seed.script(seed.input.language));

    if (seed.book) {
      let date: Date;
      if (seed.book.daysFromNow < 0) {
        // Cita ya realizada: 4 días después de la entrada del lead.
        const [h, m] = seed.book.time.split(":").map(Number);
        date = new Date(base.getTime() + 4 * 24 * 3600 * 1000);
        date.setHours(h, m, 0, 0);
      } else {
        date = slotAt(seed.book.daysFromNow, seed.book.time);
      }
      if (seed.book.status === "REQUESTED") {
        await bookAppointment(lead.id, date, { source: "AGENT", status: "REQUESTED", notes: "Cita sugerida por el agente; pendiente de confirmar" });
      } else if (seed.script) {
        await bookFromAgent(lead.id, date.toISOString());
      } else {
        await bookAppointment(lead.id, date, { source: "WEB_FORM" });
      }
      if (seed.book.status === "COMPLETED") {
        await prisma.appointment.updateMany({ where: { leadId: lead.id }, data: { status: "COMPLETED" } });
      }
    }

    if (seed.note) await addNote(lead.id, seed.note);
    await backdate(lead.id, base);

    if (seed.finalStatus) {
      const when = new Date(Math.min(Date.now(), base.getTime() + 6 * 24 * 3600 * 1000));
      await updateLeadStatus(lead.id, seed.finalStatus, { by: "admin", reason: seed.lostReason, createdAt: when });
    }
    log(`Lead ${seed.input.name} (${seed.key})`);
  }

  const total = await prisma.lead.count();
  log(`Total leads: ${total}`);
  return { leads: total };
}
