import type { ExtractedData, Language } from "@/types";

/** Pasos del guion de cualificación. Un LLM puede usar los mismos pasos como "slots". */
export const AGENT_STEPS = [
  "CONFIRM_INTEREST",
  "LOCATION",
  "PROPERTY_TYPE",
  "MOTIVATION",
  "TIMELINE",
  "SITUATION",
  "DETAILS",
  "FEATURES",
  "AGENCY_INTEREST",
  "OFFER_APPOINTMENT",
  "SLOTS",
  "PREFERRED_CONTACT",
  "BOOKED",
  "CLOSED",
] as const;
export type AgentStep = (typeof AGENT_STEPS)[number];

export interface ConversationState {
  /** Paso cuya pregunta está pendiente de respuesta. */
  step: AgentStep;
  /** Pasos ya cubiertos (preguntados o respondidos espontáneamente). */
  covered: AgentStep[];
  /** Reintentos en el paso actual (para no entrar en bucle). */
  attempts: number;
  turn: number;
}

export interface QuickReply {
  label: string;
  /** Valor estructurado "PASO:VALOR". Evita depender del NLU cuando el usuario pulsa un botón. */
  value: string;
}

export interface AgentTurnInput {
  language: Language;
  leadName: string;
  state: ConversationState | null; // null = iniciar conversación
  /** Lo que ya sabemos del lead (formulario + turnos anteriores). */
  known: ExtractedData;
  userMessage: { text: string; value?: string } | null;
}

export type AgentAction = "NONE" | "SHOW_SLOTS" | "COMPLETE";

export interface AgentTurnOutput {
  reply: string;
  quickReplies: QuickReply[];
  action: AgentAction;
  nextState: ConversationState;
  /** Datos nuevos detectados en este turno (se fusionan con `known`). */
  extracted: Partial<ExtractedData>;
}

/**
 * Contrato del agente conversacional. El MVP usa DemoAIProvider (reglas + estado).
 * Para usar un LLM basta con implementar esta interfaz (ver openaiProvider / anthropicProvider).
 */
export interface AIProvider {
  readonly name: string;
  generateReply(input: AgentTurnInput): Promise<AgentTurnOutput>;
}
