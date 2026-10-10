import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { submitInquiry } from "@/services/listings/inquiries";

export async function POST(request: Request, { params }: { params: Promise<{ ref: string }> }) {
  const limit = rateLimit(clientKey(request, "inquiry"), 5, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Has enviado varias solicitudes seguidas. Espera unos minutos." }, { status: 429 });
  const ref = (await params).ref.toUpperCase();
  if (!/^F360-[A-Z0-9]{6}$/.test(ref)) return NextResponse.json({ error: "Inmueble no encontrado" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const result = await submitInquiry(ref, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
