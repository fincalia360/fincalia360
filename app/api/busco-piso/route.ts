// «Busco comprar»: recibe la solicitud de una persona que busca un inmueble. Queda pendiente de revisión.
import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { SearchRequestError, submitSearchRequest } from "@/services/searchRequests/searchRequests";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "busco-piso"), 5, 60 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Has enviado varias solicitudes seguidas. Inténtalo de nuevo más tarde." }, { status: 429 });
  if (Number(request.headers.get("content-length") ?? 0) > 32_000) return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "No se ha podido leer el formulario" }, { status: 400 });
  try {
    const created = await submitSearchRequest(body);
    return NextResponse.json({ ok: true, reference: created.reference });
  } catch (e) {
    if (e instanceof SearchRequestError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[busco-piso]", (e as Error).message);
    return NextResponse.json({ error: "No se ha podido enviar la solicitud. Inténtalo de nuevo." }, { status: 500 });
  }
}
