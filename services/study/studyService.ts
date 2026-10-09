// Orquestador del estudio «¿Te conviene vender o alquilar?».
// Reúne fuentes (INE, SERPAVI, Ministerio, Catastro, referencias del equipo), calcula la
// valoración, guarda el estudio con acceso privado y lo integra en el CRM si el propietario
// solicita una valoración profesional.
import { z } from "zod";
import { prisma } from "@/db/client";
import { trackEvent } from "@/services/analyticsService";
import { buildDefaultAssumptions, normalizeAssumptions } from "./assumptions";
import { exampleFor } from "./exampleData";
import { getCcaa, ineToCommonName, normalizeName } from "./geo";
import { newAccessToken, verifyToken } from "./access";
import { getComparablesProvider } from "./sources/idealista";
import { getPopulation, getPriceIndexCcaa, getRentIndex, getTouristDwellingsPct, listMunicipalities } from "./sources/ine";
import { getSerpaviMunicipality, latestSerpaviYear } from "./sources/serpavi";
import { checkTensionedArea, getDeclarations } from "./sources/tensionedAreas";
import { getNewContractRent } from "./sources/incasol";
import { getValorTasado } from "./sources/valorTasado";
import { estimateRent, estimateSale, type MarketRef } from "./valuation";
import {
  NEW_CONTRACT_CONDITIONS,
  RENT_CHOICES,
  SALE_CHOICES,
  serpaviTypology,
  studyInputSchema,
  type Series,
  type SourceRef,
  type StudyAssumptions,
  type StudyInput,
  type StudySnapshot,
  type ZoneData,
} from "./types";

async function safe<T>(label: string, fn: () => Promise<T>, sources: SourceRef[], fallbackSource: SourceRef): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    sources.push({ ...fallbackSource, status: "ERROR", note: `${label}: ${(error as Error).message}` });
    return null;
  }
}

function seriesFromSerpavi(code: string, typology: "VC" | "VU", meta: SourceRef): { rentM2: Series | null; stock: Series | null } {
  const s = getSerpaviMunicipality(code);
  if (!s) return { rentM2: null, stock: null };
  const years = Object.keys(s.municipality.years).sort();
  const rentPoints = years.flatMap((y) => (s.municipality.years[y][typology] ? [{ period: y, value: s.municipality.years[y][typology]!.m }] : []));
  const stockPoints = years.map((y) => ({ period: y, value: (s.municipality.years[y].VC?.n ?? 0) + (s.municipality.years[y].VU?.n ?? 0) }));
  return {
    rentM2: rentPoints.length
      ? { label: `Alquiler declarado mediano (${typology === "VC" ? "vivienda colectiva" : "unifamiliar"})`, unit: "€/m²/mes", points: rentPoints, source: meta }
      : null,
    stock: stockPoints.length ? { label: "Viviendas con alquiler habitual declarado", unit: "viviendas", points: stockPoints, source: meta } : null,
  };
}

