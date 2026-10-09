// DATOS DE EJEMPLO para demostración y desarrollo. NO son datos de mercado.
// Solo se usan si STUDY_EXAMPLE_DATA=true y no hay otra fuente. En producción: false.
const EXAMPLE_SALE_M2: Record<string, number> = {
  "17152": 3200, // Roses
  "17047": 3000, // Castelló d'Empúries
  "17032": 5200, // Cadaqués
  "17092": 2700, // Llançà
  "17066": 1700, // Figueres
};

export function exampleDataEnabled() {
  return process.env.STUDY_EXAMPLE_DATA === "true";
}

export function exampleFor(municipalityCode: string | null) {
  if (!exampleDataEnabled()) return null;
  return { saleM2: (municipalityCode && EXAMPLE_SALE_M2[municipalityCode]) || 2500, rentM2: 11 };
}
