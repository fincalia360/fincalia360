import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { CatastroError, findUnitsByAddress } from "@/services/study/sources/catastro";

export const dynamic = "force-dynamic";

/** Inmuebles de una dirección (vía + número). ?municipio=28079&tipo=CL&via=ALCALA&numero=100 */
export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request, "catastro-inmuebles"), 30, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Demasiadas consultas. Inténtalo en un minuto." }, { status: 429 });
  const p = new URL(request.url).searchParams;
  const municipio = p.get("municipio") ?? "";
  const tipo = (p.get("tipo") ?? "").slice(0, 5);
  const via = (p.get("via") ?? "").slice(0, 100);
  const numero = p.get("numero") ?? "";
  if (!/^\d{5}$/.test(municipio) || !/^[A-Z]{1,5}$/.test(tipo) || !via) {
    return NextResponse.json({ error: "Elige la calle de la lista." }, { status: 400 });
  }
  try {
    return NextResponse.json(await findUnitsByAddress(municipio, tipo, via, numero));
  } catch (error) {
    if (!(error instanceof CatastroError)) console.error("[catastro/inmuebles]", (error as Error).message);
    const message = error instanceof CatastroError ? error.message : "El Catastro no responde en este momento. Vuelve a intentarlo en unos segundos o rellena los datos de la vivienda a mano.";
    return NextResponse.json({ error: message }, { status: error instanceof CatastroError ? 400 : 503 });
  }
}
