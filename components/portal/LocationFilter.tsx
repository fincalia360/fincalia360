"use client";
// Provincia → municipio del buscador. Muestra todos los municipios oficiales de la provincia elegida
// (o de toda Cataluña agrupados por provincia) y cuántos anuncios hay en cada uno.
import { useState } from "react";
import type { PortalLocations } from "@/services/listings/portalLocations";

export function LocationFilter({ locations, province: initialProvince, municipality: initialMunicipality }: { locations: PortalLocations; province?: string; municipality?: string }) {
  const { provinces, municipalities, counts } = locations;
  const [province, setProvince] = useState(initialProvince ?? "");
  const [municipality, setMunicipality] = useState(initialMunicipality ?? "");

  const option = (code: string, name: string) => {
    const n = counts[`${code}|${name}`];
    return (
      <option key={`${code}|${name}`} value={name}>
        {n ? `${name} (${n})` : name}
      </option>
    );
  };

  return (
    <>
      <label className="block">
        <span className="field-label">Provincia</span>
        <select
          name="provincia"
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            if (e.target.value && municipality && !municipalities[e.target.value]?.includes(municipality)) setMunicipality("");
          }}
          className="field"
        >
          <option value="">Toda Cataluña</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="field-label">Municipio</span>
        <select
          name="municipio"
          value={municipality}
          onChange={(e) => {
            const name = e.target.value;
            setMunicipality(name);
            // Al elegir un municipio sin provincia, se fija su provincia
            if (name && !province) setProvince(provinces.find((p) => municipalities[p.code]?.includes(name))?.code ?? "");
          }}
          className="field"
        >
          <option value="">{province ? "Todos los municipios" : "Todos los municipios de Cataluña"}</option>
          {province
            ? (municipalities[province] ?? []).map((m) => option(province, m))
            : provinces.map((p) => (
                <optgroup key={p.code} label={p.name}>
                  {(municipalities[p.code] ?? []).map((m) => option(p.code, m))}
                </optgroup>
              ))}
        </select>
      </label>
    </>
  );
}
