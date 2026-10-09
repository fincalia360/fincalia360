// Solicitudes de los propietarios desde la pantalla final del estudio → contacto en el CRM.
// - Un contacto por persona: se reutiliza si coincide el email o el teléfono (sin duplicados).
// - Cada solicitud guarda sus consentimientos (texto, versión y fecha).
// - Los correos solo se envían si el proveedor está configurado; nunca se simulan.
import { z } from "zod";
import { prisma } from "@/db/client";
import { CONTACT_WINDOW_LABELS, INTEREST_LABELS } from "@/lib/labels";
import type { PropertyType, Situation, Timeline } from "@/types";
import { emitBusinessEvent } from "@/services/notificationService";
import { calculateScore, intentFromTimeline } from "@/services/scoringService";
import { addNote, updateLeadStatus } from "@/services/leadService";
import { trackEvent } from "@/services/analyticsService";
import { sendEmail, type EmailResult } from "@/services/email/emailService";
import { verifyToken } from "@/services/study/access";
import { renderStudyPdf } from "@/services/study/report/pdf";
import { parseStudy } from "@/services/study/studyService";
import { PROPERTY_KIND_LABELS, type StudyInput } from "@/services/study/types";

export const REQUEST_CONSENT_VERSION = "solicitud-v1-2026-10";
export const CONSENT_TEXTS = {
  contact: "Acepto que FINCALIA360 trate mis datos para atender esta solicitud y contactarme sobre ella.",
  report: "Acepto que FINCALIA360 use mi email para enviarme mi informe.",
  partner:
    "Acepto que FINCALIA360 comunique mis datos de contacto y los de mi vivienda a un profesional colaborador de mi zona (inmobiliaria o asesor) para que me preste el servicio solicitado.",
  marketing: "Quiero recibir información comercial de FINCALIA360 por email. Puedo darme de baja en cualquier momento.",
} as const;

export const INTERESTS = ["SELL", "RENT", "ADVICE", "REPORT_ONLY"] as const;
export type Interest = (typeof INTERESTS)[number];
export const COMMERCIAL_INTERESTS: Interest[] = ["SELL", "RENT", "ADVICE"];

export const requestSchema = z
  .object({
    interest: z.enum(INTERESTS),
    name: z.string().trim().min(2, "Indica tu nombre").max(80),
    email: z.string().trim().toLowerCase().email("Email no válido").max(120),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+()\d\s.-]*$/, "Teléfono no válido")
      .optional()
      .or(z.literal("")),
    contactChannel: z.enum(["PHONE", "WHATSAPP", "EMAIL"]).default("EMAIL"),
    contactWindow: z.enum(["MORNING", "AFTERNOON", "EVENING", "ANY"]).optional(),
    comments: z.string().trim().max(1000).optional().or(z.literal("")),
    consentContact: z.literal(true, { errorMap: () => ({ message: "Necesitamos tu autorización para atender la solicitud" }) }),
    consentPartnerShare: z.boolean().default(false),
    consentMarketing: z.boolean().default(false),
    // Antispam: campo trampa (debe venir vacío) y tiempo desde que se abrió el formulario
    website: z.string().max(0, "Solicitud no válida").optional().or(z.literal("")),
    elapsedMs: z.number().optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.contactChannel === "PHONE" || v.contactChannel === "WHATSAPP") && (v.phone ?? "").replace(/\D/g, "").length < 9) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Indica un teléfono para poder llamarte" });
    }
  });

export type RequestInput = z.infer<typeof requestSchema>;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
/** Últimas 9 cifras (número nacional sin prefijo) o null. */
export function normalizePhone(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
}

/** Busca un contacto existente por email o teléfono (evita duplicados). */
export async function findExistingContact(email: string, phone?: string | null) {
  const e = normalizeEmail(email);
  const p = normalizePhone(phone);
  return prisma.lead.findFirst({
    where: { isDemo: false, OR: [{ emailNormalized: e }, { email: e }, ...(p ? [{ phoneNormalized: p }] : [])] },
    orderBy: { createdAt: "asc" },
  });
}

