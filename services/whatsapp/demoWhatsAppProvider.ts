import type { WhatsAppIncomingMessage, WhatsAppOutgoingMessage, WhatsAppProvider } from "./types";

/**
 * Simulación de WhatsApp para el MVP. La conversación se muestra en
 * /agent/[leadId] con aspecto de chat, pero NO sale ningún mensaje.
 * TODO: integrate WhatsApp Business API
 */
export class DemoWhatsAppProvider implements WhatsAppProvider {
  readonly name = "demo-whatsapp";

  async sendMessage(message: WhatsAppOutgoingMessage) {
    console.info(`[demo-whatsapp] -> ${message.to}: ${message.text ?? message.template?.name}`);
    return { id: `demo_${Date.now()}`, simulated: true };
  }

  parseWebhook(body: unknown): WhatsAppIncomingMessage[] {
    // TODO: integrate WhatsApp Business API — mapear entry[].changes[].value.messages[]
    void body;
    return [];
  }
}
