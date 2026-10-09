// Idealista — API para profesionales (búsqueda de anuncios). Requiere solicitar acceso
// (https://developers.idealista.com/access-request) y aceptar sus condiciones de uso.
// Devuelve PRECIOS DE OFERTA de anuncios, nunca precios de cierre: si se integra,
// las referencias deben etiquetarse como MARKET_OBSERVED ("precio observado").
//
// TODO: integrate Idealista API (OAuth2 client_credentials con IDEALISTA_API_KEY / IDEALISTA_API_SECRET).

export interface ComparableListing {
  price: number;
  sqm: number;
  pricePerM2: number;
  operation: "sale" | "rent";
  url?: string;
  observedAt: string;
}

export interface ComparablesProvider {
  readonly name: string;
  isConfigured(): boolean;
  findComparables(params: { lat?: number; lon?: number; municipality: string; operation: "sale" | "rent"; sqm: number }): Promise<ComparableListing[]>;
}

export class IdealistaProvider implements ComparablesProvider {
  readonly name = "Idealista API";

  isConfigured() {
    return Boolean(process.env.IDEALISTA_API_KEY && process.env.IDEALISTA_API_SECRET);
  }

  async findComparables(): Promise<ComparableListing[]> {
    if (!this.isConfigured()) return [];
    // TODO: integrate Idealista API — solicitar token y consultar /3.5/es/search.
    throw new Error("IdealistaProvider pendiente de implementar: requiere credenciales y acuerdo de uso.");
  }
}

export function getComparablesProvider(): ComparablesProvider {
  return new IdealistaProvider();
}
