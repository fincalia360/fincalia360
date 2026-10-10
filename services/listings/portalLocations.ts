// Municipios para el buscador del portal: TODOS los municipios oficiales (INE) de las provincias
// del portal (Cataluña), con el número de anuncios publicados en cada uno. Si el INE no responde,
// se usan al menos los municipios que tienen anuncios.
import { prisma } from "@/db/client";
import { PROVINCES, ineToCommonName } from "@/services/study/geo";
import { listMunicipalities } from "@/services/study/sources/ine";
import { PORTAL_PROVINCE_CODES, PUBLIC_STATUSES } from "./catalog";

export interface PortalLocations {
  provinces: { code: string; name: string }[];
  /** Municipios por provincia, en orden alfabético. */
  municipalities: Record<string, string[]>;
  /** Anuncios publicados por «provincia|municipio». */
  counts: Record<string, number>;
  /** Puertos con amarres publicados (solo en la sección de amarres). */
  ports: { name: string; count: number }[];
}

export async function portalLocations(operation: "SALE" | "RENT", category: "HOME" | "MOORING" = "HOME"): Promise<PortalLocations> {
  const provinces = PROVINCES.filter((p) => PORTAL_PROVINCE_CODES.includes(p.code))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map(({ code, name }) => ({ code, name }));

  const visible = { status: { in: PUBLIC_STATUSES }, operation, category, provinceCode: { in: [...PORTAL_PROVINCE_CODES] }, OR: [{ agencyId: null }, { agency: { crmAccess: true, status: "ACTIVE" } }] };
  const [official, rows, portRows] = await Promise.all([
    Promise.all(
      provinces.map((p) =>
        listMunicipalities(p.code)
          .then((r) => r.municipalities.map((m) => ineToCommonName(m.name)))
          .catch(() => [] as string[]),
      ),
    ),
    prisma.listing.groupBy({
      by: ["provinceCode", "municipality"],
      where: visible,
      _count: true,
    }),
    category === "MOORING" ? prisma.listing.groupBy({ by: ["portName"], where: visible, _count: true, orderBy: { portName: "asc" } }) : Promise.resolve([]),
  ]);

  const municipalities: Record<string, string[]> = {};
  provinces.forEach((p, i) => {
    const names = new Set(official[i]);
    for (const r of rows) if (r.provinceCode === p.code) names.add(r.municipality);
    municipalities[p.code] = [...names].sort((a, b) => a.localeCompare(b, "es"));
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[`${r.provinceCode}|${r.municipality}`] = r._count;
  const ports = portRows.filter((r) => r.portName).map((r) => ({ name: r.portName!, count: r._count }));
  return { provinces, municipalities, counts, ports };
}
