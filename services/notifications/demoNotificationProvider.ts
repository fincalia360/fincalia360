import type { NotificationMessage, NotificationProvider, NotificationResult } from "./types";

/**
 * Proveedor DEMO: no envía nada. Escribe en consola; notificationService deja
 * constancia en el timeline (tabla Event).
 */
export class DemoNotificationProvider implements NotificationProvider {
  readonly name = "demo";

  async send(message: NotificationMessage): Promise<NotificationResult> {
    console.info(`[demo-notification] (${message.audience}) ${message.to ?? ""} -> ${message.subject}`);
    return { delivered: false, channel: "ninguno", info: "No enviado: el correo no está configurado (solo queda registrado en el panel)" };
  }
}
