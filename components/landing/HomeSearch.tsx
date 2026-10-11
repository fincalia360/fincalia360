"use client";
// Buscador principal de la portada: Comprar / Alquilar, tipo de inmueble, población y precio máximo.
// Es un formulario GET a /buscar (funciona también sin JavaScript); con JavaScript, los precios se
// adaptan a venta o alquiler.
import { useState } from "react";
import { Search } from "lucide-react";
import { PROPERTY_GROUPS } from "@/services/listings/catalog";
import type { PortalDict } from "@/lib/i18n/portal/es";

const PRICES = {
  SALE: [100000, 150000, 200000, 250000, 300000, 400000, 500000, 750000, 1000000],
  RENT: [500, 700, 900, 1200, 1500, 2000, 3000],
};

export function HomeSearch({ cities, t, groups, locale }: { cities: string[]; t: PortalDict["search"]; groups: PortalDict["groups"]; locale: string }) {
  const [op, setOp] = useState<"SALE" | "RENT">("SALE");
  const eur = (n: number) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n)} €`;
  return (
    <form action="/buscar" method="get" role="search" aria-label={t.aria} className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-sand-200">
      {/* Comprar / Alquilar: la diferencia es lo primero que se ve */}
      <fieldset className="grid grid-cols-2 border-b border-sand-200">
        <legend className="sr-only">{t.operation}</legend>
        {(
          [
            ["SALE", t.buy],
            ["RENT", t.rent],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={`relative cursor-pointer py-3.5 text-center text-[15px] font-semibold transition focus-within:ring-2 focus-within:ring-inset focus-within:ring-terracotta-500 sm:py-4 sm:text-base ${
              op === value ? "bg-white text-ink-800" : "bg-sand-100 text-ink-500 hover:text-ink-800"
            }`}
          >
            <input type="radio" name="op" value={value} checked={op === value} onChange={() => setOp(value)} className="sr-only" />
            {label}
            {op === value && <span aria-hidden className="absolute inset-x-6 bottom-0 h-[3px] rounded-full bg-terracotta-500" />}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1.1fr_1.2fr_0.9fr_auto] lg:items-end">
        <label className="block">
          <span className="field-label">{t.type}</span>
          <select name="grupo" defaultValue="" className="field h-12">
            <option value="">{t.allTypes}</option>
            {Object.keys(PROPERTY_GROUPS).map((k) => (
              <option key={k} value={k}>
                {groups[k as keyof typeof groups]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">{t.town}</span>
          <input name="municipio" list="poblaciones-portal" maxLength={80} placeholder={t.townPlaceholder} autoComplete="off" className="field h-12" />
          <datalist id="poblaciones-portal">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="field-label">{t.maxPrice}</span>
          <select key={op} name="max" defaultValue="" className="field h-12">
            <option value="">{t.noLimit}</option>
            {PRICES[op].map((v) => (
              <option key={v} value={v}>
                {op === "RENT" ? `${eur(v)}${t.perMonth}` : eur(v)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-terracotta-500 px-7 text-base font-semibold text-white transition hover:bg-terracotta-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-500 sm:col-span-2 lg:col-span-1"
        >
          <Search className="h-5 w-5" /> {t.submit}
        </button>
      </div>
    </form>
  );
}
