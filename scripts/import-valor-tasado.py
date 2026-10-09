"""
Importa la Estadística de Valor Tasado de la Vivienda (Ministerio de Vivienda y Agenda Urbana)
y genera data/valor-tasado/{municipios.json, provincias.json, _meta.json}.

Fuente oficial (boletín estadístico del Ministerio):
  Municipios de más de 25.000 habitantes (trimestral, €/m², por antigüedad):
    https://apps.fomento.gob.es/BoletinOnline2/sedal/35103500.XLS
  Comunidades autónomas y provincias (trimestral, €/m²):
    https://apps.fomento.gob.es/BoletinOnline2/sedal/35101000.XLS

Son valores medios de TASACIONES hipotecarias (no precios de anuncio ni de compraventa).

Uso:
    python scripts/import-valor-tasado.py <35103500.XLS> <35101000.XLS>

Requiere xlrd 2.x solo para este script (lectura de .XLS):  python -m pip install --user xlrd==2.0.1
"""
import json
import os
import re
import sys
from datetime import date

import xlrd

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "valor-tasado")
SOURCE = "Ministerio de Vivienda y Agenda Urbana · Estadística de valor tasado de la vivienda"
URL_MUNI = "https://apps.fomento.gob.es/BoletinOnline2/sedal/35103500.XLS"
URL_PROV = "https://apps.fomento.gob.es/BoletinOnline2/sedal/35101000.XLS"


def num(v):
    if isinstance(v, (int, float)):
        return round(float(v), 1)
    s = str(v).strip().replace(",", ".")
    try:
        return round(float(s), 1)
    except ValueError:
        return None  # "n.r" = no representativo


def quarter_from_sheet(name):
    m = re.match(r"T(\d)A(\d{4})", name.strip())
    return f"{m.group(2)}-T{m.group(1)}" if m else None


def import_municipios(path):
    book = xlrd.open_workbook(path)
    sheets = [(quarter_from_sheet(s.name), s) for s in book.sheets()]
    sheets = [x for x in sheets if x[0]]
    sheets.sort(key=lambda x: x[0])
    recent = sheets[-4:]  # último año: para tendencia y para cubrir trimestres «no representativos»
    out = {}
    for quarter, s in recent:
        header_row = None
        for r in range(min(40, s.nrows)):
            if str(s.cell_value(r, 1)).strip() == "Provincia":
                header_row = r
                break
        if header_row is None:
            raise SystemExit(f"No se encontró la cabecera en la hoja {s.name}")
        prov = ""
        for r in range(header_row + 3, s.nrows):
            row = s.row_values(r)
            if str(row[1]).strip():
                prov = str(row[1]).strip()
            muni = str(row[2]).strip()
            if not muni:
                continue
            key = f"{prov}|{muni}"
            entry = out.setdefault(key, {"provincia": prov, "municipio": muni, "trimestres": {}})
            entry["trimestres"][quarter] = {
                "hasta5": num(row[3]),
                "mas5": num(row[4]),
                "total": num(row[5]),
                "n": int(num(row[9]) or 0),
            }
    return list(out.values()), [q for q, _ in recent]


def import_provincias(path):
    book = xlrd.open_workbook(path)
    s = book.sheets()[-1]
    # Cabecera: fila con "Año AAAA" y fila con "1º".."4º"
    year_row = next(r for r in range(s.nrows) if any(str(c).strip().startswith("Año") for c in s.row_values(r)))
    q_row = year_row + 2
    cols = []
    year = None
    for c in range(2, s.ncols):
        y = str(s.cell_value(year_row, c)).strip()
        if y.startswith("Año"):
            year = y.split()[-1]
        q = re.match(r"(\d)", str(s.cell_value(q_row, c)).strip())
        if year and q:
            cols.append((c, f"{year}-T{q.group(1)}"))
    out = {}
    for r in range(q_row + 1, s.nrows):
        name = str(s.cell_value(r, 1)).strip()
        if not name or name.startswith("n.r"):
            continue
        series = {}
        for c, label in cols:
            v = num(s.cell_value(r, c))
            if v:
                series[label] = v
        if series:
            out[name] = series
    return out


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    os.makedirs(OUT, exist_ok=True)
    municipios, quarters = import_municipios(sys.argv[1])
    provincias = import_provincias(sys.argv[2])
    with open(os.path.join(OUT, "municipios.json"), "w", encoding="utf-8") as f:
        json.dump(municipios, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT, "provincias.json"), "w", encoding="utf-8") as f:
        json.dump(provincias, f, ensure_ascii=False, separators=(",", ":"))
    last_prov = max(q for serie in provincias.values() for q in serie)
    meta = {
        "source": SOURCE,
        "sourceUrlMunicipios": URL_MUNI,
        "sourceUrlProvincias": URL_PROV,
        "trimestresMunicipios": quarters,
        "ultimoTrimestreProvincias": last_prov,
        "importedAt": date.today().isoformat(),
        "notes": "Valor medio de tasación de vivienda libre (€/m²). Municipios de más de 25.000 habitantes; el resto, media provincial.",
    }
    with open(os.path.join(OUT, "_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"{len(municipios)} municipios ({quarters[-1]}), {len(provincias)} provincias/CCAA ({last_prov}) -> {OUT}")


if __name__ == "__main__":
    main()
