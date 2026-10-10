"""Importa el tipo de gravamen de la plusvalía municipal (IIVTNU) de cada ayuntamiento.

Fuente: Ministerio de Hacienda · «Consulta de información impositiva municipal»
(https://serviciostelematicosext.hacienda.gob.es/SGFAL/ConsultaTipos/html/portadaconsultasm.aspx),
exportación de todos los municipios. Desde 2022 Hacienda ya no publica este dato (la columna sale a cero
tras la reforma del RDL 26/2021), así que se usa el último ejercicio con datos: 2021.
Cada ayuntamiento puede haberlo cambiado después: el estudio lo indica y permite modificarlo.

Uso:
    python -E -I scripts/import-plusvalia.py                 (descarga el fichero)
    python -E -I scripts/import-plusvalia.py ruta/fichero    (usa un fichero ya descargado)
Genera data/plusvalia/tipos-iivtnu.json
"""

import datetime
import html
import json
import os
import re
import sys
import urllib.request

YEAR = 2021
URL = f"https://serviciostelematicosext.hacienda.gob.es/SGFAL/ConsultaTipos/aspx/ImpuestosExcel.aspx?provincia=TODAS&anosel={YEAR}"
PORTAL = "https://serviciostelematicosext.hacienda.gob.es/SGFAL/ConsultaTipos/html/portadaconsultasm.aspx"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "plusvalia", "tipos-iivtnu.json")


def load(path):
    if path:
        with open(path, encoding="utf-8", errors="ignore") as f:
            return f.read()
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Fincalia360 import)"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read().decode("utf-8", errors="ignore")


def num(text):
    text = text.strip().replace(".", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def main():
    raw = load(sys.argv[1] if len(sys.argv) > 1 else None)
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", raw, re.S)
    header = None
    municipios = {}
    total = 0
    for r in rows:
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S)]
        if cells and cells[0].startswith("CCAA"):
            header = cells
            continue
        if not header or len(cells) != len(header) + 3:
            continue
        code = cells[0]
        m = re.match(r"^\d{2}-(\d{2})-(\d{3})$", code)
        if not m:
            continue
        # Columnas de datos = cabecera desplazada 3 posiciones (nombre, provincia y población)
        total += 1
        col = {h: cells[i + 3] if i > 0 else cells[0] for i, h in enumerate(header)}
        rates = [num(col.get(f"Tipo hasta {y} años", "")) for y in (5, 10, 15, 20)]
        if not any(rates):
            # Tipo 0 o sin dato: impuesto no establecido o no comunicado a Hacienda (no se guarda)
            continue
        municipios[m.group(1) + m.group(2)] = {"nombre": cells[1], "tipos": rates}
    if total < 7000 or len(municipios) < 3000:
        raise SystemExit(f"Formato inesperado: {total} municipios leídos, {len(municipios)} con tipo.")
    data = {
        "meta": {
            "source": f"Ministerio de Hacienda · Consulta de información impositiva municipal (ejercicio {YEAR})",
            "sourceUrl": PORTAL,
            "year": YEAR,
            "importedAt": datetime.date.today().isoformat(),
            "notes": "Tipo de gravamen del IIVTNU por periodo de generación (hasta 5, 10, 15 y 20 años). Último ejercicio publicado por Hacienda; "
            "el ayuntamiento puede haberlo modificado después (consulta su ordenanza fiscal vigente).",
        },
        "municipios": municipios,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{total} municipios leídos; {len(municipios)} con tipo de plusvalía guardados en {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
