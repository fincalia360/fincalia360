import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { cookieName } from "@/services/study/access";
import { saveAssumptions } from "@/services/study/studyService";

export const dynamic = "force-dynamic";

/** Guarda las hipótesis modificadas por el propietario (solo con su cookie de acceso). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get(cookieName(id))?.value;
  try {
    const saved = await saveAssumptions(id, token, await request.json());
    if (!saved) return NextResponse.json({ error: "Estudio no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Hipótesis no válidas" }, { status: 400 });
    throw error;
  }
}