/** Construye el snapshot del estudio (fuentes + valoración). Sin efectos salvo cachés de fuentes. */
export async function buildSnapshot(input: StudyInput): Promise<StudySnapshot> {
  const sources: SourceRef[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];
  const loc = input.location;
  const ccaa = getCcaa(loc.ccaaCode);

  // Identificación oficial del municipio (código INE)
  let municipalityCode = loc.municipalityCode;
  let ineValueId = loc.ineValueId;
  if (!municipalityCode || !ineValueId) {
    const list = await safe("Municipios", () => listMunicipalities(loc.provinceCode), sources, { name: "INE · municipios", status: "ERROR" });
    const hit = list?.municipalities.find(
      (m) => m.code === municipalityCode || normalizeName(ineToCommonName(m.name)) === normalizeName(loc.municipalityName) || normalizeName(m.name) === normalizeName(loc.municipalityName),
    );
    if (hit) {
      municipalityCode = hit.code;
      ineValueId = hit.ineValueId;
    } else {
      warnings.push("No hemos podido identificar el municipio en el INE: algunos datos oficiales no estarán disponibles.");
    }
  }

  const typology = serpaviTypology(input.property.kind);
  const serpavi = municipalityCode ? getSerpaviMunicipality(municipalityCode) : null;
  const serpaviSource: SourceRef = serpavi
    ? { name: serpavi.meta.source, url: serpavi.meta.sourceUrl, retrievedAt: serpavi.meta.importedAt, status: "OK", note: serpavi.meta.notes }
    : { name: "SERPAVI (MIVAU)", status: "NOT_AVAILABLE", note: "Sin datos para este municipio en el fichero importado." };
  sources.push(serpaviSource);

  const [population, rentIndex, priceIndexCcaa, touristPct, declarations, marketRefsRaw] = await Promise.all([
    ineValueId
      ? safe("Población", () => getPopulation(loc.provinceCode, ineValueId!), sources, { name: "INE · Padrón municipal", status: "ERROR" })
      : Promise.resolve(null),
    ineValueId ? safe("IPVA", () => getRentIndex(ineValueId!), sources, { name: "INE · IPVA", status: "ERROR" }) : Promise.resolve(null),
    ccaa ? safe("IPV", () => getPriceIndexCcaa(ccaa.ineName), sources, { name: "INE · IPV", status: "ERROR" }) : Promise.resolve(null),
    ineValueId ? safe("Viviendas turísticas", () => getTouristDwellingsPct(ineValueId!), sources, { name: "INE · VTE", status: "ERROR" }) : Promise.resolve(null),
    getDeclarations().catch(() => ({ declarations: [], importedAt: null })),
    municipalityCode ? prisma.marketReference.findMany({ where: { municipalityCode } }) : Promise.resolve([]),
  ]);

  const marketRefs = marketRefsRaw as unknown as MarketRef[];

  // Comparables de un proveedor autorizado (solo si está configurado; nunca se simulan)
  const provider = getComparablesProvider();
  let saleComparables: Awaited<ReturnType<typeof provider.findComparables>> = [];
  let rentComparables: typeof saleComparables = [];
  if (provider.isConfigured()) {
    const query = { municipality: loc.municipalityName, sqm: input.property.sqm };
    saleComparables = (await safe("Comparables venta", () => provider.findComparables({ ...query, operation: "sale" }), sources, { name: provider.name, status: "ERROR" })) ?? [];
    rentComparables = (await safe("Comparables alquiler", () => provider.findComparables({ ...query, operation: "rent" }), sources, { name: provider.name, status: "ERROR" })) ?? [];
  }

  // Valor tasado medio oficial (municipio de más de 25.000 hab. o, si no, provincia)
  const valorTasado = getValorTasado({ provinceCode: loc.provinceCode, municipalityName: loc.municipalityName, yearBuilt: input.property.yearBuilt ?? null });
  sources.push(
    valorTasado
      ? {
          name: valorTasado.meta.source,
          url: valorTasado.scope === "MUNICIPIO" ? valorTasado.meta.sourceUrlMunicipios : valorTasado.meta.sourceUrlProvincias,
          period: valorTasado.quarter,
          retrievedAt: valorTasado.meta.importedAt,
          status: "OK",
          note: valorTasado.scope === "MUNICIPIO" ? `Dato del municipio (${valorTasado.name})` : `Media provincial (${valorTasado.name}): el municipio no tiene dato propio`,
        }
      : { name: "Ministerio de Vivienda · valor tasado", status: "NOT_AVAILABLE", note: "Sin datos importados." },
  );

  // Renta de contratos nuevos (Cataluña): dato oficial abierto de la Generalitat
  const newContractRent = municipalityCode
    ? await safe("Contratos nuevos (Incasòl)", () => getNewContractRent(municipalityCode!), sources, { name: "Generalitat de Catalunya · Incasòl", status: "ERROR" })
    : null;
  if (newContractRent) sources.push({ ...newContractRent.source, period: newContractRent.period, status: "OK", note: `${newContractRent.contracts} contratos nuevos` });

  const ctx = {
    serpavi,
    newContractRent,
    rentIndex,
    priceIndexCcaa,
    marketRefs,
    exampleData: exampleFor(municipalityCode),
    saleComparables,
    rentComparables,
    comparablesSource: provider.name,
    valorTasado,
  };
  const saleEstimates = estimateSale(input, ctx);
  const rentEstimates = estimateRent(input, ctx);

  const latest = serpavi ? latestSerpaviYear(serpavi.municipality, typology) : null;
  const comparables: StudySnapshot["comparables"] = {
    available: provider.isConfigured(),
    note: provider.isConfigured()
      ? `Comparables de ${provider.name}.`
      : "No hay un proveedor de comparables individuales configurado (p. ej. Idealista requiere acuerdo y credenciales). Se muestra la distribución oficial de rentas del municipio.",
    serpaviBand: latest
      ? { year: latest.year, p25: latest.data.p25, median: latest.data.m, p75: latest.data.p75, medianSqm: latest.data.sup, count: latest.data.n, typology }
      : undefined,
  };

  // Zona tensionada
  const names = [loc.municipalityName];
  const tensioned = checkTensionedArea({
    municipalityNames: names,
    ccaaName: ccaa?.name ?? "",
    declarations: declarations.declarations,
    importedAt: declarations.importedAt,
  });
  sources.push(tensioned.source);

  const serpaviSeries = municipalityCode ? seriesFromSerpavi(municipalityCode, typology, serpaviSource) : { rentM2: null, stock: null };
  const zone: ZoneData = {
    population: population?.total ?? null,
    populationBySex: population?.bySex ?? null,
    touristDwellingsPct: touristPct ?? null,
    rentalStock: serpaviSeries.stock,
    rentM2History: serpaviSeries.rentM2,
    rentIndex: rentIndex ?? null,
    priceIndexCcaa: priceIndexCcaa ?? null,
    unavailable: [
      { indicator: "Distribución por franjas de edad", reason: "El INE no la publica a nivel municipal en la API utilizada (disponible por descarga en la Estadística del Padrón Continuo)." },
      { indicator: "Número y tipología de hogares", reason: "Disponible en el Censo de Población y Viviendas 2021 por descarga; pendiente de integrar." },
      { indicator: "Oferta inmobiliaria disponible", reason: "Requiere datos de portales (acuerdo con proveedor). No se muestran cifras sin fuente autorizada." },
      { indicator: "Datos por barrio o sección censal", reason: "Se muestran datos del municipio. SERPAVI tiene detalle por sección censal: integrable con la sección de la dirección." },
    ],
  };
  if (!rentIndex && ineValueId) zone.unavailable.push({ indicator: "Índice de alquiler (IPVA) del municipio", reason: "Solo se publica para municipios de más de 10.000 habitantes." });
  for (const s of [population?.total, rentIndex, priceIndexCcaa, touristPct]) if (s) sources.push(s.source);

  // Datos que faltan
  const e = input.economics;
  if (!e.ownerValuation && !e.purchasePrice) missingData.push("Precio de compra o una tasación/valor de referencia: mejoran mucho la estimación del valor de venta.");
  if (e.purchasePrice && !e.purchaseYear) missingData.push("Año de compra (necesario para actualizar el precio con el IPV y para la plusvalía).");
  if (e.cadastralValueLand == null) missingData.push("Valor catastral del suelo (recibo del IBI): necesario para estimar la plusvalía municipal.");
  if (e.communityFeesYear == null) missingData.push("Gastos de comunidad reales.");
  if (e.ibiYear == null) missingData.push("Importe del IBI.");
  const saleNeeded = ["Tasación reciente o valor de referencia del Catastro (sede electrónica)", "Precio y año de compra (para actualizarlo con el índice oficial de precios)", "O una oferta firme recibida"];
  if (!saleEstimates.length) warnings.push("No es posible valorar el inmueble con fiabilidad: no hay ninguna fuente con los datos aportados. Indica una tasación, el valor de referencia catastral o el precio y año de compra.");
  if (saleEstimates[0]?.origin === "EXAMPLE") warnings.push("El valor de venta mostrado es un dato de EJEMPLO (modo demostración). No lo uses para decidir.");
  if (!comparables.available) sources.push({ name: "Idealista API (comparables)", url: "https://developers.idealista.com/access-request", status: "NOT_CONFIGURED", note: "Requiere solicitud de acceso y credenciales." });

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    sale: saleEstimates[0] ?? null,
    saleAlternatives: saleEstimates.slice(1),
    saleStatus: saleEstimates.length
      ? { reliable: saleEstimates[0].origin !== "EXAMPLE", reason: saleEstimates[0].method, needed: [] }
      : { reliable: false, reason: "Sin fuente de valoración con los datos aportados.", needed: saleNeeded },
    rentStatistical: rentEstimates.statistical,
    rentMarket: rentEstimates.market[0] ?? null,
    rent: rentEstimates.market[0] ?? rentEstimates.statistical,
    rentAlternatives: rentEstimates.market.slice(1),
    ownerCurrentRent: input.property.currentUse === "RENTED" ? input.owner.currentRent : null,
    comparables,
    tensioned,
    zone,
    sources,
    missingData,
    warnings,
  };
}

