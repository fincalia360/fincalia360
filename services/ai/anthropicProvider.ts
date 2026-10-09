import type { AgentTurnInput, AgentTurnOutput, AIProvider } from "./types";
import { buildSystemPrompt } from "./prompt";

/**
 * Adapter FUTURO para Anthropic (Claude). No se usa en el MVP (AI_PROVIDER=demo).
 *
 * TODO: integrate Anthropic
 *  1. npm install @anthropic-ai/sdk
 *  2. Definir ANTHROPIC_API_KEY y AI_PROVIDER=anthropic en .env
 *  3. client.messages.create({ model, system: buildSystemPrompt(input), messages: historial })
 *     pidiendo salida JSON (o tool use con un esquema) y validarla con Zod.
 *  4. Mantener DemoAIProvider como fallback si la API falla.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  constructor(private readonly apiKey = process.env.ANTHROPIC_API_KEY) {}

  async generateReply(input: AgentTurnInput): Promise<AgentTurnOutput> {
    if (!this.apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");
    void buildSystemPrompt(input);
    throw new Error("AnthropicProvider aún no implementado (TODO: integrate Anthropic)");
  }
}
