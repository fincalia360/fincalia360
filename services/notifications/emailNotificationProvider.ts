import type { NotificationMessage, NotificationProvider, NotificationResult } from "./types";

/**
 * TODO: integrate email provider (Resend, SendGrid, Amazon SES, SMTP…).
 * Ver docs/integrations.md. No se usa en el MVP.
 */
export class EmailNotificationProvider implements NotificationProvider {
  readonly name = "email";

  async send(message: NotificationMessage): Promise<NotificationResult> {
    void message;
    throw new Error("EmailNotificationProvider no está configurado (TODO: integrate email provider)");
  }
}
