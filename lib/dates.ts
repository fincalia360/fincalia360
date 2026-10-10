/** Valor para <input type="datetime-local"> en hora peninsular española. */
export function madridLocalValue(date: Date | null | undefined) {
  if (!date) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(date)
    .replace(" ", "T");
}

/** «12 oct 2026, 10:30» en hora de España. */
export function formatMadrid(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** «2026-10-12T10:30» de un <input type="datetime-local">, en hora peninsular española → Date. */
export function parseMadridLocal(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const asUtc = new Date(`${value}:00Z`);
  const offset = Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", timeZoneName: "shortOffset" })
    .formatToParts(asUtc)
    .find((p) => p.type === "timeZoneName")
    ?.value.match(/GMT([+-]\d+)/)?.[1];
  const hours = offset ? Number(offset) : 1;
  return new Date(asUtc.getTime() - hours * 3600_000);
}
