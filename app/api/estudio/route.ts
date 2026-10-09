import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { cookieName, cookieOptions } from "@/services/study/access";
import { createStudy } from "@/services/study/studyService";

export const dynamic = "force-dynamic";

/** Crea un estudio. No requiere datos personales ni consentimiento comercial. */
export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "estudio"), 10, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Demasiadas solicitudes. Inténtalo en un minuto." }, { status: 429 });
  try {
    const body = await request.json();
    const { id, token } = await createStudy(body);
    const res = NextResponse.json({ id }, { status: 201 });
    res.cookies.set(cookieName(id), token, cookieOptions());
    return res;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Revisa los datos del formulario", issues: error.flatten() }, { status: 400 });
    }
    console.error("[estudio] error al crear:", error);
    return NextResponse.json({ error: "No hemos podido generar el estudio. Inténtalo de nuevo." }, { status: 500 });
  }
}
