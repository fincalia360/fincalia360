// Formulario de contacto de la web. Los mensajes se guardan para el administrador (panel → Mensajes
// de contacto) y, si el correo está configurado, se avisa al equipo. Nunca se simula el envío.
import { z } from "zod";
import { portalDict, toSiteLang } from "@/lib/i18n/site";
import { prisma } from "@/db/client";
import { audit } from "@/services/audit";
import { emailConfig, sendEmail } from "@/services/email/emailService";

export const CONTACT_CONSENT_VERSION = "contacto-v1-2026-10";
export const CONTACT_CONSENT_TEXT = "He leído la política de privacidad y acepto que FINCALIA360 trate mis datos para responder a mi mensaje.";

export const CONTACT_STATUSES = { NEW: "Nuevo", HANDLED: "Atendido", DISCARDED: "Descartado" } as const;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Indica tu nombre").max(100),
  email: z.string().trim().toLowerCase().email("Email no válido").max(150),
  phone: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().regex(/^[+\d][\d\s().-]{6,19}$/, "Teléfono no válido").nullable().optional()),
  subject: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(120).nullable().optional()),
  message: z.string().trim().min(10, "Escribe tu mensaje (al menos 10 caracteres)").max(4000),
  privacy: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()).refine((v) => v, "Debes aceptar la política de privacidad para enviar el mensaje"),
  website: z.string().optional(),
  elapsedMs: z.coerce.number().optional(),
  lang: z.string().max(5).optional(),
});

export class ContactError extends Error {}

export async function submitContactMessage(raw: unknown) {
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) throw new ContactError(parsed.error.issues[0]?.message ?? "Datos no válidos");
  const d = parsed.data;
  if (d.website || (d.elapsedMs != null && d.elapsedMs < 2500)) throw new ContactError("No se ha podido enviar el mensaje. Inténtalo de nuevo.");
  const msg = await prisma.contactMessage.create({
    data: {
      name: d.name,
      email: d.email,
      phone: d.phone ?? null,
      subject: d.subject ?? null,
      message: d.message,
      consentVersion: CONTACT_CONSENT_VERSION,
      consentText: portalDict(toSiteLang(d.lang)).contact.consent,
    },
  });
  await audit({ type: "PUBLIC" }, "contact.create", "ContactMessage", msg.id, null, null);
  const team = emailConfig().team;
  if (team) {
    await sendEmail({
      to: team,
      replyTo: d.email,
      subject: `Nuevo mensaje de contacto: ${d.subject ?? d.name}`.slice(0, 140),
      text: [`Nombre: ${d.name}`, `Email: ${d.email}`, d.phone ? `Teléfono: ${d.phone}` : null, d.subject ? `Asunto: ${d.subject}` : null, "", d.message, "", "Lo tienes en el panel: Mensajes de contacto."]
        .filter((l) => l !== null)
        .join("\n"),
    });
  }
  return msg;
}

export async function listContactMessages(status?: string) {
  return prisma.contactMessage.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 300 });
}

export async function setContactStatus(adminId: string, id: string, status: keyof typeof CONTACT_STATUSES) {
  await prisma.contactMessage.update({ where: { id }, data: { status } });
  await audit({ type: "ADMIN", id: adminId }, "contact.status", "ContactMessage", id, status, null);
}

/** Supresión a petición del interesado. */
export async function deleteContactMessage(adminId: string, id: string) {
  await prisma.contactMessage.delete({ where: { id } });
  await audit({ type: "ADMIN", id: adminId }, "contact.delete", "ContactMessage", id, null, null);
}
