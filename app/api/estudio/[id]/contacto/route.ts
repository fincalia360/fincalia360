import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { cookieName } from "@/services/study/access";
import { requestProfessionalValuation } from "@/services/study/studyService";

export const dynamic = "force-dynamic";

/** Solicitud de valoración profesional: crea el contacto en el CRM (Lead) con consentimiento. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(clientKey(request, "estudio-contacto"), 5, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  const { id } = await params;
  const token = (await cookies()).get(cookieName(id))?.value;
  try {
    const result = await requestProfessionalValuation(id, token, await request.json());
    if (!result.ok) return NextResponse.json({ error: "Estudio no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Revisa los datos de contacto", issues: error.flatten() }, { status: 400 });
    console.error("[estudio] error en contacto:", error);
    return NextResponse.json({ error: "No hemos podido registrar tu solicitud." }, { status: 500 });
  }
}
