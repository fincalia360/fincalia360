import { NextResponse } from "next/server";
import { z } from "zod";
import { agentMessageSchema } from "@/lib/validation";
import { bookFromAgent, getConversationView, resetConversation, sendMessage } from "@/services/agentService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ leadId: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { leadId } = await params;
  try {
    return NextResponse.json(await getConversationView(leadId));
  } catch {
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("message") }).merge(agentMessageSchema),
  z.object({ action: z.literal("book"), slot: z.string().min(10) }),
  z.object({ action: z.literal("reset") }),
]);

export async function POST(request: Request, { params }: Ctx) {
  const { leadId } = await params;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Petición no válida" }, { status: 400 });
  try {
    const body = parsed.data;
    if (body.action === "message") return NextResponse.json(await sendMessage(leadId, { text: body.text, value: body.value }));
    if (body.action === "book") return NextResponse.json(await bookFromAgent(leadId, body.slot));
    return NextResponse.json(await resetConversation(leadId));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo procesar el mensaje" }, { status: 500 });
  }
}
