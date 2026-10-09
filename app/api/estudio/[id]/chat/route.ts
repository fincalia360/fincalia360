import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { claudeConfigured } from "@/services/ai/claudeClient";
import { cookieName } from "@/services/study/access";
import { answerStudyChat, chatSchema } from "@/services/study/chatAssistant";
import { chatDemoEnabled, demoAnswer } from "@/services/study/chatDemo";
import { prisma } from "@/db/client";
import { verifyToken } from "@/services/study/access";

export const dynamic = "force-dynamic";

/** Asistente virtual del estudio. Solo para el propietario del estudio (cookie de acceso). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const demo = chatDemoEnabled();
  if (!claudeConfigured() && !demo) return NextResponse.json({ error: "El asistente no está configurado." }, { status: 503 });
  const limited = rateLimit(clientKey(request, "estudio-chat"), 12, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Vas muy rápido: espera unos segundos antes de enviar otro mensaje." }, { status: 429 });
  const { id } = await params;
  const token = (await cookies()).get(cookieName(id))?.value;
  try {
    const body = await request.json().catch(() => null);
    if (demo) {
      // Modo demostración local: respuestas de ejemplo por plantillas (no es la IA)
      const study = await prisma.study.findUnique({ where: { id }, select: { tokenHash: true } });
      if (!study || !verifyToken(token, study.tokenHash)) return NextResponse.json({ error: "Estudio no encontrado" }, { status: 404 });
      const parsed = chatSchema.safeParse(body);
      const last = parsed.success ? parsed.data.messages[parsed.data.messages.length - 1] : null;
      if (!last || last.role !== "user") return NextResponse.json({ error: "Mensaje no válido" }, { status: 400 });
      return NextResponse.json({ ...(await demoAnswer(id, last.content)), demo: true });
    }
    const result = await answerStudyChat(id, token, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ text: result.text, actions: result.actions });
  } catch (error) {
    // Sin el contenido del mensaje en el registro (puede contener datos personales)
    console.error("[estudio] error del asistente:", (error as Error).message);
    return NextResponse.json({ error: "El asistente no ha podido responder. Inténtalo de nuevo en unos segundos." }, { status: 502 });
  }
}
