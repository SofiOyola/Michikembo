"""Ejecuta las celdas de código del notebook en un solo espacio de nombres, con ajustes de prueba."""
import json, sys, os, hashlib, traceback
from pathlib import Path
import matplotlib; matplotlib.use("Agg")
nb = json.load(open(sys.argv[1])); base = Path(os.environ["MICHIKEMBO_BASE"])
def display(o):
    if hasattr(o, "to_html"): o.to_html(); print(getattr(o, "data", o))
    else: print(o)
ns = {"display": display, "__name__": "__main__"}
zip14 = base/"datasets/Rock Paper Scissors SXSW.v14i.yolov8.zip"
OVR_CFG = f"""
import csv as _csv
from collections import Counter as _C
_f = list(_csv.DictReader(open(CARPETA_V21 / "manifiesto_v21.csv", encoding="utf-8-sig")))
TOTAL_V14 = len(_f)
ESPERADO_V21 = dict(_C(r["split_propuesto"] for r in _f))
TAM_V14 = {zip14.stat().st_size}
SHA_V14 = "{hashlib.sha256(zip14.read_bytes()).hexdigest()}"
PERMITIR_CPU = True
EXPORTAR_ONNX = {os.environ.get("ONNX","True")}
"""
OVR_EXP = """
COMUNES.update(epochs=int(os.environ.get("EPOCAS","2")), imgsz=96, batch=8, workers=0, patience=5)
for _e in EXPERIMENTOS_V21: _e["pesos"] = "yolov8n.pt" if _e["pesos"] == "yolov8m.pt" else _e["pesos"]
for _e in EXPERIMENTOS: _e["cambios"].pop("epochs", None); _e["cambios"].pop("patience", None)
"""
for i, c in enumerate(nb["cells"]):
    if c["cell_type"] != "code": continue
    src = "".join(c["source"])
    src = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith(("%", "!")))
    src = src.replace("IMAGENES_EVAL_POR_SPLIT = 341", "IMAGENES_EVAL_POR_SPLIT = int(os.environ.get('EVAL_N', '6'))")
    if os.environ.get("DATASET_TEST"): src = src.replace('DATASET = "v22"', f'DATASET = "{os.environ["DATASET_TEST"]}"')
    print(f"\n######## CELDA {i} ########", flush=True)
    try:
        exec(compile(src, f"celda_{i}", "exec"), ns)
    except Exception:
        traceback.print_exc(); print(f"FALLO EN CELDA {i}"); sys.exit(1)
    if "# @config" in src: exec(OVR_CFG, ns)
    if "# @experimentos" in src: exec(OVR_EXP, ns)
print("\nTODO OK")
