import { DemoWhatsAppProvider } from "./demoWhatsAppProvider";
import type { WhatsAppProvider } from "./types";

export type { WhatsAppProvider, WhatsAppOutgoingMessage, WhatsAppIncomingMessage } from "./types";

export function getWhatsAppProvider(): WhatsAppProvider {
  // TODO: integrate WhatsApp Business API (p. ej. WHATSAPP_PROVIDER=cloud-api)
  return new DemoWhatsAppProvider();
}
