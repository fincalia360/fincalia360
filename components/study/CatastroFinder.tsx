"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { CatastroProperty, CatastroStreet, CatastroUnit } from "@/services/study/sources/catastro";

/**
 * Búsqueda de la vivienda en el Catastro por dirección: calle → número → inmueble.
 * Al elegir el inmueble se consulta su ficha (referencia catastral, superficie, año, planta…).
 */
export function CatastroFinder({ municipalityCode, onIdentified }: { municipalityCode: string; onIdentified: (p: CatastroProperty) => void }) {
  const [query, setQuery] = useState("");
  const [streets, setStreets] = useState<CatastroStreet[] | null>(null);
  const [street, setStreet] = useState<CatastroStreet | null>(null);
  const [number, setNumber] = useState("");
  const [units, setUnits] = useState<CatastroUnit[] | null>(null);
  const [nearby, setNearby] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "streets" | "units" | "detail">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Si cambia el municipio, se reinicia la búsqueda
  useEffect(() => {
    setQuery("");
    setStreets(null);
    setStreet(null);
    setNumber("");
    setUnits(null);
    setSelected(null);
    setMessage(null);
  }, [municipalityCode]);

  // Sugerencias de calles (con espera para no consultar en cada tecla)
  useEffect(() => {
    if (street || query.trim().length < 3) {
      setStreets(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("streets");
      try {
        const res = await fetch(`/api/estudio/catastro/calles?municipio=${municipalityCode}&q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setStreets(data.streets);
        setMessage(data.streets.length ? null : "No encontramos esa calle en el Catastro de este municipio. Prueba con otra parte del nombre.");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setMessage((error as Error).message || "No se pudo consultar el Catastro.");
      } finally {
        setStatus("idle");
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, street, municipalityCode]);

  async function findUnits(n = number) {
    if (!street) return;
    setStatus("units");
    setMessage(null);
    setUnits(null);
    setNearby([]);
    setSelected(null);
    setShowAll(false);
    try {
      const res = await fetch(`/api/estudio/catastro/inmuebles?municipio=${municipalityCode}&tipo=${street.type}&via=${encodeURIComponent(street.name)}&numero=${encodeURIComponent(n)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUnits(data.units);
      setNearby(data.nearbyNumbers ?? []);
      setMessage(data.message);
      // Si solo hay un inmueble (casa), se identifica directamente
      if (data.units.length === 1) void choose(data.units[0].cadastralRef);
    } catch (error) {
      setMessage((error as Error).message || "No se pudo consultar el Catastro.");
    } finally {
      setStatus("idle");
    }
  }

  async function choose(rc: string) {
    setSelected(rc);
    setStatus("detail");
    setMessage(null);
    try {
      const res = await fetch(`/api/estudio/catastro?rc=${encodeURIComponent(rc)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onIdentified(data as CatastroProperty);
    } catch (error) {
      setMessage((error as Error).message || "No se pudo consultar el Catastro.");
      setSelected(null);
    } finally {
      setStatus("idle");
    }
  }

  const residential = units?.filter((u) => u.use === "Residencial") ?? [];
  const visible = showAll || residential.length === 0 ? (units ?? []) : residential;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
        <div className="relative">
          <label htmlFor="cat-street" className="field-label">
            Calle
          </label>
          <input
            id="cat-street"
            className="field"
            autoComplete="off"
            placeholder="Ej.: Alcalá, Mayor, Rambla…"
            value={street ? street.label : query}
            onChange={(e) => {
              setStreet(null);
              setUnits(null);
              setQuery(e.target.value);
            }}
            aria-autocomplete="list"
            aria-controls="cat-street-list"
          />
          {status === "streets" && <Loader2 className="absolute right-3 top-[38px] h-4 w-4 animate-spin text-ink-300" />}
          {!street && streets && streets.length > 0 && (
            <ul id="cat-street-list" role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-sand-200 bg-white py-1 shadow-soft">
              {streets.map((s) => (
                <li key={`${s.type}-${s.name}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="block w-full px-3 py-2 text-left text-sm text-ink-700 hover:bg-sand-50"
                    onClick={() => {
                      setStreet(s);
                      setStreets(null);
                      setMessage(null);
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label htmlFor="cat-number" className="field-label">
            Número
          </label>
          <input
            id="cat-number"
            className="field"
            inputMode="numeric"
            maxLength={4}
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void findUnits();
              }
            }}
          />
        </div>
        <Button type="button" variant="primary" className="h-[42px] rounded-lg" disabled={!street || !number || status === "units"} onClick={() => findUnits()}>
          {status === "units" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
        </Button>
      </div>

      {message && <p className="text-sm text-amber-700">{message}</p>}
      {nearby.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
          Números cercanos en el Catastro:
          {nearby.map((n) => (
            <button
              key={n}
              type="button"
              className="rounded-full border border-sand-300 bg-white px-2.5 py-0.5 text-[13px] hover:border-terracotta-400"
              onClick={() => {
                setNumber(n);
                void findUnits(n);
              }}
            >
              {n}
            </button>
          ))}
        </p>
      )}

      {units && units.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink-700">
            {residential.length > 0 ? `Elige tu vivienda (${residential.length} viviendas en este número)` : `Elige el inmueble (${units.length})`}
          </p>
          <ul className="grid max-h-72 gap-1.5 overflow-auto pr-1 sm:grid-cols-2">
            {visible.map((u) => (
              <li key={u.cadastralRef}>
                <button
                  type="button"
                  onClick={() => choose(u.cadastralRef)}
                  disabled={status === "detail"}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition",
                    selected === u.cadastralRef ? "border-terracotta-500 ring-2 ring-terracotta-100" : "border-sand-200 hover:border-ink-300",
                  )}
                >
                  {u.use === "Residencial" ? <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-500" /> : <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />}
                  <span>
                    <span className="block font-medium text-ink-800">{u.label}</span>
                    <span className="block text-xs text-ink-400">
                      {u.use}
                      {u.builtSqm ? ` · ${u.builtSqm} m²` : ""}
                      {u.yearBuilt ? ` · ${u.yearBuilt}` : ""}
                    </span>
                  </span>
                  {selected === u.cadastralRef && status === "detail" && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                </button>
              </li>
            ))}
          </ul>
          {residential.length > 0 && residential.length < units.length && (
            <button type="button" className="mt-2 text-xs text-ink-500 underline" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Ver solo viviendas" : `Ver también locales, garajes y trasteros (${units.length - residential.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
