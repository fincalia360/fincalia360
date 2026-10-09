export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatEUR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${formatNumber(value * 100, digits)} %`;
}

export function formatDate(date: Date | string, locale = "es-ES"): string {
  return new Date(date).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(date: Date | string, locale = "es-ES"): string {
  return new Date(date).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function parseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function csv(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function pick<T>(items: readonly T[], rand: () => number = Math.random): T {
  return items[Math.floor(rand() * items.length)];
}

/** Normaliza texto para el NLU por reglas: minúsculas, sin acentos, sin signos. */
export function normalizeText(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/²/g, "2")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}
