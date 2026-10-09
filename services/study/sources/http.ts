// Descarga de fuentes oficiales con timeout y caché en base de datos (tabla OfficialDataCache).
// Si la fuente falla, se usa la última copia guardada marcada como "STALE".
import { prisma } from "@/db/client";

const UA = "Mozilla/5.0 (compatible; Fincalia360Estudio/0.1; +https://example.com)";

export interface CachedResult<T> {
  data: T;
  fetchedAt: Date;
  stale: boolean;
}

export async function fetchWithTimeout(url: string, timeoutMs = 15000, accept = "application/json") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": UA, Accept: accept }, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${new URL(url).host}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function cachedFetch<T>(
  key: string,
  source: string,
  loader: () => Promise<T>,
  ttlHours = 24 * 7,
): Promise<CachedResult<T>> {
  const cached = await prisma.officialDataCache.findUnique({ where: { key } }).catch(() => null);
  if (cached && Date.now() - cached.fetchedAt.getTime() < ttlHours * 3600 * 1000) {
    return { data: JSON.parse(cached.payload) as T, fetchedAt: cached.fetchedAt, stale: false };
  }
  try {
    const data = await loader();
    const payload = JSON.stringify(data);
    const fetchedAt = new Date();
    await prisma.officialDataCache.upsert({
      where: { key },
      update: { payload, source, fetchedAt },
      create: { key, payload, source, fetchedAt },
    });
    return { data, fetchedAt, stale: false };
  } catch (error) {
    if (cached) return { data: JSON.parse(cached.payload) as T, fetchedAt: cached.fetchedAt, stale: true };
    throw error;
  }
}

export async function fetchJson<T>(url: string, timeoutMs?: number): Promise<T> {
  const res = await fetchWithTimeout(url, timeoutMs);
  return (await res.json()) as T;
}
