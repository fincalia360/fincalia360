import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { exportContactData } from "@/services/crm/contacts";

export const dynamic = "force-dynamic";

/** Exportación de los datos de un propietario (acceso y portabilidad). Protegida por middleware + requireAdmin. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const data = await exportContactData(id);
  if (!data) return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="datos-contacto-${id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
