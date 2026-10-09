import type { NotificationMessage, NotificationProvider, NotificationResult } from "./types";

/**
 * Proveedor DEMO: no envía nada. Escribe en consola; notificationService deja
 * constancia en el timeline (tabla Event).
 */
export class DemoNotificationProvider implements NotificationProvider {
  readonly name = "demo";

  async send(message: NotificationMessage): Promise<NotificationResult> {
    console.info(`[demo-notification] (${message.audience}) ${message.to ?? ""} -> ${message.subject}`);
    return { delivered: false, channel: "demo", info: "Simulado: no se ha enviado ningún mensaje real" };
  }
}
