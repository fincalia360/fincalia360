import { studyInputSchema, type Series, type StudyInput, type StudySnapshot } from "@/services/study/types";
import type { SerpaviMunicipality } from "@/services/study/sources/serpavi";

export function makeInput(overrides: { location?: object; property?: object; economics?: object; owner?: object } = {}): StudyInput {
  return studyInputSchema.parse({
    location: { country: "ES", ccaaCode: "09", provinceCode: "17", municipalityName: "Roses", municipalityCode: "17152", postalCode: "17480", ...overrides.location },
    property: {
      kind: "PISO",
      sqm: 80,
      bedrooms: 2,
      bathrooms: 1,
      floor: 2,
      elevator: true,
      outdoor: "NONE",
      parking: false,
      storage: false,
      condition: "GOOD",
      currentUse: "SECOND_HOME",
      ...overrides.property,
    },
    economics: { ...overrides.economics },
    owner: { goal: "UNSURE", horizon: 5, tenancyIssue: "NONE", taxResidence: "ES", ...overrides.owner },
  });
}

export const SERPAVI_FIXTURE: { municipality: SerpaviMunicipality; meta: { source: string; sourceUrl: string; file: string; importedAt: string; notes: string } } = {
  municipality: {
    name: "Roses",
    years: {
      "2023": { VC: { n: 1200, m: 7, p25: 5.5, p75: 9, sup: 70 } },
      "2024": { VC: { n: 1307, m: 7.38, p25: 5.84, p75: 9.38, sup: 71 }, VU: { n: 145, m: 4.97, p25: 2.83, p75: 7.19, sup: 170 } },
    },
  },
  meta: { source: "SERPAVI (test)", sourceUrl: "https://example.org", file: "test.xlsx", importedAt: "2026-10-09", notes: "" },
};

export function series(points: Array<[string, number]>, label = "serie"): Series {
  return { label, unit: "índice", points: points.map(([period, value]) => ({ period, value })), source: { name: "INE (test)", status: "OK" } };
}

export function emptySnapshot(partial: Partial<StudySnapshot> = {}): StudySnapshot {
  return {
    version: 1,
    createdAt: "2026-10-09T00:00:00.000Z",
    sale: null,
    saleAlternatives: [],
    rent: null,
    rentAlternatives: [],
    ownerCurrentRent: null,
    comparables: { available: false, note: "" },
    tensioned: { status: "UNKNOWN", summary: "No verificado", source: { name: "test", status: "NOT_AVAILABLE" } },
    zone: { population: null, populationBySex: null, touristDwellingsPct: null, rentalStock: null, rentM2History: null, rentIndex: null, priceIndexCcaa: null, unavailable: [] },
    sources: [],
    missingData: [],
    warnings: [],
    ...partial,
  };
}
