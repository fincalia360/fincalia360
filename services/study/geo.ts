// Comunidades autónomas y provincias con sus códigos oficiales del INE.
// El código postal español empieza por el código de provincia (01–52).

export interface Ccaa {
  code: string;
  name: string;
  /** Denominación usada por el INE en sus series (para casar datos). */
  ineName: string;
}

export interface Province {
  code: string;
  name: string;
  ccaa: string;
  /** Denominación usada por el INE en las tablas del Padrón. */
  ineName: string;
}

export const CCAA: Ccaa[] = [
  { code: "01", name: "Andalucía", ineName: "Andalucía" },
  { code: "02", name: "Aragón", ineName: "Aragón" },
  { code: "03", name: "Principado de Asturias", ineName: "Asturias, Principado de" },
  { code: "04", name: "Illes Balears", ineName: "Balears, Illes" },
  { code: "05", name: "Canarias", ineName: "Canarias" },
  { code: "06", name: "Cantabria", ineName: "Cantabria" },
  { code: "07", name: "Castilla y León", ineName: "Castilla y León" },
  { code: "08", name: "Castilla-La Mancha", ineName: "Castilla - La Mancha" },
  { code: "09", name: "Cataluña", ineName: "Cataluña" },
  { code: "10", name: "Comunitat Valenciana", ineName: "Comunitat Valenciana" },
  { code: "11", name: "Extremadura", ineName: "Extremadura" },
  { code: "12", name: "Galicia", ineName: "Galicia" },
  { code: "13", name: "Comunidad de Madrid", ineName: "Madrid, Comunidad de" },
  { code: "14", name: "Región de Murcia", ineName: "Murcia, Región de" },
  { code: "15", name: "Comunidad Foral de Navarra", ineName: "Navarra, Comunidad Foral de" },
  { code: "16", name: "País Vasco", ineName: "País Vasco" },
  { code: "17", name: "La Rioja", ineName: "Rioja, La" },
  { code: "18", name: "Ceuta", ineName: "Ceuta" },
  { code: "19", name: "Melilla", ineName: "Melilla" },
];

