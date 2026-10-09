import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { submitStudyRequest } from "@/services/crm/requests";
import { cookieName } from "@/services/study/access";

export const dynamic = "force-dynamic";

/** Solicitud desde la pantalla final del estudio (vender, alquilar, asesoramiento o envío del informe). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(clientKey(request, "estudio-contacto"), 5, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Has enviado varias solicitudes seguidas. Espera un minuto y vuelve a intentarlo." }, { status: 429 });
  const { id } = await params;
  const token = (await cookies()).get(cookieName(id))?.value;
  try {
    const body = await request.json().catch(() => null);
    const result = await submitStudyRequest(id, token, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, ownerEmail: result.ownerEmail, existingContact: result.existingContact });
  } catch (error) {
    // Sin datos personales en el registro de errores
    console.error("[estudio] error al registrar la solicitud:", (error as Error).message);
    return NextResponse.json({ error: "No hemos podido registrar tu solicitud. Inténtalo de nuevo en unos minutos." }, { status: 500 });
  }
}
