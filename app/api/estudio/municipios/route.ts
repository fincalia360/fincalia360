import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { getProvince, ineToCommonName } from "@/services/study/geo";
import { listMunicipalities } from "@/services/study/sources/ine";

export const dynamic = "force-dynamic";

/** Municipios oficiales (INE) de una provincia, para el selector del formulario. */
export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request, "municipios"), 60, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });
  const province = new URL(request.url).searchParams.get("provincia") ?? "";
  if (!getProvince(province)) return NextResponse.json({ error: "Provincia no válida" }, { status: 400 });
  try {
    const { municipalities, tableId, fetchedAt, stale } = await listMunicipalities(province);
    return NextResponse.json({
      municipalities: municipalities.map((m) => ({ name: ineToCommonName(m.name), ineName: m.name, code: m.code, ineValueId: m.ineValueId, population: m.population, year: m.year })),
      source: { name: `INE · tabla ${tableId}`, retrievedAt: fetchedAt, stale },
    });
  } catch (error) {
    return NextResponse.json({ error: "No se pudo consultar el INE", detail: (error as Error).message }, { status: 503 });
  }
}
