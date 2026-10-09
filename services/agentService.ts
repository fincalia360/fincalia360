// Orquesta la conversación del agente: persiste mensajes, aplica los datos
// extraídos al lead, recalcula score, cualifica y reserva citas.
import { prisma } from "@/db/client";
import { LOCALES, getDictionary, t } from "@/lib/i18n";
import { parseJSON } from "@/lib/utils";
import type { ExtractedData, Language, Slot } from "@/types";
import { getAIProvider, type AgentTurnOutput, type ConversationState, type QuickReply } from "./ai";
import { trackEvent } from "./analyticsService";
import { bookAppointment, getAvailableSlots } from "./appointmentService";
import { qualifyLead, refreshScore, updateLeadStatus } from "./leadService";

interface MessageMeta {
  quickReplies?: QuickReply[];
  action?: AgentTurnOutput["action"];
  value?: string;
}

export interface ConversationView {
  conversationId: string;
  provider: string;
  leadId: string;
  leadName: string;
  language: Language;
  step: string;
  messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
  quickReplies: QuickReply[];
  showSlots: boolean;
  slots: Slot[];
  extracted: ExtractedData;
  lead: {
    score: number;
    scoreTier: string;
    status: string;
    intent: string;
    agencyName: string | null;
    appointmentAt: string | null;
  };
}

async function loadLead(leadId: string) {
  return prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      property: true,
      agency: { select: { name: true } },
      appointments: { where: { status: { in: ["BOOKED", "REQUESTED"] } }, orderBy: { scheduledAt: "asc" }, take: 1 },
    },
  });
}

type LeadWithRelations = Awaited<ReturnType<typeof loadLead>>;

/** Lo que el agente ya sabe: datos del formulario + datos extraídos en la conversación. */
function knownFromLead(lead: LeadWithRelations, extracted: ExtractedData): ExtractedData {
  return {
    language: lead.language as Language,
    location: (lead.property?.location as ExtractedData["location"]) ?? undefined,
    propertyType: (lead.property?.type as ExtractedData["propertyType"]) ?? undefined,
    sqm: lead.property?.sqm ?? undefined,
    bedrooms: lead.property?.bedrooms ?? undefined,
    timeline: lead.timeline as ExtractedData["timeline"],
    situation: lead.situation as ExtractedData["situation"],
    motivation: (lead.motivation as ExtractedData["motivation"]) ?? undefined,
    estimatedValue: lead.estimatedValue ?? undefined,
    preferredContact: (lead.preferredContact as ExtractedData["preferredContact"]) ?? undefined,
    intent: lead.intent as ExtractedData["intent"],
    ...extracted,
    appointmentInterest: extracted.appointmentInterest ?? (lead.appointmentInterest || undefined),
  };
}

function firstName(name: string) {
  return name.split(" ")[0];
}

async function getOrCreateConversation(leadId: string) {
  const existing = await prisma.conversation.findFirst({ where: { leadId }, orderBy: { createdAt: "desc" } });
  if (existing) return existing;

  const lead = await loadLead(leadId);
  const provider = getAIProvider();
  const output = await provider.generateReply({
    language: lead.language as Language,
    leadName: firstName(lead.name),
    state: null,
    known: knownFromLead(lead, {}),
    userMessage: null,
  });
  const conversation = await prisma.conversation.create({
    data: {
      leadId,
      provider: provider.name,
      channel: "WHATSAPP_DEMO",
      state: JSON.stringify(output.nextState),
      extracted: JSON.stringify(output.extracted),
      messages: {
        create: {
          role: "agent",
          content: output.reply,
          meta: JSON.stringify({ quickReplies: output.quickReplies, action: output.action } satisfies MessageMeta),
        },
      },
    },
  });
  await trackEvent("agent_started", { leadId });
  return conversation;
}

export async function getConversationView(leadId: string): Promise<ConversationView> {
  const conversation = await getOrCreateConversation(leadId);
  const [lead, messages] = await Promise.all([
    loadLead(leadId),
    prisma.conversationMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const state = parseJSON<ConversationState | null>(conversation.state, null);
  const lastAgent = [...messages].reverse().find((m) => m.role === "agent");
  const lastMeta = parseJSON<MessageMeta>(lastAgent?.meta, {});
  const showSlots = state?.step === "SLOTS" && lastMeta.action === "SHOW_SLOTS";

  return {
    conversationId: conversation.id,
    provider: conversation.provider,
    leadId,
    leadName: lead.name,
    language: lead.language as Language,
    step: state?.step ?? "CONFIRM_INTEREST",
    messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString() })),
    quickReplies: lastAgent === messages[messages.length - 1] ? (lastMeta.quickReplies ?? []) : [],
    showSlots,
    slots: showSlots ? await getAvailableSlots() : [],
    extracted: knownFromLead(lead, parseJSON<ExtractedData>(conversation.extracted, {})),
    lead: {
      score: lead.score,
      scoreTier: lead.scoreTier,
      status: lead.status,
      intent: lead.intent,
      agencyName: lead.agency?.name ?? null,
      appointmentAt: lead.appointments[0]?.scheduledAt.toISOString() ?? null,
    },
  };
}

