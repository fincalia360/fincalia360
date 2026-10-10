import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cookieName } from "@/services/study/access";
import { renderMap, type MapKind } from "@/services/study/maps";
import { studyGeo } from "@/services/study/geoLookup";
import { getStudyForOwner } from "@/services/study/studyService";

export const dynamic = "force-dynamic";

const KINDS: MapKind[] = ["zona", "ortofoto", "parcela"];

/** Plano de la vivienda (solo para quien creó el estudio). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; tipo: string }> }) {
  const { id, tipo } = await params;
  if (!KINDS.includes(tipo as MapKind)) return new NextResponse("No encontrado", { status: 404 });
  const study = await getStudyForOwner(id, (await cookies()).get(cookieName(id))?.value);
  if (!study) return new NextResponse("No encontrado", { status: 404 });
  const geo = await studyGeo(study.input, study.snapshot);
  if (!geo) return new NextResponse("Sin ubicación catastral", { status: 404 });
  try {
    const png = await renderMap(geo, tipo as MapKind);
    return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" } });
  } catch (error) {
    console.error("[mapa]", (error as Error).message);
    return new NextResponse("No se ha podido generar el plano", { status: 503 });
  }
}
