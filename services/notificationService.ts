// Eventos de negocio: se guardan en Event (timeline) y se notifican vía NotificationProvider.
import { prisma } from "@/db/client";
import type { BusinessEventType } from "@/types";
import { getNotificationProvider, type NotificationMessage } from "./notifications";

export interface EmitOptions {
  leadId?: string | null;
  payload?: Record<string, unknown>;
  notification?: Omit<NotificationMessage, "type" | "leadId">;
  createdAt?: Date;
}

export async function emitBusinessEvent(type: BusinessEventType, options: EmitOptions = {}) {
  let delivery: Record<string, unknown> | undefined;
  if (options.notification) {
    try {
      const result = await getNotificationProvider().send({ ...options.notification, type, leadId: options.leadId });
      delivery = {
        ...result,
        audience: options.notification.audience,
        to: options.notification.to,
        subject: options.notification.subject,
      };
    } catch (error) {
      delivery = { delivered: false, error: (error as Error).message };
    }
  }

  return prisma.event.create({
    data: {
      type,
      category: "BUSINESS",
      leadId: options.leadId ?? null,
      createdAt: options.createdAt,
      payload: JSON.stringify({ ...(options.payload ?? {}), ...(delivery ? { notification: delivery } : {}) }),
    },
  });
}

export async function listBusinessEvents(limit = 20) {
  return prisma.event.findMany({
    where: { category: "BUSINESS" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { lead: { select: { id: true, name: true } } },
  });
}