/** Aplica al lead los datos estructurados detectados por el agente. */
async function applyExtracted(lead: LeadWithRelations, data: Partial<ExtractedData>) {
  const leadData: Record<string, unknown> = {};
  if (data.timeline) leadData.timeline = data.timeline;
  if (data.situation) leadData.situation = data.situation;
  if (data.motivation) leadData.motivation = data.motivation;
  if (data.motivationText) leadData.motivationText = data.motivationText;
  if (data.urgency) leadData.urgency = data.urgency;
  if (data.agencyInterest !== undefined) leadData.agencyInterest = data.agencyInterest;
  if (data.appointmentInterest !== undefined) leadData.appointmentInterest = data.appointmentInterest;
  if (data.preferredContact) leadData.preferredContact = data.preferredContact;
  if (Object.keys(leadData).length) await prisma.lead.update({ where: { id: lead.id }, data: leadData });

  const propertyData: Record<string, unknown> = {};
  if (data.location) propertyData.location = data.location;
  if (data.propertyType) propertyData.type = data.propertyType;
  if (data.sqm) propertyData.sqm = data.sqm;
  if (data.bedrooms) propertyData.bedrooms = data.bedrooms;
  if (data.features?.includes("RENOVATED")) propertyData.condition = "NEW";
  if (data.features?.includes("TO_REFORM")) propertyData.condition = "TO_REFORM";
  if (Object.keys(propertyData).length && lead.property) {
    await prisma.property.update({ where: { id: lead.property.id }, data: propertyData });
  }
}

export async function sendMessage(leadId: string, message: { text: string; value?: string }): Promise<ConversationView> {
  const conversation = await getOrCreateConversation(leadId);
  const lead = await loadLead(leadId);
  const state = parseJSON<ConversationState | null>(conversation.state, null);
  const previous = parseJSON<ExtractedData>(conversation.extracted, {});

  const leadAt = new Date();
  await prisma.conversationMessage.create({
    data: { conversationId: conversation.id, role: "lead", content: message.text, createdAt: leadAt, meta: message.value ? JSON.stringify({ value: message.value }) : null },
  });

  const provider = getAIProvider();
  const output = await provider.generateReply({
    language: lead.language as Language,
    leadName: firstName(lead.name),
    state: state ?? { step: "CONFIRM_INTEREST", covered: [], attempts: 0, turn: 0 },
    known: knownFromLead(lead, previous),
    userMessage: message,
  });

  const extracted = { ...previous, ...output.extracted };
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      state: JSON.stringify(output.nextState),
      extracted: JSON.stringify(extracted),
      status: output.action === "COMPLETE" ? "COMPLETED" : "ACTIVE",
      messages: {
        create: {
          role: "agent",
          content: output.reply,
          createdAt: new Date(leadAt.getTime() + 1),
          meta: JSON.stringify({ quickReplies: output.quickReplies, action: output.action } satisfies MessageMeta),
        },
      },
    },
  });

  await applyExtracted(lead, output.extracted);
  await refreshScore(leadId);

  // Transiciones de estado derivadas de la conversación.
  if (lead.status === "NEW") await updateLeadStatus(leadId, "CONTACTED", { by: "agent" });
  const covered = output.nextState.covered;
  const qualified =
    extracted.confirmedInterest !== false &&
    covered.includes("TIMELINE") &&
    (covered.includes("MOTIVATION") || Boolean(extracted.motivation ?? lead.motivation)) &&
    extracted.timeline !== "INFO_ONLY";
  if (qualified) await qualifyLead(leadId, "agent");
  if (output.action === "SHOW_SLOTS") await trackEvent("appointment_started", { leadId });

  return getConversationView(leadId);
}

export async function bookFromAgent(leadId: string, slotIso: string): Promise<ConversationView> {
  const conversation = await getOrCreateConversation(leadId);
  const { agency } = await bookAppointment(leadId, new Date(slotIso), { source: "AGENT" });
  const lead = await loadLead(leadId);
  const lang = lead.language as Language;
  const dict = getDictionary(lang);
  const date = new Date(slotIso);
  const vars = {
    date: date.toLocaleDateString(LOCALES[lang], { weekday: "long", day: "numeric", month: "long" }),
    time: date.toLocaleTimeString(LOCALES[lang], { hour: "2-digit", minute: "2-digit" }),
    agency: agency?.name ?? "",
  };
  const state = parseJSON<ConversationState>(conversation.state, { step: "BOOKED", covered: [], attempts: 0, turn: 0 });
  const now = new Date();
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      state: JSON.stringify({ ...state, step: "BOOKED" }),
      extracted: JSON.stringify({ ...parseJSON<ExtractedData>(conversation.extracted, {}), appointmentInterest: true }),
      status: "COMPLETED",
      messages: {
        create: [
          { role: "lead", content: `${vars.date} · ${vars.time}`, createdAt: now },
          { role: "agent", createdAt: new Date(now.getTime() + 1), content: t(agency ? dict.agent.booked : dict.agent.bookedNoAgency, vars), meta: JSON.stringify({ action: "COMPLETE" }) },
        ],
      },
    },
  });
  return getConversationView(leadId);
}

export async function resetConversation(leadId: string) {
  await prisma.conversation.deleteMany({ where: { leadId } });
  return getConversationView(leadId);
}

/**
 * Conversación guiada (simulaciones): responde a la pregunta que el agente tenga
 * pendiente en cada momento, con la respuesta prevista para ese paso.
 */
export async function runGuidedConversation(
  leadId: string,
  answers: Partial<Record<string, { text: string; value?: string }>>,
  maxTurns = 12,
) {
  let view = await getConversationView(leadId);
  for (let i = 0; i < maxTurns; i++) {
    const answer = answers[view.step];
    if (!answer) break;
    view = await sendMessage(leadId, answer);
  }
  return view;
}

/** Ejecuta una conversación guionizada (para simulaciones y seed). */
export async function runScriptedConversation(leadId: string, script: Array<{ text: string; value?: string }>) {
  let view = await getConversationView(leadId);
  for (const turn of script) {
    view = await sendMessage(leadId, turn);
  }
  return view;
}
