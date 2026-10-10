"""Importa el precio de las compraventas de vivienda REGISTRADAS por municipio de Cataluña.

Fuente: Generalitat de Catalunya · Departament de Territori, Habitatge i Transició Ecològica,
«Compravendes d'habitatges registrades i el preu de venda» (datos del Col·legi de Registradors).
Fichero trimestral por municipios (municipios de más de 2.000 habitantes):
https://habitatge.gencat.cat/ca/dades/indicadors_estadistiques/estadistiques_de_construccio_i_mercat_immobiliari/estadistica-de-les-compravendes/compravendes-habitatges-Catalunya/

Se usa la hoja «acumulado de 12 meses» más reciente (más compraventas → cifra más estable).
Uso:
    python -E -I scripts/import-gencat-compravendes.py              (descarga el año en curso o el anterior)
    python -E -I scripts/import-gencat-compravendes.py fichero.xlsx (usa un fichero ya descargado)
Requiere: openpyxl (pip install openpyxl==3.1.5). Genera data/gencat-compravendes/municipis.json
"""

import datetime
import json
import os
import re
import sys
import tempfile
import urllib.request

import openpyxl

BASE = (
    "https://habitatge.gencat.cat/web/.content/home/dades/estadistiques/01_Estadistiques_de_construccio_i_mercat_immobiliari/"
    "02_Compravenda_i_preu_de_venda/02_Compravendes_d_habitatges_registrades_i_el_preu_de_venda/{y}/Trimestrals_per_municipis_{y}.xlsx"
)
PAGE = "https://habitatge.gencat.cat/ca/dades/indicadors_estadistiques/estadistiques_de_construccio_i_mercat_immobiliari/estadistica-de-les-compravendes/compravendes-habitatges-Catalunya/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "gencat-compravendes", "municipis.json")


def download():
    year = datetime.date.today().year
    for y in (year, year - 1):
        url = BASE.format(y=y)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Fincalia360 import)"})
            with urllib.request.urlopen(req, timeout=300) as r:
                data = r.read()
            path = os.path.join(tempfile.gettempdir(), f"gencat_compravendes_{y}.xlsx")
            with open(path, "wb") as f:
                f.write(data)
            return path, url
        except Exception as e:  # noqa: BLE001
            print(f"No disponible {url}: {e}")
    raise SystemExit("No se ha podido descargar el fichero de la Generalitat.")


def num(v):
    if v is None or v == "":
        return None
    try:
        f = float(v)
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def main():
    if len(sys.argv) > 1:
        path, url = sys.argv[1], PAGE
    else:
        path, url = download()
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    # Hojas «XtYY_acum_1any» o «XtYYacum_1any»: la primera es la más reciente
    sheets = [ws for ws in wb.worksheets if re.search(r"acum_1any$", ws.title)]
    if not sheets:
        raise SystemExit("No se encuentra la hoja de 12 meses acumulados.")
    ws = sheets[0]
    rows = list(ws.iter_rows(values_only=True))
    period = str(rows[0][0]).strip()
    municipios = {}
    for r in rows:
        if not r or not isinstance(r[0], str) or not re.match(r"^\d{5}$", r[0].strip()):
            continue
        code, name = r[0].strip(), str(r[1]).strip()
        # Columnas: 2-5 nº compraventas (nuevo libre, nuevo protegido, usado, total); 7-10 superficie media;
        # 12-14 precio total (miles €: nuevo, usado, total); 16-18 €/m² construido medio (nuevo, usado, total)
        entry = {
            "nombre": name,
            "ventas": int(r[5] or 0),
            "ventasUsado": int(r[4] or 0),
            "ventasNuevo": int(r[2] or 0),
            "m2Nuevo": num(r[16]),
            "m2Usado": num(r[17]),
            "m2Total": num(r[18]),
            "superficieUsado": num(r[9]),
        }
        if entry["m2Total"]:
            municipios[code] = entry
    if len(municipios) < 200:
        raise SystemExit(f"Formato inesperado: solo {len(municipios)} municipios con precio.")
    data = {
        "meta": {
            "source": "Generalitat de Catalunya · Compravendes d'habitatges registrades i preu de venda (Col·legi de Registradors)",
            "sourceUrl": PAGE,
            "fileUrl": url,
            "period": period,
            "importedAt": datetime.date.today().isoformat(),
            "notes": "Precio medio por m² construido de las compraventas inscritas en el Registro de la Propiedad en los últimos 12 meses. Municipios de más de 2.000 habitantes.",
        },
        "municipios": municipios,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(municipios)} municipios ({period}) guardados en {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
