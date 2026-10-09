import { NextResponse } from "next/server";
import { z } from "zod";
import { isAnalyticsEvent, trackEvent } from "@/services/analyticsService";

const schema = z.object({
  type: z.string(),
  leadId: z.string().max(40).optional(),
  sessionId: z.string().max(64).optional(),
  payload: z.record(z.unknown()).optional(),
});

// Sólo se aceptan desde el cliente los eventos de navegación; el resto los registra el servidor.
const CLIENT_EVENTS = new Set(["landing_view", "valuation_started", "appointment_started"]);

export async function POST(request: Request) {
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
