import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { exportStudiesCsv } from "@/services/study/adminStudyService";

export const dynamic = "force-dynamic";

/** Exportación CSV de datos autorizados (protegida por middleware + requireAdmin). */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const csv = await exportStudiesCsv();
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="estudios-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
