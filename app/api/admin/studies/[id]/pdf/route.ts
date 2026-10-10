import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStudyAdmin } from "@/services/study/adminStudyService";
import { renderStudyPdf } from "@/services/study/report/pdf";

export const dynamic = "force-dynamic";

/** Informe PDF de un estudio para el equipo (con las últimas hipótesis guardadas por el propietario). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const study = await getStudyAdmin(id);
  if (!study) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const bytes = await renderStudyPdf({ studyId: id, input: study.input, snapshot: study.snapshot, assumptions: study.assumptions, horizon: study.input.owner.horizon, clientName: study.reportClientName });
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="estudio-${id.slice(-8)}.pdf"`, "Cache-Control": "no-store" },
  });
}
