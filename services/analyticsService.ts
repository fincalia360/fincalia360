import { prisma } from "@/db/client";
import { ANALYTICS_EVENTS, type AnalyticsEventType } from "@/types";

export async function trackEvent(
  type: AnalyticsEventType,
  options: { leadId?: string | null; sessionId?: string | null; payload?: Record<string, unknown>; createdAt?: Date } = {},
) {
  return prisma.event.create({
    data: {
      type,
      category: "ANALYTICS",
      leadId: options.leadId ?? null,
      sessionId: options.sessionId ?? null,
      payload: options.payload ? JSON.stringify(options.payload) : null,
      createdAt: options.createdAt,
    },
  });
}

export function isAnalyticsEvent(value: string): value is AnalyticsEventType {
  return (ANALYTICS_EVENTS as readonly string[]).includes(value);
}

export async function countAnalyticsEvents(since?: Date): Promise<Record<AnalyticsEventType, number>> {
  const rows = await prisma.event.groupBy({
    by: ["type"],
    where: { category: "ANALYTICS", ...(since ? { createdAt: { gte: since } } : {}) },
    _count: { _all: true },
  });
  const result = Object.fromEntries(ANALYTICS_EVENTS.map((e) => [e, 0])) as Record<AnalyticsEventType, number>;
  for (const row of rows) {
    if (isAnalyticsEvent(row.type)) result[row.type] = row._count._all;
  }
  return result;
}

export interface FunnelStep {
  type: AnalyticsEventType;
  count: number;
  /** Conversión respecto al paso anterior. */
  stepRate: number | null;
  /** Conversión respecto al primer paso. */
  totalRate: number | null;
}

export async function getAnalyticsFunnel(since?: Date): Promise<FunnelStep[]> {
  const counts = await countAnalyticsEvents(since);
  const first = counts[ANALYTICS_EVENTS[0]];
  return ANALYTICS_EVENTS.map((type, i) => {
    const prev = i === 0 ? null : counts[ANALYTICS_EVENTS[i - 1]];
    return {
      type,
      count: counts[type],
      stepRate: prev ? counts[type] / prev : null,
      totalRate: first ? counts[type] / first : null,
    };
  });
}

export async function getEventsPerDay(type: AnalyticsEventType, days: number) {
  const since = startOfDay(addDays(new Date(), -(days - 1)));
  const events = await prisma.event.findMany({
    where: { category: "ANALYTICS", type, createdAt: { gte: since } },
    select: { createdAt: true },
  });
  return bucketByDay(
    events.map((e) => e.createdAt),
    days,
  );
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function bucketByDay(dates: Date[], days: number) {
  const today = startOfDay(new Date());
  const buckets = Array.from({ length: days }, (_, i) => {
    const date = addDays(today, -(days - 1 - i));
    return { date, key: dayKey(date), count: 0 };
  });
  const index = new Map(buckets.map((b) => [b.key, b]));
  for (const d of dates) {
    const bucket = index.get(dayKey(d));
    if (bucket) bucket.count++;
  }
  return buckets;
}
