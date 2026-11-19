# ============================================================
# MICHIKEMBO — Preparar un modelo nuevo para el navegador
#
# Qué hace (en este orden, sin borrar nada):
#   1. Lee best.pt y muestra sus datos (clases, imgsz, nombre del experimento).
#   2. Lo exporta a ONNX (opset 12, sin NMS: el NMS lo hace el juego en JS).
#   3. Comprueba la forma de entrada/salida con ONNX Runtime.
#   4. Compara PyTorch contra ONNX en tus imágenes (misma clase principal).
#   5. Guarda imágenes 640x480 + resultados esperados para la prueba de Node
#      (tests/fixtures/modelo/, NO se suben a GitHub).
#   6. Si ya había un modelo en assets/models/michikembo/current/, lo copia
#      a assets/models/michikembo/anteriores/<version>/ antes de reemplazarlo.
#   7. Escribe current/model.onnx y current/manifest.json (sha256, tamaño,
#      clases, umbrales, revision+1, resultado de la equivalencia).
#
# Dónde se ejecuta: terminal de VS Code (Windows) en la raíz del repositorio,
# con un entorno de Python que tenga ultralytics y onnxruntime:
#   py -m pip install ultralytics onnx onnxruntime onnxslim
#   py scripts\preparar_modelo.py --pt C:\ruta\best.pt --version E4a-v2.2 --imagenes C:\ruta\fotos
# Guía completa: docs/COMO_CAMBIAR_MODELO.md
# ============================================================
import argparse
import datetime as dt
import hashlib
import json
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
DIR_MODELOS = RAIZ / "assets" / "models" / "michikembo"
DIR_ACTUAL = DIR_MODELOS / "current"
DIR_ANTERIORES = DIR_MODELOS / "anteriores"
DIR_FIXTURES = RAIZ / "tests" / "fixtures" / "modelo"
EXTENSIONES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def sha256(ruta: Path) -> str:
    """Huella SHA-256 del archivo (la misma que comprueba el navegador)."""
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def marco_webcam(img, ancho=640, alto=480, gris=110):
    """Encaja una imagen en un marco 640x480 (como una webcam) sin deformarla."""
    import cv2
    import numpy as np
    escala = min(ancho / img.shape[1], alto / img.shape[0])
    w, h = int(round(img.shape[1] * escala)), int(round(img.shape[0] * escala))
    peq = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
    marco = np.full((alto, ancho, 3), gris, np.uint8)
    x, y = (ancho - w) // 2, (alto - h) // 2
    marco[y:y + h, x:x + w] = peq
    return marco


def detecciones(resultado):
    """Pasa un resultado de Ultralytics a una lista sencilla (píxeles del marco)."""
    b = resultado.boxes
    return [
        {"clase": int(c), "confianza": round(float(p), 4), "xyxy": [round(float(v), 2) for v in xy]}
        for c, p, xy in zip(b.cls, b.conf, b.xyxy)
    ]


