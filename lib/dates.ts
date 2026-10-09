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
