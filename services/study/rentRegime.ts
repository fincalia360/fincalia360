// Régimen legal de la renta en un NUEVO contrato de alquiler de vivienda habitual (función pura).
// Base: Ley 12/2023, por el derecho a la vivienda, que añade los apartados 6 y 7 al art. 17 de la LAU:
//  · 17.6: en zona tensionada, la renta no puede superar la del último contrato vigente en los
//          últimos 5 años (más la actualización anual permitida; excepciones de hasta +10 % en
//          supuestos tasados: rehabilitación, mejoras de eficiencia, contratos ≥ 10 años…).
//  · 17.7: si el arrendador es gran tenedor (o la vivienda no se alquiló en los 5 años anteriores,
//          cuando así lo prevea la declaración), la renta no puede superar el índice de referencia.
// No se inventa ningún límite: si faltan datos, el estado es UNKNOWN y se listan los requisitos.
import type { LandlordBracket, StudySnapshot } from "./types";

export const SERPAVI_APP_URL = "https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/serpavi";
export const LEGAL_BASIS = "Ley 12/2023, de 24 de mayo, por el derecho a la vivienda (art. 17.6 y 17.7 de la Ley de Arrendamientos Urbanos)";

export type RentRegimeStatus =
  | "NO_SPECIFIC_CAP" // fuera de zona tensionada: libre pacto (con límites de actualización)
  | "EXISTING_CONTRACT" // contrato vigente: se mantiene su renta y sus reglas de actualización
  | "CAP_PREVIOUS_RENT" // tope = renta del contrato anterior
  | "CAP_REFERENCE_INDEX" // tope = índice de referencia (no calculable aquí)
  | "UNKNOWN";

export interface RentRegime {
  status: RentRegimeStatus;
  /** Renta máxima mensual cuando se puede determinar con los datos aportados. */
  capMonthly: number | null;
  summary: string;
  rules: string[];
  requirements: string[];
  missing: string[];
  source: {
    legalBasis: string;
    zoneSource: string;
    zoneUrl?: string;
    scope: string;
    validFrom: string | null;
    validTo: string | null;
    resolution?: string;
  };
}

