import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { CatastroError, searchStreets } from "@/services/study/sources/catastro";

export const dynamic = "force-dynamic";

/** Búsqueda de calles del municipio en el callejero del Catastro. ?municipio=28079&q=alcala */
export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request, "catastro-calles"), 60, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Demasiadas consultas. Inténtalo en un minuto." }, { status: 429 });
  const params = new URL(request.url).searchParams;
  const municipio = params.get("municipio") ?? "";
  const q = (params.get("q") ?? "").slice(0, 80);
  if (!/^\d{5}$/.test(municipio)) return NextResponse.json({ error: "Selecciona antes el municipio." }, { status: 400 });
  try {
    return NextResponse.json({ streets: await searchStreets(municipio, q) });
  } catch (error) {
    if (!(error instanceof CatastroError)) console.error("[catastro/calles]", (error as Error).message);
    const message = error instanceof CatastroError ? error.message : "El Catastro no responde en este momento. Vuelve a intentarlo en unos segundos o rellena los datos de la vivienda a mano.";
    return NextResponse.json({ error: message }, { status: error instanceof CatastroError ? 400 : 503 });
  }
}
