// Ubicación de la vivienda del estudio: la guardada al crearlo o, en estudios anteriores, la del
// Catastro a partir de la referencia catastral (se guarda en caché).
import { getParcelGeo } from "./sources/catastroValues";
import type { PropertyGeo, StudyInput, StudySnapshot } from "./types";

export async function studyGeo(input: StudyInput, snapshot: StudySnapshot): Promise<PropertyGeo | null> {
  if (snapshot.geo) return snapshot.geo;
  const rc = input.location.cadastralRef;
  if (!rc) return null;
  return getParcelGeo(rc).catch(() => null);
}
