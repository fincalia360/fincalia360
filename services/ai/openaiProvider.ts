import type { AgentTurnInput, AgentTurnOutput, AIProvider } from "./types";
import { buildSystemPrompt } from "./prompt";

/**
 * Adapter FUTURO para OpenAI. No se usa en el MVP (AI_PROVIDER=demo).
 *
 * TODO: integrate OpenAI
 *  1. npm install openai
 *  2. Definir OPENAI_API_KEY y AI_PROVIDER=openai en .env
 *  3. Llamar a chat.completions / responses con `response_format: { type: "json_object" }`
 *     usando buildSystemPrompt(input) + historial, y validar la salida con Zod.
 *  4. Mantener DemoAIProvider como fallback si la API falla.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  constructor(private readonly apiKey = process.env.OPENAI_API_KEY) {}

  async generateReply(input: AgentTurnInput): Promise<AgentTurnOutput> {
    if (!this.apiKey) throw new Error("OPENAI_API_KEY no configurada");
    void buildSystemPrompt(input);
    throw new Error("OpenAIProvider aún no implementado (TODO: integrate OpenAI)");
  }
}
