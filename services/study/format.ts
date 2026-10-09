// Formato común de cifras para la web y el PDF (mismas cadenas en ambos).
const EUR = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" } as Intl.NumberFormatOptions);
const PCT = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** "340.000 €" o "—" si el dato no existe (nunca 0 € para un desconocido). */
export function fmtEur(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${EUR.format(Math.round(v)).replace(/ | /g, ".")} €`;
}

export function fmtEurSigned(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v < 0 ? "−" : "+"}${fmtEur(Math.abs(v))}`;
}

/** Porcentaje a partir de un ratio (0,034 → "3,4 %"). */
export function fmtPct(ratio: number | null | undefined) {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return `${PCT.format(ratio * 100)} %`;
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
