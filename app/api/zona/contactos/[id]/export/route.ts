import { NextResponse } from "next/server";
import { getAgencySession } from "@/services/agency/auth";
import { CrmError, exportContact } from "@/services/agency/crm";

/** Derecho de acceso/portabilidad: todos los datos de un contacto de la inmobiliaria (JSON). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getAgencySession();
  if (!s) return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });
  try {
    const data = await exportContact(s, (await params).id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="contacto.json"', "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof CrmError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
