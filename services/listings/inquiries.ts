// Solicitudes de información o visita desde la ficha pública de un inmueble.
// - Consentimiento explícito y nunca premarcado; el texto exacto se guarda con la solicitud.
// - Si el inmueble es de una inmobiliaria, la solicitud llega a SU CRM (y solo al suyo).
// - Avisos por correo solo si el proveedor está configurado (nunca se simulan).
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { sendEmail, emailConfig } from "@/services/email/emailService";
import { normalizePhone } from "@/services/crm/requests";
import { audit } from "@/services/audit";
import { formatPrice } from "./catalog";
import { SITE_LANGUAGES, portalDict, toSiteLang } from "@/lib/i18n/site";

export const INQUIRY_CONSENT_VERSION = "portal-v1-2026-10";

export function inquiryConsentText(advertiser: string | null, reference: string, category?: string | null) {
  const what = category === "MOORING" ? "amarre" : "inmueble";
  return advertiser
    ? `Acepto que FINCALIA360 comunique mis datos a ${advertiser}, anunciante del ${what} ${reference}, para que responda a mi solicitud.`
    : `Acepto que FINCALIA360 trate mis datos para responder a mi solicitud sobre el ${what} ${reference}.`;
}

export const inquirySchema = z
  .object({
    name: z.string().trim().min(2, "Indica tu nombre").max(80),
    email: z.string().trim().toLowerCase().email("Email no válido").max(120),
    phone: z.string().trim().max(30).regex(/^[+()\d\s.-]*$/, "Teléfono no válido").optional().or(z.literal("")),
    message: z.string().trim().max(1500).optional().or(z.literal("")),
    wantsVisit: z.boolean().default(false),
    consent: z.literal(true, { errorMap: () => ({ message: "Necesitamos tu autorización para enviar la solicitud" }) }),
    website: z.string().max(0, "Solicitud no válida").optional().or(z.literal("")),
    elapsedMs: z.number().optional(),
    /** Idioma en que se mostró el formulario (el consentimiento se guarda tal como se leyó). */
    lang: z.string().max(5).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.wantsVisit && (v.phone ?? "").replace(/\D/g, "").length < 9) ctx.addIssue({ code: "custom", path: ["phone"], message: "Indica un teléfono para concertar la visita" });
  });

export type InquiryResult = { ok: true } | { ok: false; status: 400 | 404; error: string };

