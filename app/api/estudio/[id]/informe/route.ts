import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { cookieName } from "@/services/study/access";
import { trackEvent } from "@/services/analyticsService";
import { renderStudyPdf } from "@/services/study/report/pdf";
import { getStudyForOwner, saveAssumptions, saveReportClientName } from "@/services/study/studyService";
import { HORIZONS } from "@/services/study/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  horizon: z.coerce.number().refine((h) => (HORIZONS as readonly number[]).includes(h)),
  // Se valida campo a campo en saveAssumptions (elecciones de texto, importes o null = desconocido)
  assumptions: z.record(z.unknown()).optional(),
  // Nombre para la portada (opcional). Se guarda solo en este estudio.
  clientName: z.string().max(120).optional(),
});

/** Genera el informe PDF con las hipótesis actuales (solo el propietario del estudio). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get(cookieName(id))?.value;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Petición no válida" }, { status: 400 });
  if (parsed.data.assumptions) {
    let saved;
    try {
      saved = await saveAssumptions(id, token, parsed.data.assumptions);
    } catch {
      return NextResponse.json({ error: "Hipótesis no válidas" }, { status: 400 });
    }
    if (!saved) return NextResponse.json({ error: "Estudio no encontrado" }, { status: 404 });
  }
  if (parsed.data.clientName !== undefined) {
    const ok = await saveReportClientName(id, token, parsed.data.clientName);
    if (!ok) return NextResponse.json({ error: "Estudio no encontrado" }, { status: 404 });
  }
  const study = await getStudyForOwner(id, token);
  if (!study) return NextResponse.json({ error: "Estudio no encontrado" }, { status: 404 });
  await trackEvent("report_generated", { payload: { studyId: id, channel: "download" }, leadId: study.leadId ?? null });
  const bytes = await renderStudyPdf({ studyId: id, input: study.input, snapshot: study.snapshot, assumptions: study.assumptions, horizon: parsed.data.horizon, clientName: study.reportClientName });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="estudio-vender-o-alquilar.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
