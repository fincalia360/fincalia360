import { NextResponse } from "next/server";
import { valuationSchema } from "@/lib/validation";
import { createLead } from "@/services/leadService";

/** Crea un lead desde el formulario público. Exige consentimiento de contacto (Zod). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = valuationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos no válidos", issues: parsed.error.flatten() }, { status: 400 });
  }
  const lead = await createLead(parsed.data, { sessionId: parsed.data.sessionId, source: parsed.data.source });
  return NextResponse.json({ id: lead.id, score: lead.score, tier: lead.scoreTier }, { status: 201 });
}
