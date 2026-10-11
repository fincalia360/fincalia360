// Formulario de contacto: guarda el mensaje para el administrador.
import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { ContactError, submitContactMessage } from "@/services/contactMessages";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "contacto"), 5, 60 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Has enviado varios mensajes seguidos. Inténtalo de nuevo más tarde." }, { status: 429 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  try {
    await submitContactMessage(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ContactError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[contacto]", (e as Error).message);
    return NextResponse.json({ error: "No se ha podido enviar el mensaje. Inténtalo de nuevo." }, { status: 500 });
  }
}
