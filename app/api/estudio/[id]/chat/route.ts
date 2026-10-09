import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { claudeConfigured } from "@/services/ai/claudeClient";
import { cookieName } from "@/services/study/access";
import { answerStudyChat } from "@/services/study/chatAssistant";

export const dynamic = "force-dynamic";

/** Asistente virtual del estudio. Solo para el propietario del estudio (cookie de acceso). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!claudeConfigured()) return NextResponse.json({ error: "El asistente no está configurado." }, { status: 503 });
  const limited = rateLimit(clientKey(request, "estudio-chat"), 12, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Vas muy rápido: espera unos segundos antes de enviar otro mensaje." }, { status: 429 });
  const { id } = await params;
  const token = (await cookies()).get(cookieName(id))?.value;
  try {
    const result = await answerStudyChat(id, token, await request.json().catch(() => null));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ text: result.text, actions: result.actions });
  } catch (error) {
    // Sin el contenido del mensaje en el registro (puede contener datos personales)
    console.error("[estudio] error del asistente:", (error as Error).message);
    return NextResponse.json({ error: "El asistente no ha podido responder. Inténtalo de nuevo en unos segundos." }, { status: 502 });
  }
}