export async function createStudy(rawInput: unknown) {
  const input = studyInputSchema.parse(rawInput);
  const snapshot = await buildSnapshot(input);
  const { values } = buildDefaultAssumptions(input);
  const { token, hash } = newAccessToken();
  const confidence = snapshot.sale?.confidence ?? "NONE";
  const study = await prisma.study.create({
    data: {
      tokenHash: hash,
      input: JSON.stringify(input),
      assumptions: JSON.stringify(values),
      result: JSON.stringify(snapshot),
      ccaaCode: input.location.ccaaCode,
      provinceCode: input.location.provinceCode,
      municipalityCode: input.location.municipalityCode,
      municipalityName: input.location.municipalityName,
      postalCode: input.location.postalCode,
      propertyType: input.property.kind,
      sqm: input.property.sqm,
      saleEstimate: snapshot.sale?.value ?? null,
      rentEstimate: snapshot.ownerCurrentRent ?? snapshot.rentMarket?.value ?? snapshot.rentStatistical?.value ?? null,
      confidence,
      tensionedStatus: snapshot.tensioned.status,
    },
  });
  await trackEvent("study_completed", { payload: { studyId: study.id } });
  return { id: study.id, token };
}

export async function getStudyForOwner(id: string, token: string | undefined) {
  const study = await prisma.study.findUnique({ where: { id } });
  if (!study || !verifyToken(token, study.tokenHash)) return null;
  return parseStudy(study);
}

