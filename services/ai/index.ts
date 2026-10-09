import { AnthropicProvider } from "./anthropicProvider";
import { DemoAIProvider } from "./demoAIProvider";
import { OpenAIProvider } from "./openaiProvider";
import type { AgentTurnInput, AgentTurnOutput, AIProvider } from "./types";

export * from "./types";
export { DemoAIProvider } from "./demoAIProvider";

/**
 * Devuelve el proveedor configurado en AI_PROVIDER. Si un proveedor LLM falla
 * (no configurado, error de red...), se hace fallback al agente DEMO para que
 * la conversación nunca se rompa.
 */
export function getAIProvider(): AIProvider {
  const configured = process.env.AI_PROVIDER ?? "demo";
  const demo = new DemoAIProvider();
  let primary: AIProvider | null = null;
  if (configured === "openai") primary = new OpenAIProvider();
  if (configured === "anthropic") primary = new AnthropicProvider();
  if (!primary) return demo;

  const llm = primary;
  return {
    name: `${llm.name}+fallback`,
    async generateReply(input: AgentTurnInput): Promise<AgentTurnOutput> {
      try {
        return await llm.generateReply(input);
      } catch (error) {
        console.warn(`[ai] ${llm.name} no disponible, usando DemoAIProvider:`, (error as Error).message);
        return demo.generateReply(input);
      }
    },
  };
}
