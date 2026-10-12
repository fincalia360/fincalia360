// Visitas y «compartir» de los anuncios (estadística propia y anónima, sin cookies ni IP guardada).
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { SHARE_CHANNELS, recordListingEvent } from "@/services/listings/listingStats";

export const dynamic = "force-dynamic";

const schema = z.object({
  listingId: z.string().min(10).max(40),
  kind: z.enum(["view", "share"]),
  channel: z.enum(SHARE_CHANNELS).optional(),
  sessionId: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "listing-stats"), 60, 60_000);
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const counted = await recordListingEvent({ ...parsed.data, userAgent: request.headers.get("user-agent") }).catch(() => false);
  return NextResponse.json({ ok: true, counted });
}