export function parseStudy<T extends { input: string; assumptions: string; result: string }>(study: T) {
  const input = JSON.parse(study.input) as StudyInput;
  return {
    ...study,
    input,
    // Normaliza estudios antiguos (valor de venta 0 → desconocido, campos nuevos con valores por defecto)
    assumptions: normalizeAssumptions(JSON.parse(study.assumptions), input) as StudyAssumptions,
    snapshot: JSON.parse(study.result) as StudySnapshot,
  };
}

const num = z.number().finite().min(-50).max(100_000_000);
const assumptionsSchema = z
  .object({
    saleChoice: z.enum(SALE_CHOICES),
    saleValue: num.nullable(),
    rentChoice: z.enum(RENT_CHOICES),
    monthlyRent: num.nullable(),
    newContractCondition: z.enum(NEW_CONTRACT_CONDITIONS),
    communityFeesYear: num.nullable(),
    ibiYear: num.nullable(),
    insuranceYear: num.nullable(),
  })
  .partial()
  .catchall(num);

export async function saveAssumptions(id: string, token: string | undefined, raw: unknown) {
  const study = await prisma.study.findUnique({ where: { id } });
  if (!study || !verifyToken(token, study.tokenHash)) return null;
  const input = JSON.parse(study.input) as StudyInput;
  const current = normalizeAssumptions(JSON.parse(study.assumptions), input);
  const parsed = assumptionsSchema.parse(raw) as Record<string, unknown>;
  const next = { ...current } as Record<string, unknown>;
  for (const key of Object.keys(current)) if (key in parsed) next[key] = parsed[key];
  await prisma.study.update({ where: { id }, data: { assumptions: JSON.stringify(next) } });
  return next as unknown as StudyAssumptions;
}

