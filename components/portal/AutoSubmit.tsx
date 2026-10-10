"use client";
// Con JavaScript, el buscador se actualiza al cambiar cualquier desplegable o casilla (sin pulsar «Buscar»).
// Sin JavaScript sigue funcionando con el botón.
import { useEffect, useRef } from "react";

export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onChange = (e: Event) => {
      // Después de que React actualice los campos dependientes (p. ej. vaciar el municipio al cambiar de provincia)
      const t = e.target;
      if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type === "checkbox")) setTimeout(() => form.requestSubmit(), 0);
    };
    // La URL solo lleva los filtros elegidos (sin «zona=&tipo=&…» vacíos)
    const onSubmit = () => {
      const empty = [...form.elements].filter((el): el is HTMLInputElement | HTMLSelectElement => (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el.name !== "" && el.value === "" && !el.disabled);
      empty.forEach((el) => (el.disabled = true));
      setTimeout(() => empty.forEach((el) => (el.disabled = false)), 0);
    };
    form.addEventListener("change", onChange);
    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("change", onChange);
      form.removeEventListener("submit", onSubmit);
    };
  }, []);
  return <span ref={ref} hidden />;
}