export const PROVINCES: Province[] = [
  { code: "01", name: "Araba/Álava", ccaa: "16", ineName: "Araba/Álava" },
  { code: "02", name: "Albacete", ccaa: "08", ineName: "Albacete" },
  { code: "03", name: "Alicante/Alacant", ccaa: "10", ineName: "Alicante/Alacant" },
  { code: "04", name: "Almería", ccaa: "01", ineName: "Almería" },
  { code: "05", name: "Ávila", ccaa: "07", ineName: "Ávila" },
  { code: "06", name: "Badajoz", ccaa: "11", ineName: "Badajoz" },
  { code: "07", name: "Illes Balears", ccaa: "04", ineName: "Balears, Illes" },
  { code: "08", name: "Barcelona", ccaa: "09", ineName: "Barcelona" },
  { code: "09", name: "Burgos", ccaa: "07", ineName: "Burgos" },
  { code: "10", name: "Cáceres", ccaa: "11", ineName: "Cáceres" },
  { code: "11", name: "Cádiz", ccaa: "01", ineName: "Cádiz" },
  { code: "12", name: "Castellón/Castelló", ccaa: "10", ineName: "Castellón/Castelló" },
  { code: "13", name: "Ciudad Real", ccaa: "08", ineName: "Ciudad Real" },
  { code: "14", name: "Córdoba", ccaa: "01", ineName: "Córdoba" },
  { code: "15", name: "A Coruña", ccaa: "12", ineName: "Coruña, A" },
  { code: "16", name: "Cuenca", ccaa: "08", ineName: "Cuenca" },
  { code: "17", name: "Girona", ccaa: "09", ineName: "Girona" },
  { code: "18", name: "Granada", ccaa: "01", ineName: "Granada" },
  { code: "19", name: "Guadalajara", ccaa: "08", ineName: "Guadalajara" },
  { code: "20", name: "Gipuzkoa", ccaa: "16", ineName: "Gipuzkoa" },
  { code: "21", name: "Huelva", ccaa: "01", ineName: "Huelva" },
  { code: "22", name: "Huesca", ccaa: "02", ineName: "Huesca" },
  { code: "23", name: "Jaén", ccaa: "01", ineName: "Jaén" },
  { code: "24", name: "León", ccaa: "07", ineName: "León" },
  { code: "25", name: "Lleida", ccaa: "09", ineName: "Lleida" },
  { code: "26", name: "La Rioja", ccaa: "17", ineName: "Rioja, La" },
  { code: "27", name: "Lugo", ccaa: "12", ineName: "Lugo" },
  { code: "28", name: "Madrid", ccaa: "13", ineName: "Madrid" },
  { code: "29", name: "Málaga", ccaa: "01", ineName: "Málaga" },
  { code: "30", name: "Murcia", ccaa: "14", ineName: "Murcia" },
  { code: "31", name: "Navarra", ccaa: "15", ineName: "Navarra" },
  { code: "32", name: "Ourense", ccaa: "12", ineName: "Ourense" },
  { code: "33", name: "Asturias", ccaa: "03", ineName: "Asturias" },
  { code: "34", name: "Palencia", ccaa: "07", ineName: "Palencia" },
  { code: "35", name: "Las Palmas", ccaa: "05", ineName: "Palmas, Las" },
  { code: "36", name: "Pontevedra", ccaa: "12", ineName: "Pontevedra" },
  { code: "37", name: "Salamanca", ccaa: "07", ineName: "Salamanca" },
  { code: "38", name: "Santa Cruz de Tenerife", ccaa: "05", ineName: "Santa Cruz de Tenerife" },
  { code: "39", name: "Cantabria", ccaa: "06", ineName: "Cantabria" },
  { code: "40", name: "Segovia", ccaa: "07", ineName: "Segovia" },
  { code: "41", name: "Sevilla", ccaa: "01", ineName: "Sevilla" },
  { code: "42", name: "Soria", ccaa: "07", ineName: "Soria" },
  { code: "43", name: "Tarragona", ccaa: "09", ineName: "Tarragona" },
  { code: "44", name: "Teruel", ccaa: "02", ineName: "Teruel" },
  { code: "45", name: "Toledo", ccaa: "08", ineName: "Toledo" },
  { code: "46", name: "Valencia/València", ccaa: "10", ineName: "Valencia/València" },
  { code: "47", name: "Valladolid", ccaa: "07", ineName: "Valladolid" },
  { code: "48", name: "Bizkaia", ccaa: "16", ineName: "Bizkaia" },
  { code: "49", name: "Zamora", ccaa: "07", ineName: "Zamora" },
  { code: "50", name: "Zaragoza", ccaa: "02", ineName: "Zaragoza" },
  { code: "51", name: "Ceuta", ccaa: "18", ineName: "Ceuta" },
  { code: "52", name: "Melilla", ccaa: "19", ineName: "Melilla" },
];

export function getProvince(code: string) {
  return PROVINCES.find((p) => p.code === code);
}

export function getCcaa(code: string) {
  return CCAA.find((c) => c.code === code);
}

export function provincesOf(ccaaCode: string) {
  return PROVINCES.filter((p) => p.ccaa === ccaaCode);
}

/** Valida que el código postal corresponde a la provincia (primeros dos dígitos). */
export function postalCodeMatchesProvince(postalCode: string, provinceCode: string) {
  return /^\d{5}$/.test(postalCode) && postalCode.slice(0, 2) === provinceCode;
}

/** Normaliza nombres para comparar (sin acentos, minúsculas, sin signos). */
export function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Conjunto de palabras (para casar "Balears, Illes" con "Illes Balears"). */
export function tokenSet(value: string) {
  return new Set(normalizeName(value.replace(/[/,]/g, " ")).split(" ").filter(Boolean));
}

export function sameTokens(a: string, b: string) {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  return ta.size === tb.size && [...ta].every((t) => tb.has(t));
}

/**
 * El INE escribe los artículos al final ("Escala, L'", "Bisbal d'Empordà, La").
 * Devuelve la forma habitual ("L'Escala", "La Bisbal d'Empordà").
 */
export function ineToCommonName(name: string) {
  const m = name.match(/^(.*), (L'|La|El|Els|Les|Lo|Los|Las|A|O|As|Os|Es|Sa|Ses|S')$/i);
  if (!m) return name;
  const article = m[2];
  return article.endsWith("'") ? `${article}${m[1]}` : `${article} ${m[1]}`;
}
