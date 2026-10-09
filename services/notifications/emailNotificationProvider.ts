import { sendEmail } from "@/services/email/emailService";
import type { NotificationMessage, NotificationProvider, NotificationResult } from "./types";

/** Notificaciones por correo real (Resend). Los avisos internos van a TEAM_NOTIFICATION_EMAIL. */
export class EmailNotificationProvider implements NotificationProvider {
  readonly name = "email";

  async send(message: NotificationMessage): Promise<NotificationResult> {
    const to = message.to ?? (message.audience === "internal" ? process.env.TEAM_NOTIFICATION_EMAIL : undefined);
    if (!to) return { delivered: false, channel: "email", info: "Sin destinatario configurado (TEAM_NOTIFICATION_EMAIL)" };
    const result = await sendEmail({ to, subject: message.subject, text: message.body });
    if (result.status === "SENT") return { delivered: true, channel: "email", info: `Enviado (${result.id})` };
    if (result.status === "NOT_CONFIGURED") return { delivered: false, channel: "email", info: `Correo no configurado: falta ${result.missing.join(", ")}` };
    return { delivered: false, channel: "email", info: `Error al enviar: ${result.error}` };
  }
}
