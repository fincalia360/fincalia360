export interface WhatsAppOutgoingMessage {
  to: string; // teléfono E.164
  text?: string;
  /** Plantilla aprobada por Meta (obligatoria para iniciar conversación fuera de la ventana de 24 h). */
  template?: { name: string; language: string; variables?: string[] };
}

export interface WhatsAppIncomingMessage {
  from: string;
  text: string;
  receivedAt: Date;
}

/**
 * Contrato del canal WhatsApp.
 * TODO: integrate WhatsApp Business API (Cloud API de Meta o un BSP como Twilio / 360dialog).
 */
export interface WhatsAppProvider {
  readonly name: string;
  sendMessage(message: WhatsAppOutgoingMessage): Promise<{ id: string; simulated: boolean }>;
  /** Normaliza el payload del webhook entrante. */
  parseWebhook(body: unknown): WhatsAppIncomingMessage[];
}