export function determineRentRegime(params: {
  tensioned: StudySnapshot["tensioned"];
  currentlyRented: boolean;
  currentRent: number | null;
  landlordBracket: LandlordBracket;
  rentedLast5Years: "YES" | "NO" | "UNKNOWN";
  previousRent: number | null;
}): RentRegime {
  const t = params.tensioned;
  const source = {
    legalBasis: LEGAL_BASIS,
    zoneSource: t.source.name,
    zoneUrl: t.source.url,
    scope:
      t.status === "DECLARED" ? "Municipio completo" : t.status === "PARTIAL" ? "Parte del municipio (ámbito delimitado)" : t.status === "EXPIRED" ? "Declaración vencida" : "Sin declaración vigente localizada",
    validFrom: t.validFrom ?? null,
    validTo: t.validTo ?? null,
    resolution: t.resolution,
  };
  const base = { rules: [] as string[], requirements: [] as string[], missing: [] as string[], source };

  if (params.currentlyRented && params.currentRent) {
    return {
      ...base,
      status: "EXISTING_CONTRACT",
      capMonthly: params.currentRent,
      summary: "Contrato vigente: se mantiene la renta pactada; solo puede actualizarse según el contrato y los límites legales de actualización anual.",
      rules: ["La renta de un contrato en vigor no se modifica por la declaración de zona tensionada.", "Si el contrato termina y se firma uno nuevo, se aplicarán las reglas de la zona en ese momento."],
    };
  }

  if (t.status === "UNKNOWN") {
    return {
      ...base,
      status: "UNKNOWN",
      capMonthly: null,
      summary: "No se ha podido verificar si la vivienda está en zona tensionada: no se puede determinar la renta máxima.",
      missing: ["Situación de zona tensionada según la fuente oficial"],
    };
  }
  if (t.status === "NOT_FOUND" || t.status === "EXPIRED") {
    return {
      ...base,
      status: "NO_SPECIFIC_CAP",
      capMonthly: null,
      summary: "Sin zona tensionada vigente: no hay un tope específico de renta inicial (libre pacto), pero sí límites a la actualización anual.",
      rules: ["Compruébalo de nuevo antes de firmar: pueden publicarse nuevas declaraciones."],
    };
  }

  // Zona tensionada declarada (total o parcial)
  const partialWarning = t.status === "PARTIAL" ? ["La declaración afecta solo a una parte del municipio: hay que confirmar que la dirección está dentro del ámbito."] : [];
  const rules = [
    "Art. 17.6 LAU: la renta no puede superar la del último contrato vigente en los últimos 5 años, actualizada (excepciones tasadas de hasta +10 %).",
    "Art. 17.7 LAU: si el arrendador es gran tenedor, la renta no puede superar el índice de referencia del sistema estatal de índices.",
    ...partialWarning,
  ];
  const isLarge = params.landlordBracket === "OVER_10";
  const maybeLarge = params.landlordBracket === "5_10" || params.landlordBracket === "UNDISCLOSED";

  if (params.rentedLast5Years === "YES") {
    if (params.previousRent == null) {
      return { ...base, rules, status: "UNKNOWN", capMonthly: null, summary: "Hubo contrato en los últimos 5 años: el tope es su renta, pero no se ha indicado.", missing: ["Renta mensual del último contrato"] };
    }
    if (isLarge) {
      return {
        ...base,
        rules,
        status: "CAP_REFERENCE_INDEX",
        capMonthly: params.previousRent,
        summary: `Gran tenedor: la renta no puede superar ni la del último contrato (${Math.round(params.previousRent).toLocaleString("es-ES")} €/mes, límite superior conocido) ni el índice de referencia, que no se puede calcular aquí y puede ser menor.`,
        requirements: ["Consultar el rango de referencia de la vivienda en la aplicación oficial del Ministerio."],
        missing: ["Valor del índice de referencia para esta vivienda"],
      };
    }
    return {
      ...base,
      rules,
      status: "CAP_PREVIOUS_RENT",
      capMonthly: params.previousRent,
      summary: `Tope estimado: ${Math.round(params.previousRent).toLocaleString("es-ES")} €/mes (renta del último contrato), más la actualización anual permitida.${isLarge || maybeLarge ? " Si eres gran tenedor, el índice de referencia puede fijar un tope menor." : ""}`,
      requirements: ["Contrato anterior de vivienda habitual vigente en los últimos 5 años.", ...(isLarge || maybeLarge ? ["Si eres gran tenedor, consulta además el índice de referencia de la vivienda."] : [])],
      missing: maybeLarge ? ["Confirmar si eres gran tenedor (más de 10 viviendas, o 5 si la declaración lo establece)"] : [],
    };
  }

  if (isLarge) {
    return {
      ...base,
      rules,
      status: "CAP_REFERENCE_INDEX",
      capMonthly: null,
      summary: "Como gran tenedor, la renta no puede superar el índice de referencia de la vivienda. Ese valor individual no se puede calcular aquí.",
      requirements: ["Consultar el rango de referencia de la vivienda en la aplicación oficial del Ministerio."],
      missing: ["Valor del índice de referencia para esta vivienda"],
    };
  }
  return {
    ...base,
    rules,
    status: "UNKNOWN",
    capMonthly: null,
    summary:
      params.rentedLast5Years === "NO"
        ? "Sin contrato en los últimos 5 años: el tope depende de si eres gran tenedor y de lo que establezca la declaración de la zona. No se puede fijar con los datos disponibles."
        : "Falta saber si hubo contrato en los últimos 5 años y su renta: no se puede fijar la renta máxima.",
    missing: [
      ...(params.rentedLast5Years === "UNKNOWN" ? ["¿Hubo contrato de alquiler en los últimos 5 años? y su renta"] : []),
      ...(maybeLarge ? ["Número de viviendas del arrendador (gran tenedor)"] : []),
    ],
  };
}
