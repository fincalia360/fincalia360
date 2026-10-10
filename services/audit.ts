// Registro de acciones sensibles (quién publicó, quién creó una cuenta, quién exportó…).
// No guarda datos personales en «detail»: solo identificadores y cambios de estado.
import { prisma } from "@/db/client";

export type Actor = { type: "ADMIN"; id: string } | { type: "AGENCY_USER"; id: string; agencyId: string } | { type: "SYSTEM" | "PUBLIC"; id?: string };

export async function audit(actor: Actor, action: string, entity: string, entityId?: string | null, detail?: string | null, agencyId?: string | null) {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: actor.type,
        actorId: "id" in actor ? (actor.id ?? null) : null,
        agencyId: agencyId ?? (actor.type === "AGENCY_USER" ? actor.agencyId : null),
        action,
        entity,
        entityId: entityId ?? null,
        detail: detail?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] No se pudo registrar la acción", action, (error as Error).message);
  }
}