function leadFieldsFromStudy(input: StudyInput, interest: Interest) {
  const type: PropertyType = input.property.kind === "VILLA" ? "VILLA" : ["CASA_ADOSADA", "CASA_INDEPENDIENTE"].includes(input.property.kind) ? "HOUSE" : "APARTMENT";
  const goal = input.owner.goal;
  const timeline: Timeline =
    interest === "REPORT_ONLY" ? "INFO_ONLY" : goal === "SELL_SOON" ? (input.owner.horizon <= 1 ? "M1_3" : "M3_6") : goal === "UNSURE" ? "M6_12" : "LATER";
  const situationMap: Record<StudyInput["property"]["currentUse"], Situation> = {
    EMPTY: "EMPTY",
    OWNER_PRIMARY: "PRIMARY",
    SECOND_HOME: "SECOND_HOME",
    RENTED: "RENTED",
    TOURIST: "TOURIST",
    OTHER: "SECOND_HOME",
  };
  return { type, timeline, situation: situationMap[input.property.currentUse] };
}

export type SubmitResult =
  | { ok: false; status: 400 | 404; error: string }
  | { ok: true; leadId: string; requestId: string; existingContact: boolean; ownerEmail: EmailResult["status"] | "NOT_REQUESTED" };

/** Registra una solicitud de la pantalla final del estudio (sin pedir de nuevo los datos ya conocidos). */
export async function submitStudyRequest(studyId: string, token: string | undefined, raw: unknown): Promise<SubmitResult> {
  const study = await prisma.study.findUnique({ where: { id: studyId } });
  if (!study || !verifyToken(token, study.tokenHash)) return { ok: false, status: 404, error: "Estudio no encontrado" };
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const data = parsed.data;
  if (data.website || (data.elapsedMs != null && data.elapsedMs < 2500)) return { ok: false, status: 400, error: "No se ha podido enviar la solicitud. Inténtalo de nuevo." };

  const { input, snapshot, assumptions } = parseStudy(study);
  const commercial = COMMERCIAL_INTERESTS.includes(data.interest);
  const now = new Date();
  const phone = data.phone?.trim() || null;
  const sale = snapshot.sale && snapshot.sale.origin !== "EXAMPLE" ? snapshot.sale : null;
  const consentText = [
    commercial ? CONSENT_TEXTS.contact : CONSENT_TEXTS.report,
    data.consentPartnerShare ? CONSENT_TEXTS.partner : null,
    data.consentMarketing ? CONSENT_TEXTS.marketing : null,
  ]
    .filter(Boolean)
    .join(" | ");
  const fields = leadFieldsFromStudy(input, data.interest);
  const existing = await findExistingContact(data.email, phone);

  let leadId: string;
  if (existing) {
    leadId = existing.id;
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        phone: existing.phone ?? phone,
        phoneNormalized: existing.phoneNormalized ?? normalizePhone(phone),
        emailNormalized: normalizeEmail(existing.email),
        preferredContact: data.contactChannel,
        contactWindow: data.contactWindow ?? existing.contactWindow,
        primaryInterest: commercial ? data.interest : (existing.primaryInterest ?? data.interest),
        partnerShareConsent: existing.partnerShareConsent || data.consentPartnerShare,
        ...(commercial ? { appointmentInterest: true, nextActionAt: now, nextAction: "Contactar: nueva solicitud" } : {}),
      },
    });
    await prisma.consent.upsert({
      where: { leadId },
      update: {
        consentContact: true,
        consentMarketing: data.consentMarketing,
        consentTimestamp: now,
        consentVersion: REQUEST_CONSENT_VERSION,
        consentText,
      },
      create: { leadId, consentContact: true, consentMarketing: data.consentMarketing, consentTimestamp: now, consentVersion: REQUEST_CONSENT_VERSION, consentText, language: "es" },
    });
    if (commercial && ["NEW", "STUDY_DONE", "LOST"].includes(existing.status)) await updateLeadStatus(leadId, "PENDING_CONTACT", { by: "system" });
  } else {
    const score = calculateScore({
      timeline: fields.timeline,
      estimatedValue: sale?.value ?? null,
      propertyType: fields.type,
      situation: fields.situation,
      hasPhone: Boolean(phone),
      hasEmail: true,
      appointmentInterest: commercial,
    });
    const status = commercial ? "PENDING_CONTACT" : "STUDY_DONE";
    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        email: normalizeEmail(data.email),
        emailNormalized: normalizeEmail(data.email),
        phone,
        phoneNormalized: normalizePhone(phone),
        language: "es",
        preferredContact: data.contactChannel,
        contactWindow: data.contactWindow ?? null,
        source: "STUDY",
        status,
        timeline: fields.timeline,
        situation: fields.situation,
        intent: intentFromTimeline(fields.timeline),
        primaryInterest: data.interest,
        partnerShareConsent: data.consentPartnerShare,
        appointmentInterest: commercial,
        // Solo la valoración del estudio (con sus fuentes); nunca la del modelo de ejemplo
        valuationSource: "STUDY",
        estimatedValue: sale?.value ?? null,
        estimatedValueMin: sale?.low ?? null,
        estimatedValueMax: sale?.high ?? null,
        score: score.score,
        scoreTier: score.tier,
        scoreBreakdown: JSON.stringify(score.breakdown),
        qualifiedAt: commercial ? now : null,
        nextAction: commercial ? "Contactar con el propietario" : "Sin acción comercial: solo ha pedido su informe",
        nextActionAt: commercial ? now : null,
        property: {
          create: {
            location: "OTHER",
            locationOther: input.location.municipalityName,
            type: fields.type,
            sqm: input.property.sqm,
            bedrooms: input.property.bedrooms,
            bathrooms: input.property.bathrooms,
            terrace: input.property.outdoor !== "NONE",
            pool: false,
            parking: input.property.parking,
            condition: input.property.condition,
          },
        },
        consent: {
          create: { consentContact: true, consentMarketing: data.consentMarketing, consentTimestamp: now, consentVersion: REQUEST_CONSENT_VERSION, consentText, language: "es" },
        },
      },
    });
    leadId = lead.id;
    await emitBusinessEvent("LEAD_CREATED", { leadId, payload: { score: score.score, tier: score.tier, source: "STUDY" } });
    await emitBusinessEvent("STAGE_ENTERED", { leadId, payload: { by: "system", from: null, to: status } });
    await trackEvent("lead_created", { leadId });
  }

  const request = await prisma.serviceRequest.create({
    data: {
      leadId,
      studyId,
      interest: data.interest,
      serviceCode: commercial ? data.interest : null,
      contactChannel: data.contactChannel,
      contactWindow: data.contactWindow ?? null,
      comments: data.comments || null,
      consentContact: true,
      consentPartnerShare: data.consentPartnerShare,
      consentMarketing: data.consentMarketing,
      consentVersion: REQUEST_CONSENT_VERSION,
      consentText,
    },
  });

  await prisma.study.update({
    where: { id: studyId },
    data: {
      leadId,
      contactName: data.name,
      contactEmail: normalizeEmail(data.email),
      contactPhone: phone,
      preferredContact: data.contactChannel,
      comments: data.comments || null,
      consentContact: true,
      consentMarketing: data.consentMarketing,
      consentTimestamp: now,
      consentVersion: REQUEST_CONSENT_VERSION,
      ...(commercial ? { valuationRequested: true, contactRequestedAt: now } : {}),
    },
  });

  const municipality = input.location.municipalityName;
  const summary = [
    `Solicitud «${INTEREST_LABELS[data.interest]}» desde el estudio (/admin/studies/${studyId}).`,
    `${PROPERTY_KIND_LABELS[input.property.kind]} de ${input.property.sqm} m² en ${municipality} (${input.location.postalCode}).`,
    sale ? `Venta estimada ${sale.value.toLocaleString("es-ES")} € (${sale.low.toLocaleString("es-ES")}–${sale.high.toLocaleString("es-ES")} €).` : "Sin estimación de venta.",
    snapshot.rent ? `Alquiler estimado ${snapshot.rent.value.toLocaleString("es-ES")} €/mes.` : "",
    `Contacto: ${data.contactChannel}${data.contactWindow ? ` · ${CONTACT_WINDOW_LABELS[data.contactWindow]}` : ""}.`,
    data.consentPartnerShare ? "Acepta que se comuniquen sus datos a un colaborador." : "NO ha autorizado comunicar sus datos a colaboradores.",
    data.comments ? `Comentarios: ${data.comments}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  await addNote(leadId, summary);
  await emitBusinessEvent("REQUEST_RECEIVED", {
    leadId,
    payload: { requestId: request.id, studyId, interest: data.interest, interestLabel: INTEREST_LABELS[data.interest], existingContact: Boolean(existing) },
    notification: commercial
      ? { audience: "internal", subject: `Nueva solicitud (${INTEREST_LABELS[data.interest]}): ${data.name} · ${municipality}`, body: summary }
      : undefined,
  });

  // Correo al propietario (de servicio, no publicitario): confirmación o envío del informe
  let ownerEmail: EmailResult["status"] | "NOT_REQUESTED" = "NOT_REQUESTED";
  if (commercial) {
    const result = await sendEmail({
      to: normalizeEmail(data.email),
      subject: "Hemos recibido tu solicitud · FINCALIA360",
      text: `Hola ${data.name}:\n\nHemos recibido tu solicitud de «${INTEREST_LABELS[data.interest].toLowerCase()}» para tu vivienda en ${municipality}. Te contactaremos por ${data.contactChannel === "EMAIL" ? "email" : "teléfono"}${data.contactWindow ? ` (${CONTACT_WINDOW_LABELS[data.contactWindow].toLowerCase()})` : ""} para estudiar tu caso.\n\nPedir información es gratis y sin compromiso. Si quieres cancelar la solicitud o ejercer tus derechos, responde a este correo.`,
    });
    ownerEmail = result.status;
    await logEmail(leadId, "Hemos recibido tu solicitud", normalizeEmail(data.email), result);
  } else {
    const bytes = await renderStudyPdf({ studyId, input, snapshot, assumptions, horizon: input.owner.horizon });
    const result = await sendEmail({
      to: normalizeEmail(data.email),
      subject: "Tu estudio de vivienda · FINCALIA360",
      text: `Hola ${data.name}:\n\nTe enviamos el informe de tu estudio de la vivienda en ${municipality}. Es una estimación orientativa con sus fuentes y limitaciones.\n\nSi en algún momento quieres ayuda con el siguiente paso, puedes solicitarla desde tu estudio.`,
      attachments: [{ filename: "estudio-vender-o-alquilar.pdf", content: bytes }],
    });
    ownerEmail = result.status;
    await logEmail(leadId, "Tu estudio de vivienda (informe PDF)", normalizeEmail(data.email), result);
    if (result.status === "SENT") await trackEvent("report_generated", { leadId, payload: { studyId, channel: "email" } });
  }

  return { ok: true, leadId, requestId: request.id, existingContact: Boolean(existing), ownerEmail };
}

export async function logEmail(leadId: string, subject: string, to: string, result: EmailResult) {
  const type = result.status === "SENT" ? "EMAIL_SENT" : result.status === "NOT_CONFIGURED" ? "EMAIL_NOT_CONFIGURED" : "EMAIL_FAILED";
  await emitBusinessEvent(type, {
    leadId,
    payload: { subject, to, ...(result.status === "FAILED" ? { error: result.error } : {}), ...(result.status === "NOT_CONFIGURED" ? { error: `falta ${result.missing.join(", ")}` } : {}) },
  });
}