def main():
    ap = argparse.ArgumentParser(description="Prepara un best.pt para el juego web (ONNX + manifest.json).")
    ap.add_argument("--pt", required=True, help="ruta a best.pt")
    ap.add_argument("--version", required=True, help="identificador corto, p. ej. E3c-v2.1")
    ap.add_argument("--nombre", default=None, help="nombre legible (por defecto 'Michikembo <version>')")
    ap.add_argument("--imagenes", default=None, help="carpeta con fotos para comparar PyTorch y ONNX")
    ap.add_argument("--conf", type=float, default=0.20, help="umbral de confianza inicial (configurable)")
    ap.add_argument("--iou", type=float, default=0.45, help="umbral IoU del NMS")
    ap.add_argument("--estado", default="experimental", help="experimental | validado")
    ap.add_argument("--max-imagenes", type=int, default=40)
    ap.add_argument("--solo-verificar", action="store_true",
                    help="exporta y compara, pero NO toca assets/models/michikembo/current/")
    a = ap.parse_args()

    import cv2
    import numpy as np
    import onnxruntime as ort
    import torch
    from ultralytics import YOLO

    pt = Path(a.pt).resolve()
    if not pt.exists():
        sys.exit(f"No existe {pt}")

    # ---------- 1. Datos del checkpoint ----------
    ck = torch.load(pt, map_location="cpu", weights_only=False)
    targs = ck.get("train_args", {}) or {}
    modelo_pt = YOLO(str(pt))
    nombres = [modelo_pt.names[i] for i in sorted(modelo_pt.names)]
    imgsz = int(targs.get("imgsz", 640))
    print(f"[1] {pt.name}: clases={nombres} imgsz={imgsz} experimento={targs.get('name')}")
    print(f"    métricas guardadas en el checkpoint (validación durante el entrenamiento): {ck.get('train_metrics')}")

    # ---------- 2. Exportar ----------
    tmp = RAIZ / "tests" / "fixtures" / "_export"
    tmp.mkdir(parents=True, exist_ok=True)
    copia = tmp / "best.pt"
    shutil.copy2(pt, copia)  # se exporta una copia: el best.pt original no se toca
    onnx_path = Path(YOLO(str(copia)).export(format="onnx", imgsz=imgsz, opset=12, simplify=True,
                                              dynamic=False, nms=False))
    print(f"[2] ONNX exportado: {onnx_path} ({onnx_path.stat().st_size / 1e6:.1f} MB)")

    # ---------- 3. Forma de entrada y salida ----------
    ses = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    ent, sal = ses.get_inputs()[0], ses.get_outputs()[0]
    print(f"[3] entrada {ent.name}{ent.shape}  salida {sal.name}{sal.shape}")
    if list(ent.shape) != [1, 3, imgsz, imgsz] or sal.shape[1] != 4 + len(nombres):
        sys.exit("La forma del ONNX no es la esperada para YOLOv8 de detección. No se instala.")

    # ---------- 4 y 5. Equivalencia y fixtures ----------
    rutas = []
    if a.imagenes:
        rutas = sorted(p for p in Path(a.imagenes).rglob("*") if p.suffix.lower() in EXTENSIONES)[: a.max_imagenes]
    modelo_onnx = YOLO(str(onnx_path), task="detect")
    marcos = [(p.stem, marco_webcam(cv2.imread(str(p)))) for p in rutas]
    marcos.append(("vacio_gris", np.full((480, 640, 3), 180, np.uint8)))  # sin mano → debe dar []
    DIR_FIXTURES.mkdir(parents=True, exist_ok=True)
    esperado, acuerdo = [], 0
    for i, (nombre, marco) in enumerate(marcos):
        r_pt = detecciones(modelo_pt.predict(marco, conf=a.conf, iou=a.iou, verbose=False)[0])
        r_ox = detecciones(modelo_onnx.predict(marco, conf=a.conf, iou=a.iou, verbose=False)[0])
        top = lambda d: d[0]["clase"] if d else None
        acuerdo += top(r_pt) == top(r_ox)
        archivo = f"marco_{i:02d}.png"
        cv2.imwrite(str(DIR_FIXTURES / archivo), marco)
        esperado.append({"archivo": archivo, "origen": nombre, "pytorch": r_pt, "onnx": r_ox})
    total = len(marcos)
    print(f"[4] acuerdo de clase principal PyTorch vs ONNX: {acuerdo}/{total}")
    with open(DIR_FIXTURES / "esperado.json", "w", encoding="utf-8") as f:
        json.dump({"modelo_sha256": sha256(onnx_path), "conf": a.conf, "iou": a.iou,
                   "clases": nombres, "marcos": esperado}, f, indent=1, ensure_ascii=False)
    print(f"[5] fixtures en {DIR_FIXTURES} (no se suben a GitHub)")
    if acuerdo != total:
        print("    AVISO: hay desacuerdos. Revisa esperado.json antes de usar este modelo.")

    if a.solo_verificar:
        print("[6-7] --solo-verificar: no se modificó assets/models/michikembo/current/")
        return

    # ---------- 6. Respaldo del modelo anterior ----------
    revision_anterior = 0
    man_actual = DIR_ACTUAL / "manifest.json"
    if man_actual.exists():
        anterior = json.loads(man_actual.read_text(encoding="utf-8"))
        revision_anterior = int(anterior.get("revision", 0))
        destino = DIR_ANTERIORES / f"{anterior.get('version', 'sin_version')}_rev{revision_anterior}"
        if not destino.exists():
            shutil.copytree(DIR_ACTUAL, destino)
            print(f"[6] respaldo del modelo anterior en {destino}")
        else:
            print(f"[6] el respaldo {destino} ya existía, no se sobrescribe")

    # ---------- 7. Instalar ----------
    DIR_ACTUAL.mkdir(parents=True, exist_ok=True)
    shutil.copy2(onnx_path, DIR_ACTUAL / "model.onnx")
    manifiesto = {
        "modelName": a.nombre or f"Michikembo {a.version}",
        "version": a.version,
        "file": "model.onnx",
        "format": "yolov8-detect-onnx",
        "inputSize": imgsz,
        "classNames": nombres,
        "confidenceThreshold": a.conf,
        "iouThreshold": a.iou,
        "revision": revision_anterior + 1,
        "status": a.estado,
        "sha256": sha256(DIR_ACTUAL / "model.onnx"),
        "bytes": (DIR_ACTUAL / "model.onnx").stat().st_size,
        "sourcePt": {"file": pt.name, "sha256": sha256(pt), "experiment": targs.get("name")},
        "checkpointValMetrics": ck.get("train_metrics"),
        "equivalence": {"images": total, "topClassAgreement": acuerdo,
                        "note": "PyTorch vs ONNX (Ultralytics) sobre marcos 640x480"},
        "exportedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "notes": "Umbrales iniciales configurables, no validados con webcam.",
    }
    man_actual.write_text(json.dumps(manifiesto, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"[7] instalado: {DIR_ACTUAL / 'model.onnx'} revision {manifiesto['revision']}")
    print("    Siguiente: npm test  (comprueba carga, clases, sha256, equivalencia JS y 'Nada')")


if __name__ == "__main__":
    main()
