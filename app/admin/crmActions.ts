"use server";

// Acciones del CRM. Cada una comprueba la sesión en el servidor (requireAdmin) y valida los datos.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/db/client";
import { CONTACT_CHANNELS, addRevenue, assignPartner, changeStatus, eraseContact, logContact, setNextAction, updateAssignment, updatePreferences } from "@/services/crm/contacts";

export type CrmActionState = { ok?: boolean; error?: string };

const fail = (error: unknown): CrmActionState => ({ error: error instanceof z.ZodError ? (error.issues[0]?.message ?? "Datos no válidos") : (error as Error).message });
const refresh = (leadId: string) => revalidatePath(`/admin/leads/${leadId}`);

/** «2026-10-12T10:30» del formulario, en hora peninsular española (con horario de verano) → Date. */
function parseLocal(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const asUtc = new Date(`${value}:00Z`);
  const offset = Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", timeZoneName: "shortOffset" })
    .formatToParts(asUtc)
    .find((p) => p.type === "timeZoneName")?.value.match(/GMT([+-]\d+)/)?.[1];
  const hours = offset ? Number(offset) : 1;
  return new Date(asUtc.getTime() - hours * 3600_000);
}

export async function changeStatusAction(leadId: string, _prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();
  try {
    await changeStatus(leadId, z.string().min(1).max(40).parse(formData.get("status")));
    refresh(leadId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setNextActionAction(leadId: string, _prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();
  try {
    const action = z.string().trim().min(2, "Describe la próxima acción").max(200).parse(formData.get("action"));
    await setNextAction(leadId, action, parseLocal(String(formData.get("dueAt") ?? "")));
    refresh(leadId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function logContactAction(leadId: string, _prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();
  try {
    const channel = z.enum(Object.keys(CONTACT_CHANNELS) as [keyof typeof CONTACT_CHANNELS]).parse(formData.get("channel"));
    const summary = z.string().trim().min(2, "Resume la comunicación").max(500).parse(formData.get("summary"));
    await logContact(leadId, channel, summary, parseLocal(String(formData.get("at") ?? "")) ?? new Date());
    refresh(leadId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updatePreferencesAction(leadId: string, _prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();
  try {
    await updatePreferences(leadId, {
      preferredContact: z.enum(["PHONE", "WHATSAPP", "EMAIL"]).parse(formData.get("preferredContact")),
      contactWindow: z.enum(["MORNING", "AFTERNOON", "EVENING", "ANY"]).nullable().parse(formData.get("contactWindow") || null),
      revokeMarketing: formData.get("revokeMarketing") === "on",
      revokePartnerShare: formData.get("revokePartnerShare") === "on",
    });
    refresh(leadId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function assignPartnerAction(leadId: string, _prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();
  try {
    await assignPartner(leadId, z.string().min(1, "Elige un colaborador").parse(formData.get("agencyId")), (formData.get("serviceCode") as string) || null);
    refresh(leadId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateAssignmentAction(assignmentId: string, leadId: string, _prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();
  try {
    await updateAssignment(assignmentId, z.string().parse(formData.get("status")), z.string().trim().max(500).parse(formData.get("result") ?? ""));
    refresh(leadId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addRevenueAction(leadId: string | null, _prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();
  try {
    const amount = z.coerce.number({ invalid_type_error: "Importe no válido" }).int("Importe en euros, sin decimales").positive("El importe debe ser mayor que 0").max(10_000_000).parse(formData.get("amount"));
    const date = z.coerce.date({ invalid_type_error: "Fecha no válida" }).parse(formData.get("date"));
    const description = z.string().trim().min(3, "Describe el ingreso").max(200).parse(formData.get("description"));
    await addRevenue({
      leadId,
      agencyId: (formData.get("agencyId") as string) || null,
      serviceCode: (formData.get("serviceCode") as string) || null,
      amount,
      date,
      description,
    });
    if (leadId) refresh(leadId);
    revalidatePath("/admin/negocio");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function eraseContactAction(leadId: string, _prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();
  if (formData.get("confirm") !== "SUPRIMIR") return { error: "Escribe SUPRIMIR para confirmar" };
  const exists = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!exists) return { error: "Contacto no encontrado" };
  await eraseContact(leadId);
  revalidatePath("/admin/leads");
  redirect(`/admin/leads/${leadId}?erased=1`);
}
