// Administración de cuentas de inmobiliarias (solo desde el panel del administrador).
// Las cuentas las crea FINCALIA360: no hay registro libre.
import { z } from "zod";
import { prisma } from "@/db/client";
import { audit } from "@/services/audit";
import { AuthError, adminResetLink, normalizeLoginEmail, sendInvitation } from "./auth";
import { deliverAssignment } from "./crm";

export const AGENCY_ROLES = { OWNER: "Responsable", AGENT: "Agente" } as const;
export const AGENCY_USER_STATUSES = { INVITED: "Invitación enviada", ACTIVE: "Activo", DISABLED: "Desactivado" } as const;

export async function setAgencyAccess(adminId: string, agencyId: string, raw: { crmAccess: boolean; maxListings: unknown; maxUsers: unknown }) {
  const maxListings = z.coerce.number().int().min(0).max(10_000).parse(raw.maxListings);
  const maxUsers = z.coerce.number().int().min(1).max(500).parse(raw.maxUsers);
  const agency = await prisma.agency.update({ where: { id: agencyId }, data: { crmAccess: raw.crmAccess, maxListings, maxUsers } });
  if (!raw.crmAccess) {
    // Sin acceso: se cierran todas las sesiones abiertas de la inmobiliaria
    await prisma.agencySession.deleteMany({ where: { user: { agencyId } } });
  } else {
    // Las oportunidades abiertas que ya tenía asignadas pasan a su CRM
    const open = await prisma.partnerAssignment.findMany({ where: { agencyId, status: { in: ["ASSIGNED", "ACCEPTED"] } }, select: { id: true } });
    for (const a of open) await deliverAssignment(a.id);
  }
  await audit({ type: "ADMIN", id: adminId }, raw.crmAccess ? "agency.access_on" : "agency.access_off", "Agency", agencyId, `inmuebles ${maxListings} · usuarios ${maxUsers}`, agencyId);
  return agency;
}

export const newUserSchema = z.object({
  name: z.string().trim().min(2, "Indica el nombre").max(80),
  email: z.string().trim().toLowerCase().email("Email no válido").max(120),
  role: z.enum(["OWNER", "AGENT"]),
});

export async function addAgencyUser(adminId: string, agencyId: string, raw: unknown) {
  const data = newUserSchema.parse(raw);
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId } });
  if (!agency.crmAccess) throw new AuthError("Activa primero el acceso a la Zona inmobiliarias");
  const users = await prisma.agencyUser.count({ where: { agencyId, status: { not: "DISABLED" } } });
  if (users >= agency.maxUsers) throw new AuthError(`Esta inmobiliaria ya tiene ${agency.maxUsers} usuarios (su límite)`);
  const email = normalizeLoginEmail(data.email);
  if (await prisma.agencyUser.findUnique({ where: { email } })) throw new AuthError("Ya existe un usuario con ese email");
  const user = await prisma.agencyUser.create({ data: { agencyId, email, name: data.name, role: data.role, status: "INVITED" } });
  await audit({ type: "ADMIN", id: adminId }, "agency_user.create", "AgencyUser", user.id, data.role, agencyId);
  const invitation = await sendInvitation(user.id);
  return { user, ...invitation };
}

async function userOfAgency(agencyId: string, userId: string) {
  const user = await prisma.agencyUser.findFirst({ where: { id: userId, agencyId } });
  if (!user) throw new AuthError("Usuario no encontrado");
  return user;
}

export async function resendInvitation(adminId: string, agencyId: string, userId: string) {
  const user = await userOfAgency(agencyId, userId);
  if (user.status !== "INVITED") throw new AuthError("Este usuario ya activó su cuenta");
  await audit({ type: "ADMIN", id: adminId }, "agency_user.reinvite", "AgencyUser", user.id, null, agencyId);
  return sendInvitation(user.id);
}

export async function createResetLinkForUser(adminId: string, agencyId: string, userId: string) {
  const user = await userOfAgency(agencyId, userId);
  if (user.status !== "ACTIVE") throw new AuthError("El usuario no está activo");
  await audit({ type: "ADMIN", id: adminId }, "agency_user.reset_link", "AgencyUser", user.id, null, agencyId);
  return adminResetLink(user.id);
}

export async function setAgencyUserStatus(adminId: string, agencyId: string, userId: string, enabled: boolean) {
  const user = await userOfAgency(agencyId, userId);
  if (enabled) {
    const agency = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId } });
    const users = await prisma.agencyUser.count({ where: { agencyId, status: { not: "DISABLED" } } });
    if (users >= agency.maxUsers) throw new AuthError(`Esta inmobiliaria ya tiene ${agency.maxUsers} usuarios (su límite)`);
  }
  await prisma.agencyUser.update({ where: { id: user.id }, data: { status: enabled ? (user.passwordHash ? "ACTIVE" : "INVITED") : "DISABLED" } });
  if (!enabled) await prisma.agencySession.deleteMany({ where: { userId: user.id } });
  await audit({ type: "ADMIN", id: adminId }, enabled ? "agency_user.enable" : "agency_user.disable", "AgencyUser", user.id, null, agencyId);
}

export async function setAgencyUserRole(adminId: string, agencyId: string, userId: string, role: "OWNER" | "AGENT") {
  const user = await userOfAgency(agencyId, userId);
  await prisma.agencyUser.update({ where: { id: user.id }, data: { role } });
  await audit({ type: "ADMIN", id: adminId }, "agency_user.role", "AgencyUser", user.id, role, agencyId);
}

export async function listAgencyUsers(agencyId: string) {
  return prisma.agencyUser.findMany({
    where: { agencyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true, lockedUntil: true },
  });
}
