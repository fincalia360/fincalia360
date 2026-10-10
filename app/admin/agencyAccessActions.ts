"use server";

// Acceso de las inmobiliarias a la Zona inmobiliarias (solo administrador).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { AuthError } from "@/services/agency/auth";
import { addAgencyUser, createResetLinkForUser, resendInvitation, setAgencyAccess, setAgencyUserRole, setAgencyUserStatus } from "@/services/agency/accounts";

export type LinkActionState = { ok?: boolean; error?: string; link?: string; emailSent?: boolean; note?: string };

function message(e: unknown) {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? "Datos no válidos";
  if (e instanceof AuthError) return e.message;
  console.error("[agency-access]", e);
  return "No se ha podido guardar";
}

const refresh = (agencyId: string) => revalidatePath(`/admin/agencies/${agencyId}`);

export async function saveAccessAction(agencyId: string, _prev: LinkActionState, formData: FormData): Promise<LinkActionState> {
  const admin = await requireAdmin();
  try {
    await setAgencyAccess(admin.id, agencyId, { crmAccess: formData.get("crmAccess") === "on", maxListings: formData.get("maxListings"), maxUsers: formData.get("maxUsers") });
    refresh(agencyId);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function addUserAction(agencyId: string, _prev: LinkActionState, formData: FormData): Promise<LinkActionState> {
  const admin = await requireAdmin();
  try {
    const r = await addAgencyUser(admin.id, agencyId, { name: formData.get("name"), email: formData.get("email"), role: formData.get("role") });
    refresh(agencyId);
    return r.email.status === "SENT"
      ? { ok: true, emailSent: true, note: `Invitación enviada a ${r.user.email}.` }
      : { ok: true, link: r.link, note: "El correo no está configurado: envía tú este enlace a la persona (caduca en 72 horas)." };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function resendInviteAction(agencyId: string, userId: string): Promise<LinkActionState> {
  const admin = await requireAdmin();
  try {
    const r = await resendInvitation(admin.id, agencyId, userId);
    return r.email.status === "SENT" ? { ok: true, emailSent: true, note: "Invitación reenviada." } : { ok: true, link: r.link, note: "Correo no configurado: envía tú este enlace (72 horas)." };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function resetLinkAction(agencyId: string, userId: string): Promise<LinkActionState> {
  const admin = await requireAdmin();
  try {
    return { ok: true, link: await createResetLinkForUser(admin.id, agencyId, userId), note: "Enlace para crear una contraseña nueva (caduca en 60 minutos)." };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function userStatusAction(agencyId: string, userId: string, enabled: boolean): Promise<LinkActionState> {
  const admin = await requireAdmin();
  try {
    await setAgencyUserStatus(admin.id, agencyId, userId, enabled);
    refresh(agencyId);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function userRoleAction(agencyId: string, userId: string, role: "OWNER" | "AGENT"): Promise<LinkActionState> {
  const admin = await requireAdmin();
  try {
    await setAgencyUserRole(admin.id, agencyId, userId, role === "OWNER" ? "OWNER" : "AGENT");
    refresh(agencyId);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}
