import { emailConfig } from "@/services/email/emailService";
import { DemoNotificationProvider } from "./demoNotificationProvider";
import { EmailNotificationProvider } from "./emailNotificationProvider";
import type { NotificationProvider } from "./types";

export type { NotificationMessage, NotificationProvider, NotificationResult } from "./types";

/** Correo real si Resend está configurado; si no, solo se registra en el historial (sin simular envíos). */
export function getNotificationProvider(): NotificationProvider {
  if (emailConfig().configured && process.env.NOTIFICATION_PROVIDER !== "demo") return new EmailNotificationProvider();
  return new DemoNotificationProvider();
}
