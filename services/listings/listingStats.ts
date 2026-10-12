// Visitas y veces compartido de cada anuncio. Estadística propia y anónima:
// - Se guarda en la tabla de eventos existente (categoría LISTING): no hace falta ninguna tabla nueva.
// - Sin cookies ni datos personales: no se guarda la IP ni nada que identifique al visitante.
// - Una visita por pestaña y anuncio cada 30 minutos (no cuenta las recargas) y no cuenta robots.
import { prisma } from "@/db/client";

export const SHARE_CHANNELS = ["whatsapp", "facebook", "x", "email", "copy", "native"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|headless|lighthouse/i;
const DEDUPE_MS = 30 * 60_000;

export function isBot(userAgent: string | null | undefined) {
  return !userAgent || BOT.test(userAgent);
}

/** Registra una visita o un «compartir». Devuelve false si no se cuenta (robot, repetida o anuncio no público). */
export async function recordListingEvent(input: { listingId: string; kind: "view" | "share"; channel?: ShareChannel; sessionId?: string | null; userAgent?: string | null }) {
  if (isBot(input.userAgent)) return false;
  const listing = await prisma.listing.findFirst({ where: { id: input.listingId, status: { in: ["PUBLISHED", "RESERVED"] } }, select: { id: true } });
  if (!listing) return false;
  const type = input.kind === "view" ? "listing_view" : "listing_share";
  if (input.kind === "view" && input.sessionId) {
    const recent = await prisma.event.findFirst({
      where: { category: "LISTING", type, sessionId: input.sessionId, payload: { contains: `"listingId":"${listing.id}"` }, createdAt: { gte: new Date(Date.now() - DEDUPE_MS) } },
      select: { id: true },
    });
    if (recent) return false;
  }
  await prisma.event.create({
    data: {
      type,
      category: "LISTING",
      sessionId: input.sessionId ?? null,
      payload: JSON.stringify(input.kind === "share" ? { listingId: listing.id, channel: input.channel ?? "native" } : { listingId: listing.id }),
    },
  });
  return true;
}

export interface ListingCounts {
  views: number;
  views30: number;
  shares: number;
}

function parse(payload: string | null): { listingId?: string; channel?: string } {
  try {
    return payload ? JSON.parse(payload) : {};
  } catch {
    return {};
  }
}

/** Visitas totales, de los últimos 30 días y veces compartido de varios anuncios (para la lista del panel). */
export async function listingCounts(listingIds: string[]): Promise<Record<string, ListingCounts>> {
  const out: Record<string, ListingCounts> = Object.fromEntries(listingIds.map((id) => [id, { views: 0, views30: 0, shares: 0 }]));
  if (!listingIds.length) return out;
  const since30 = Date.now() - 30 * 24 * 3600 * 1000;
  const rows = await prisma.event.findMany({ where: { category: "LISTING" }, select: { type: true, payload: true, createdAt: true } });
  for (const r of rows) {
    const id = parse(r.payload).listingId;
    if (!id || !out[id]) continue;
    if (r.type === "listing_view") {
      out[id].views++;
      if (r.createdAt.getTime() >= since30) out[id].views30++;
    } else if (r.type === "listing_share") out[id].shares++;
  }
  return out;
}

/** Detalle de un anuncio: visitas por periodo, por día (últimos 30) y veces compartido por canal. */
export async function listingStatsDetail(listingId: string) {
  const rows = await prisma.event.findMany({
    where: { category: "LISTING", payload: { contains: `"listingId":"${listingId}"` } },
    select: { type: true, payload: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const views = rows.filter((r) => r.type === "listing_view");
  const shares = rows.filter((r) => r.type === "listing_share");
  const byDay: Array<{ date: string; views: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * day);
    const key = d.toISOString().slice(0, 10);
    byDay.push({ date: key, views: views.filter((v) => v.createdAt.toISOString().slice(0, 10) === key).length });
  }
  const byChannel: Record<string, number> = {};
  for (const s of shares) {
    const c = parse(s.payload).channel ?? "native";
    byChannel[c] = (byChannel[c] ?? 0) + 1;
  }
  return {
    total: views.length,
    last7: views.filter((v) => now - v.createdAt.getTime() <= 7 * day).length,
    last30: views.filter((v) => now - v.createdAt.getTime() <= 30 * day).length,
    first: views[0]?.createdAt ?? null,
    shares: shares.length,
    byChannel,
    byDay,
  };
}
