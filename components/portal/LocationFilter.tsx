"use client";
// Provincia → municipio del buscador. Muestra todos los municipios oficiales de la provincia elegida
// (o de toda Cataluña agrupados por provincia) y cuántos anuncios hay en cada uno.
import { useState } from "react";
import type { PortalLocations } from "@/services/listings/portalLocations";

export function LocationFilter({
  locations,
  province: initialProvince,
  municipality: initialMunicipality,
  t,
}: {
  locations: PortalLocations;
  province?: string;
  municipality?: string;
  t: { province: string; allCatalonia: string; municipality: string; all: string; allCatalonia2: string };
}) {
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
        <span className="field-label">{t.province}</span>
        <select
          name="provincia"
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            if (e.target.value && municipality && !municipalities[e.target.value]?.includes(municipality)) setMunicipality("");
          }}
          className="field"
        >
          <option value="">{t.allCatalonia}</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="field-label">{t.municipality}</span>
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
          <option value="">{province ? t.all : t.allCatalonia2}</option>
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
