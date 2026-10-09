// Cliente mínimo de la API de mensajes de Anthropic (Claude), sin dependencias.
// Variables: ANTHROPIC_API_KEY (obligatoria), ANTHROPIC_MODEL (por defecto claude-haiku-5-5).
// Si falta la clave, el asistente no se muestra: nunca se simulan respuestas.

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function claudeModel() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-5-5";
}

export async function claudeReply(params: { system: string; messages: ChatTurn[]; maxTokens?: number }): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY no configurada");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: claudeModel(), max_tokens: params.maxTokens ?? 700, system: params.system, messages: params.messages }),
    signal: AbortSignal.timeout(30000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(data.error?.message ?? `Claude API HTTP ${res.status}`);
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
  if (!text) throw new Error("Respuesta vacía del modelo");
  return { text, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
}
