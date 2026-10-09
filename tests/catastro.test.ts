import { describe, expect, it } from "vitest";
import { normalizeStreetQuery, parseFloor, titleCase } from "@/services/study/sources/catastro";

describe("Catastro: búsqueda por dirección", () => {
  it("normaliza lo que escribe el propietario al formato del callejero", () => {
    expect(normalizeStreetQuery("calle Alcalá")).toBe("ALCALA");
    expect(normalizeStreetQuery("C/ de la Riera")).toBe("RIERA");
    expect(normalizeStreetQuery("Avda. Diagonal")).toBe("DIAGONAL");
    expect(normalizeStreetQuery("Plaza España")).toBe("ESPAÑA");
    expect(normalizeStreetQuery("  gran   vía ")).toBe("GRAN VIA");
  });

  it("interpreta las plantas del Catastro", () => {
    expect(parseFloor("00")).toBe(0);
    expect(parseFloor("03")).toBe(3);
    expect(parseFloor("-1")).toBe(-1);
    expect(parseFloor("EN")).toBeNull();
    expect(parseFloor(undefined)).toBeNull();
  });

  it("muestra los nombres de calle legibles", () => {
    expect(titleCase("DE LA RIERA")).toBe("De la Riera");
    expect(titleCase("ALCALA DE HENARES")).toBe("Alcala de Henares");
  });
});
