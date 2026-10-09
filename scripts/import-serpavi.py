"""
Importa la base de datos oficial SERPAVI (Ministerio de Vivienda y Agenda Urbana)
y genera ficheros JSON compactos por provincia en data/serpavi/<CPRO>.json.

Fuente: https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/serpavi
Fichero: "bd_SERPAVI_2011-2024" (xlsx, hoja "Municipios").

Uso (solo Python estándar, sin dependencias):
    python scripts/import-serpavi.py <ruta-al-xlsx> [--desde 2015]

Campos usados por año (sufijo _AA) y tipología (VC = vivienda colectiva, VU = unifamiliar):
    BI_ALVHEPCO_T{VC|VU}   nº de inmuebles con alquiler de vivienda habitual
    ALQM2_LV_{M|25|75}_    alquiler mensual €/m² (mediana, P25, P75)
    SLVM2_M_               superficie mediana m²
Son rentas DECLARADAS en fuentes tributarias (no precios de anuncio).
"""
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import date

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def col_to_idx(ref):
    letters = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    path = sys.argv[1]
    since = 2015
    if "--desde" in sys.argv:
        since = int(sys.argv[sys.argv.index("--desde") + 1])

    z = zipfile.ZipFile(path)
    names = {}
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rel_target = {r.get("Id"): r.get("Target") for r in rels}
    for s in wb.iter(NS + "sheet"):
        rid = s.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        names[s.get("name")] = "xl/" + rel_target[rid].lstrip("/").replace("xl/", "")
    sheet = names["Municipios"]

    shared = []
    for _, el in ET.iterparse(z.open("xl/sharedStrings.xml")):
        if el.tag == NS + "si":
            shared.append("".join(t.text or "" for t in el.iter(NS + "t")))
            el.clear()

    header = None
    out = {}
    for _, el in ET.iterparse(z.open(sheet)):
        if el.tag != NS + "row":
            continue
        cells = {}
        for c in el.findall(NS + "c"):
            v = c.find(NS + "v")
            if v is None:
                continue
            val = shared[int(v.text)] if c.get("t") == "s" else v.text
            cells[col_to_idx(c.get("r"))] = val
        el.clear()
        if header is None:
            header = {i: name for i, name in cells.items()}
            continue
        row = {header[i]: v for i, v in cells.items() if i in header}
        cpro, cumun, nmun = row.get("CPRO"), row.get("CUMUN"), row.get("NMUN")
        if not cumun:
            continue
        years = {}
        for yy in range(since % 100, 100):
            year = 2000 + yy
            entry = {}
            for t in ("VC", "VU"):
                m = num(row.get(f"ALQM2_LV_M_{t}_{yy:02d}"))
                if m is None:
                    continue
                p25 = num(row.get(f"ALQM2_LV_25_{t}_{yy:02d}"))
                p75 = num(row.get(f"ALQM2_LV_75_{t}_{yy:02d}"))
                entry[t] = {
                    "n": int(num(row.get(f"BI_ALVHEPCO_T{t}_{yy:02d}")) or 0),
                    "m": round(m, 2),
                    "p25": round(p25 if p25 is not None else m, 2),
                    "p75": round(p75 if p75 is not None else m, 2),
                    "sup": round(num(row.get(f"SLVM2_M_{t}_{yy:02d}")) or 0, 1),
                }
            if entry:
                years[str(year)] = entry
        if not years:
            continue
        prov = out.setdefault(cpro.zfill(2), {})
        prov[cumun.zfill(5)] = {"name": nmun, "years": years}

    target = os.path.join(os.path.dirname(__file__), "..", "data", "serpavi")
    os.makedirs(target, exist_ok=True)
    meta = {
        "source": "Sistema Estatal de Referencia del Precio del Alquiler de Vivienda (SERPAVI), Ministerio de Vivienda y Agenda Urbana",
        "sourceUrl": "https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/serpavi",
        "file": os.path.basename(path),
        "importedAt": date.today().isoformat(),
        "notes": "Rentas declaradas (Modelo 100) de vivienda habitual en alquiler. VC = vivienda colectiva, VU = unifamiliar. Valores €/m² mensuales.",
    }
    total = 0
    for cpro, munis in out.items():
        with open(os.path.join(target, f"{cpro}.json"), "w", encoding="utf-8") as f:
            json.dump({"meta": meta, "municipios": munis}, f, ensure_ascii=False, separators=(",", ":"))
        total += len(munis)
    with open(os.path.join(target, "_meta.json"), "w", encoding="utf-8") as f:
        json.dump({**meta, "provincias": len(out), "municipios": total}, f, ensure_ascii=False, indent=2)
    print(f"SERPAVI: {total} municipios en {len(out)} provincias -> {os.path.abspath(target)}")


if __name__ == "__main__":
    main()
