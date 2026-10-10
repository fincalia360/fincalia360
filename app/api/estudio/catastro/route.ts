import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { CatastroError, lookupCadastralReference } from "@/services/study/sources/catastro";

export const dynamic = "force-dynamic";

/** Datos no protegidos del Catastro (uso, superficie, año) para autocompletar el formulario. */
export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request, "catastro"), 20, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Demasiadas consultas. Inténtalo en un minuto." }, { status: 429 });
  const rc = new URL(request.url).searchParams.get("rc") ?? "";
  try {
    return NextResponse.json(await lookupCadastralReference(rc));
  } catch (error) {
    if (!(error instanceof CatastroError)) console.error("[catastro/catastro]", (error as Error).message);
    const message = error instanceof CatastroError ? error.message : "El Catastro no responde en este momento. Vuelve a intentarlo en unos segundos o rellena los datos de la vivienda a mano.";
    return NextResponse.json({ error: message }, { status: error instanceof CatastroError ? 400 : 503 });
  }
}
