import { DemoNotificationProvider } from "./demoNotificationProvider";
import { EmailNotificationProvider } from "./emailNotificationProvider";
import type { NotificationProvider } from "./types";

export type { NotificationMessage, NotificationProvider, NotificationResult } from "./types";

export function getNotificationProvider(): NotificationProvider {
  switch (process.env.NOTIFICATION_PROVIDER) {
    case "email":
      return new EmailNotificationProvider();
    // TODO: case "whatsapp": WhatsApp Business API (ver services/whatsapp)
    default:
      return new DemoNotificationProvider();
  }
}
