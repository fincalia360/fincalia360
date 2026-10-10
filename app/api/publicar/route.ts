// «Publica tu vivienda gratis»: recibe la solicitud del propietario (datos + fotos).
import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { MAX_REQUEST_BODY_BYTES, PublicationRequestError, submitPublicationRequest } from "@/services/listings/publicationRequests";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "publicar"), 5, 60 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Has enviado varias solicitudes seguidas. Inténtalo de nuevo más tarde." }, { status: 429 });
  // El navegador reduce las fotos antes de enviarlas; el servidor no admite envíos de más de 10 MB
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_REQUEST_BODY_BYTES) return NextResponse.json({ error: "Las fotos ocupan demasiado: envía menos fotos" }, { status: 413 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "No se ha podido leer el formulario" }, { status: 400 });
  const fields: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && k !== "photos") fields[k] = v;
  const files = form.getAll("photos").filter((f): f is File => typeof f !== "string" && f.size > 0);
  try {
    const photos = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
    await submitPublicationRequest(fields, photos);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof PublicationRequestError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[publicar]", (e as Error).message);
    return NextResponse.json({ error: "No se ha podido enviar la solicitud. Inténtalo de nuevo." }, { status: 500 });
  }
}
