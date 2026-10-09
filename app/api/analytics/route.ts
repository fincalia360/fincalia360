import { NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { isAnalyticsEvent, trackEvent } from "@/services/analyticsService";

const schema = z.object({
  type: z.string(),
  leadId: z.string().max(40).optional(),
  sessionId: z.string().max(64).optional(),
  payload: z.record(z.unknown()).refine((p) => JSON.stringify(p).length <= 500, "payload demasiado grande").optional(),
});

// Solo eventos de navegación; los de negocio (estudio completado, informe, solicitudes) se registran en el servidor.
const CLIENT_EVENTS = new Set(["landing_view", "valuation_started", "appointment_started", "study_started", "final_screen_view", "request_form_started"]);

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "analytics"), 120, 60_000);
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isAnalyticsEvent(parsed.data.type) || !CLIENT_EVENTS.has(parsed.data.type)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await trackEvent(parsed.data.type, {
    leadId: parsed.data.leadId,
    sessionId: parsed.data.sessionId,
    payload: parsed.data.payload,
  });
  return NextResponse.json({ ok: true });
}
