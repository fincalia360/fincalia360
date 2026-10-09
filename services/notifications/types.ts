import type { BusinessEventType } from "@/types";

export interface NotificationMessage {
  type: BusinessEventType;
  leadId?: string | null;
  /** Destinatario lógico: equipo interno, inmobiliaria o propietario. */
  audience: "internal" | "agency" | "owner";
  to?: string;
  subject: string;
  body: string;
}

export interface NotificationResult {
  delivered: boolean;
  channel: string;
  info?: string;
}

/**
 * Contrato para cualquier canal de notificación (email, WhatsApp, Slack…).
 * El MVP sólo implementa DemoNotificationProvider.
 */
export interface NotificationProvider {
  readonly name: string;
  send(message: NotificationMessage): Promise<NotificationResult>;
}