export async function submitInquiry(reference: string, raw: unknown): Promise<InquiryResult> {
  const listing = await prisma.listing.findFirst({
    where: { reference, status: { in: ["PUBLISHED", "RESERVED"] }, OR: [{ agencyId: null }, { agency: { crmAccess: true, status: "ACTIVE" } }] },
    include: { agency: { select: { id: true, name: true } } },
  });
  if (!listing) return { ok: false, status: 404, error: "Este inmueble ya no está disponible" };
  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  if (d.website || (d.elapsedMs != null && d.elapsedMs < 2500)) return { ok: false, status: 400, error: "No se ha podido enviar la solicitud. Inténtalo de nuevo." };

  const phone = d.phone?.trim() || null;
  const consentText =
    d.lang && d.lang !== "es" && (SITE_LANGUAGES as readonly string[]).includes(d.lang)
      ? portalDict(toSiteLang(d.lang)).inquiry.consent(listing.agency?.name ?? null, listing.category === "MOORING" ? "amarre" : "inmueble", listing.reference)
      : inquiryConsentText(listing.agency?.name ?? null, listing.reference, listing.category);
  let contactId: string | null = null;

  if (listing.agencyId) {
    // Contacto en el CRM de la inmobiliaria anunciante (sin duplicar por email o teléfono)
    const p = normalizePhone(phone);
    const or: Prisma.AgencyContactWhereInput[] = [{ emailNormalized: d.email }, ...(p ? [{ phoneNormalized: p }] : [])];
    const existing = await prisma.agencyContact.findFirst({ where: { agencyId: listing.agencyId, OR: or } });
    const action = `Responder solicitud del portal (${listing.reference})${d.wantsVisit ? ": quiere visitarlo" : ""}`;
    if (existing) {
      contactId = existing.id;
      await prisma.agencyContact.update({
        where: { id: existing.id },
        data: {
          phone: existing.phone ?? phone,
          phoneNormalized: existing.phoneNormalized ?? p,
          nextAction: action,
          nextActionAt: new Date(),
          ...(existing.status === "LOST" || existing.status === "WON" ? { status: "PENDING_CONTACT" } : {}),
        },
      });
    } else {
      const c = await prisma.agencyContact.create({
        data: {
          agencyId: listing.agencyId,
          kind: listing.operation === "RENT" ? "TENANT" : "BUYER",
          name: d.name,
          email: d.email,
          phone,
          emailNormalized: d.email,
          phoneNormalized: p,
          status: "NEW",
          source: "PORTAL",
          nextAction: action,
          nextActionAt: new Date(),
        },
      });
      contactId = c.id;
    }
    await prisma.agencyActivity.create({
      data: {
        agencyId: listing.agencyId,
        contactId,
        type: "SYSTEM",
        summary: `Solicitud desde el portal sobre ${listing.reference}${d.wantsVisit ? " (quiere visitarlo)" : ""}${d.message ? `: «${d.message.slice(0, 400)}»` : ""}`,
      },
    });
  }

  const inquiry = await prisma.listingInquiry.create({
    data: {
      listingId: listing.id,
      agencyId: listing.agencyId,
      name: d.name,
      email: d.email,
      phone,
      message: d.message || null,
      wantsVisit: d.wantsVisit,
      consentVersion: INQUIRY_CONSENT_VERSION,
      consentText,
      contactId,
    },
  });
  await audit({ type: "PUBLIC" }, "inquiry.create", "ListingInquiry", inquiry.id, listing.reference, listing.agencyId);

  // Aviso al anunciante (correo de servicio). Sin proveedor configurado no se envía nada.
  const recipients = listing.agencyId
    ? (await prisma.agencyUser.findMany({ where: { agencyId: listing.agencyId, status: "ACTIVE" }, orderBy: [{ role: "asc" }], select: { email: true, role: true } }))
        .sort((a, b) => (a.role === "OWNER" ? -1 : b.role === "OWNER" ? 1 : 0))
        .slice(0, 3)
        .map((u) => u.email)
    : [emailConfig().team].filter((x): x is string => Boolean(x));
  for (const to of recipients) {
    await sendEmail({
      to,
      replyTo: d.email,
      subject: `Nueva solicitud: ${listing.reference} · ${listing.title}`.slice(0, 140),
      text: [
        `Nueva solicitud de ${d.wantsVisit ? "visita" : "información"} desde FINCALIA360.`,
        "",
        `Inmueble: ${listing.reference} · ${listing.title} (${formatPrice(listing.price, listing.operation)})`,
        `Nombre: ${d.name}`,
        `Email: ${d.email}`,
        phone ? `Teléfono: ${phone}` : null,
        d.message ? `Mensaje: ${d.message}` : null,
        "",
        listing.agencyId ? "La tienes en tu CRM, en la Zona inmobiliarias." : "La tienes en el panel, en Inmuebles → Solicitudes.",
      ]
        .filter((l) => l !== null)
        .join("\n"),
    });
  }
  return { ok: true };
}

// --------------------------------------------------------------------- Panel del administrador
export async function listAllInquiries(f: { listingId?: string; status?: string; own?: boolean } = {}) {
  return prisma.listingInquiry.findMany({
    where: { ...(f.listingId ? { listingId: f.listingId } : {}), ...(f.status ? { status: f.status } : {}), ...(f.own ? { agencyId: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { listing: { select: { id: true, reference: true, title: true, agency: { select: { name: true } } } } },
  });
}
