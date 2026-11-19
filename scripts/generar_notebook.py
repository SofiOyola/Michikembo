"""Genera notebooks/Michikembo_entrenamiento_organizado.ipynb."""
import json
import sys
from pathlib import Path

CELDAS = []


def md(texto):
    CELDAS.append(("markdown", texto.strip("\n")))


def code(texto):
    CELDAS.append(("code", texto.strip("\n")))


# =====================================================================
# 00. PORTADA
# =====================================================================
md(r'''
# 🐱✊✋✌️ Michikembo — Entrenamiento organizado del detector de gestos

**Proyecto:** Michikembo (en Drive y en los datasets histórico se llama *Michikenbo*).
**Objetivo de este notebook:** construir el dataset de entrenamiento (v2.2 por defecto), entrenar y comparar detectores YOLO de **piedra, papel y tijera**, elegir el mejor modelo con criterios honestos, evaluarlo y dejarlo listo para el juego.
**Versión del notebook:** 1.1 (19/11/2026, hora de Colombia).

> ### Novedades de la versión 1.1
> La primera ejecución completa (v2.1) se estancó en **mAP@50 ≈ 0,63** con cualquier modelo. El diagnóstico (capítulo 04b) muestra que validación y test eran **≈ 64 % fotogramas de video**, mientras train tenía **≈ 2 %**. Esta versión crea el **dataset v2.2**, con validación y test estratificados por fuente, y entrena dos experimentos nuevos (E4a y E4b). Los resultados de v2.1 quedan intactos en Drive y se pueden revisar poniendo `DATASET = "v21"`.

---

## Cómo usar este notebook

1. Abre el menú **Entorno de ejecución → Cambiar tipo de entorno** y elige **GPU T4**.
2. Revisa la celda de **interruptores** del capítulo 01 (por defecto ya está lista para ejecutarlo todo).
3. Pulsa **Entorno de ejecución → Ejecutar todas**.
4. Si Colab se desconecta, vuelve a pulsar **Ejecutar todas**. Cada paso revisa lo que ya existe en Drive y **retoma donde se quedó**:
   - el manifiesto v2.2 se crea una sola vez,
   - el ZIP del dataset no se reconstruye si ya existe y su huella SHA-256 coincide,
   - un experimento terminado nunca se vuelve a entrenar,
   - un experimento interrumpido continúa desde su último checkpoint (`last.pt`),
   - las métricas ya calculadas se leen de Drive en lugar de recalcularse.

> ⏱️ **Tiempo estimado:** el entrenamiento completo de los cinco experimentos puede tardar varias horas en una T4. Colab gratuito suele cortar la sesión antes. No pasa nada: al reconectar y volver a ejecutar todo, se continúa desde el punto guardado.

## Mapa de capítulos

| Capítulo | Qué hace | Salida principal en Drive |
|---|---|---|
| 01. Entorno y configuración | Instala dependencias, define interruptores, rutas y constantes | — |
| 02. Persistencia en Drive | Monta Drive y comprueba lectura y escritura | `documentacion/notebook_v22/` |
| 03. Utilidades y registro del entorno | Funciones comunes, versiones, GPU y semillas | `entorno.json` |
| 04. Inventario y huellas | Verifica ZIP v14, ZIP v1 y manifiesto v2.1 | `inventario.json` |
| 04b. Dataset v2.2 | Diagnóstico de v2.1 y reparto estratificado por fuente | `documentacion/propuesta_v22/` |
| 05. Trazabilidad de datos | Resume auditorías, fugas, cuarentena y distribución | figuras |
| 06. Construcción y validación del dataset | Crea el ZIP del dataset activo solo si hace falta y lo valida a fondo | `datasets/michikenbo_dataset_v22.zip` |
| 07. Diagnósticos visuales | Muestras con cajas, tamaños, posiciones y fuentes | figuras |
| 08. Plan experimental | Hipótesis de cada experimento | `plan_experimental.json` |
| 09. Entrenamiento | B1 y experimentos E3, reanudables | `experiments/v21/<nombre>/` |
| 10. Métricas y comparación | Validación global y por clase, curvas, sobreajuste, latencia | `comparacion_experimentos.csv` |
| 11. Selección responsable | Elige el modelo por validación y calibra el umbral del juego | `seleccion.json`, `config_inferencia.json` |
| 12. Test interno y evaluación externa | Evaluación final, una sola vez | `test_interno_evaluado.json` |
| 13. Exportación ONNX | Exporta y comprueba equivalencia con el `.pt` | `models/v21/` |
| 14. Prueba de webcam | Ráfagas de cámara en Colab y script local para Windows | `webcam_local.py` |
| 15. Publicación de artefactos | Reúne pesos, métricas y hashes | `publicacion/v21/` |
| 16. Estado y reanudación | Escribe `ESTADO_ACTUAL.md` automáticamente | `ESTADO_ACTUAL.md` |

## Sobre la meta del 90 %

Queremos **Precision, Recall y mAP@50 superiores al 90 %**, pero el notebook **no lo garantiza ni lo fuerza**. Hay tres razones para ser prudentes:

- Con el dataset v1, el mejor experimento (E2) obtuvo **mAP@50 de 59,7 %** en validación, con buena precisión (88 %) pero **recall bajo (48 %)**: el modelo se perdía muchas manos.
- La validación v2.1 era **más estricta** que la de v1, porque se eliminaron las fugas visuales, y además resultó **desequilibrada por fuente** (capítulo 04b). v2.2 mantiene la regla anti-fugas y corrige ese desequilibrio.
- Las métricas de detección (mAP) miden cajas. El juego necesita otra cosa: **decidir bien el gesto** de una mano cercana a la cámara. Por eso este notebook mide también la **exactitud de decisión del juego**, que es la que más se parece a la experiencia real.

**Cómo se evita el sobreajuste y el autoengaño:**

- El modelo se elige **solo con la validación**. El test interno se usa **una vez**, al final, con el modelo ya elegido.
- Se mide la **brecha entre train y validación** y se marca cualquier experimento con brecha excesiva.
- Las curvas de pérdida de entrenamiento y validación se grafican para cada experimento.
- La parada temprana (`patience`) detiene el entrenamiento cuando la validación deja de mejorar.
- Las métricas de train nunca se presentan como resultado.
''')

# =====================================================================
# 01. ENTORNO Y CONFIGURACIÓN
# =====================================================================
md(r'''
---
# 01. Entorno y configuración

**Objetivo:** instalar las dependencias con versiones fijas y definir en **un solo lugar** los interruptores, las rutas y las constantes del proyecto.

**Dónde se ejecuta:** Google Colab.

**Qué comprobar:** que la instalación termine sin errores. La versión de Ultralytics es la misma que se usó en los experimentos anteriores (8.4.215).
''')

code(r'''
# Instalar las librerías con versiones fijas para poder reproducir los resultados.
# - ultralytics: entrenamiento y evaluación de YOLO.
# - onnx, onnxruntime y onnxslim: exportación y verificación del modelo ONNX.
%pip install -q ultralytics==8.4.215 onnx onnxruntime onnxslim
''')

md(r'''
### Interruptores, rutas y constantes

Esta es la **única celda que normalmente tendrías que tocar**.

- `ENTRENAR = True` permite entrenar los experimentos **pendientes**. Los experimentos terminados nunca se repiten, así que «Ejecutar todas» es seguro. Si solo quieres revisar resultados sin gastar GPU, ponlo en `False`.
- `DATASET = "v22"` usa el reparto nuevo. Con `"v21"` vuelves a ver los resultados anteriores sin entrenar nada nuevo.
- `EXPERIMENTOS_ACTIVOS = None` entrena todos los experimentos del dataset elegido. Puedes poner, por ejemplo, `["E4a"]` para ahorrar tiempo.
- `PROBAR_WEBCAM` y `CAPTURAR_EXTERNO` abren la cámara y esperan que hagas gestos, por eso están en `False`. Actívalos cuando estés frente al computador.
- `FORZAR_TEST_NUEVO` debe quedarse en `False`. Solo sirve si conscientemente quieres evaluar en test un modelo distinto al que ya se evaluó, lo cual debilita la honestidad de esa prueba.
''')

code(r'''
# @config
# Importar herramientas para manejar rutas y detectar el entorno.
from pathlib import Path
import os
import sys

# Detectar si estamos dentro de Google Colab.
try:
    import google.colab  # noqa: F401
    EN_COLAB = True
except ImportError:
    EN_COLAB = False

# ---------------------------------------------------------------------
# INTERRUPTORES
# ---------------------------------------------------------------------
DATASET = "v22"              # "v22" = reparto estratificado por fuente (recomendado).
                             # "v21" = revisar los resultados anteriores sin tocarlos.
ENTRENAR = True              # Entrena solo los experimentos pendientes o interrumpidos.
EXPERIMENTOS_ACTIVOS = None  # None = todos los del dataset elegido. Ej.: ["E4a"] para ahorrar tiempo.
PERMITIR_CPU = False         # Entrenar sin GPU sería lentísimo. Déjalo en False en Colab.
EVALUAR_TEST = True          # Evalúa en test interno el modelo elegido (una sola vez).
EXPORTAR_ONNX = True         # Exporta el modelo elegido a ONNX y lo verifica.
PROBAR_WEBCAM = False        # Abre la cámara en Colab para probar rondas reales.
CAPTURAR_EXTERNO = False     # Abre la cámara para fotografiar el conjunto externo.
FORZAR_TEST_NUEVO = False    # Nunca lo actives sin una razón documentada.

# ---------------------------------------------------------------------
# CARPETAS BASE
# ---------------------------------------------------------------------
# En Colab todo lo persistente vive en Drive. Fuera de Colab se puede
# indicar otra carpeta con la variable de entorno MICHIKEMBO_BASE.
if EN_COLAB:
    BASE = Path("/content/drive/MyDrive/Michikenbo")
    TRABAJO = Path("/content/michikembo_trabajo")   # Copia rápida, se puede reconstruir.
else:
    BASE = Path(os.environ.get("MICHIKEMBO_BASE", "Michikenbo_local")).resolve()
    TRABAJO = Path(os.environ.get("MICHIKEMBO_TRABAJO", "michikembo_trabajo")).resolve()

# Carpeta de la propuesta v2.1 confirmada en la sesión anterior.
CARPETA_V21 = BASE / "documentacion/E3_propuesta_v21_20261118_004525"

# Todas las rutas del proyecto se definen aquí y en ningún otro lugar.
RUTAS = {
    # Datos de entrada.
    "zip_v14": BASE / "datasets/Rock Paper Scissors SXSW.v14i.yolov8.zip",
    "zip_v1": BASE / "datasets/michikenbo_70_15_15_v1.zip",
    "manifiesto_v21": CARPETA_V21 / "manifiesto_v21.csv",
    "evidencias_v21": CARPETA_V21 / "evidencias_cuarentena.csv",
    "config_v21": CARPETA_V21 / "configuracion.json",
    "e2_best": BASE / "experiments/E2_yolov8n_sin_mosaico/weights/best.pt",
    # Propuesta v2.2 (se crea una vez y luego solo se lee).
    "carpeta_v22": BASE / "documentacion/propuesta_v22",
    "manifiesto_v22": BASE / "documentacion/propuesta_v22/manifiesto_v22.csv",
    # Dataset activo que construye este notebook.
    "zip_ds": BASE / f"datasets/michikenbo_dataset_{DATASET}.zip",
    "sha_ds": BASE / f"datasets/michikenbo_dataset_{DATASET}.sha256",
    "partial_ds": BASE / f"datasets/.michikenbo_dataset_{DATASET}.zip.partial",
    # Resultados persistentes, separados por versión del dataset.
    "experimentos": BASE / f"experiments/{DATASET}",
    "modelos": BASE / f"models/{DATASET}",
    "informes": BASE / f"documentacion/notebook_{DATASET}",
    "figuras": BASE / f"documentacion/notebook_{DATASET}/figuras",
    "bitacora": BASE / f"documentacion/notebook_{DATASET}/bitacora",
    "configs": BASE / f"documentacion/notebook_{DATASET}/configs",
    "externo": BASE / "datasets/externo_v1",
    "publicacion": BASE / f"publicacion/{DATASET}",
    # Copias de trabajo locales (se pueden borrar y reconstruir).
    "construccion": TRABAJO / "construccion",
    "dataset_local": TRABAJO / f"datasets/michikenbo_{DATASET}",
}
assert DATASET in ("v21", "v22"), "DATASET debe ser 'v21' o 'v22'."

# ---------------------------------------------------------------------
# CONSTANTES VERIFICADAS EN SESIONES ANTERIORES
# ---------------------------------------------------------------------
SHA_V14 = "3e33ae031c752bded24b4486d3d0118e428cd4cbcab9891d5289d21649894905"
TAM_V14 = 238_134_549
TOTAL_V14 = 7335
ESPERADO_V21 = {"train": 3446, "valid": 341, "test": 341, "excluida": 3207}
CLASES = ["Paper", "Rock", "Scissors"]   # 0=Paper, 1=Rock, 2=Scissors
CLASES_JUEGO = CLASES + ["Nada"]          # "Nada" = ningún gesto detectado.
SEMILLA = 42
ZONA_HORARIA = "America/Bogota"

# Brecha máxima aceptable entre mAP@50 de train y de validación.
# Si se supera, el experimento queda marcado como posible sobreajuste.
BRECHA_MAXIMA = 0.15

# Meta aspiracional, solo para dibujarla en las gráficas.
META = 0.90

print("Dataset activo:", DATASET)
print("Entorno Colab:", EN_COLAB)
print("Carpeta base:", BASE)
print("Carpeta de trabajo:", TRABAJO)
print("Entrenar pendientes:", ENTRENAR)
print("Experimentos activos:", EXPERIMENTOS_ACTIVOS)
''')

# =====================================================================
# 02. DRIVE
# =====================================================================
md(r'''
---
# 02. Persistencia en Google Drive

**Objetivo:** montar Drive y comprobar que se puede **leer y escribir** en `MyDrive/Michikenbo` antes de hacer cualquier cosa costosa.

**Por qué es obligatorio:** los pesos de B0 y E1 se perdieron porque Colab se reinició antes de respaldarlos. Aquí, si Drive falla, el notebook se detiene en lugar de entrenar sin respaldo.

**Si falla:** vuelve a ejecutar la celda y acepta los permisos de Google. Si la carpeta `Michikenbo` no aparece, revisa que estés usando la misma cuenta de Google de las sesiones anteriores.
''')

code(r'''
# Montar Google Drive solo cuando estamos en Colab.
if EN_COLAB:
    from google.colab import drive
    drive.mount("/content/drive")

# Detenerse si la carpeta del proyecto no existe.
assert BASE.is_dir(), (
    f"No encuentro {BASE}. Comprueba que Drive esté montado "
    "con la cuenta correcta."
)

# Crear las carpetas de resultados que todavía no existan.
for clave in ("experimentos", "modelos", "informes", "figuras",
              "bitacora", "configs", "publicacion"):
    RUTAS[clave].mkdir(parents=True, exist_ok=True)

# Probar escritura y lectura real en Drive.
from datetime import datetime
prueba = RUTAS["informes"] / ".prueba_escritura.txt"
contenido = f"Michikembo escritura OK {datetime.now().isoformat()}"
prueba.write_text(contenido, encoding="utf-8")
assert prueba.read_text(encoding="utf-8") == contenido, "Drive no devolvió lo escrito."
prueba.unlink()

# Crear la carpeta de trabajo local.
TRABAJO.mkdir(parents=True, exist_ok=True)

print("✅ Drive montado, con lectura y escritura comprobadas.")
print("Informes:", RUTAS["informes"])
''')

# =====================================================================
# 03. UTILIDADES Y REGISTRO DEL ENTORNO
# =====================================================================
md(r'''
---
# 03. Utilidades comunes y registro del entorno

**Objetivo:** definir funciones que se usan en todo el notebook (huellas SHA-256, JSON seguros, figuras, bitácoras) y registrar las versiones reales de Python, PyTorch, Ultralytics y la GPU.

**Salida:** `documentacion/notebook_v21/entorno.json`. Se guarda en cada sesión con fecha, porque las versiones de Colab cambian con el tiempo.
''')

code(r'''
# Importar librerías estándar.
import csv
import hashlib
import io
import json
import platform
import random
import re
import shutil
import time
import zipfile
from collections import Counter, defaultdict
from zoneinfo import ZoneInfo

# Importar librerías de análisis y gráficas.
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from PIL import Image

# Estilo uniforme para todas las gráficas.
plt.rcParams.update({
    "figure.dpi": 100,
    "axes.grid": True,
    "grid.alpha": 0.3,
    "axes.spines.top": False,
    "axes.spines.right": False,
})
COLORES = {"Paper": "#4C78A8", "Rock": "#F58518", "Scissors": "#54A24B",
           "Nada": "#9D9D9D", "train": "#4C78A8", "valid": "#F58518",
           "test": "#E45756", "excluida": "#BAB0AC"}


def ahora():
    """Devuelve la fecha y hora actual de Colombia."""
    return datetime.now(ZoneInfo(ZONA_HORARIA))


def sello():
    """Devuelve una marca de tiempo apta para nombres de archivo."""
    return ahora().strftime("%Y%m%d_%H%M%S")


def sha256_archivo(ruta, bloque=8 * 1024 * 1024):
    """Calcula la huella SHA-256 de un archivo leyéndolo por bloques."""
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for trozo in iter(lambda: f.read(bloque), b""):
            h.update(trozo)
    return h.hexdigest()


def guardar_json(ruta, datos):
    """Guarda un JSON de forma atómica: primero un temporal y luego lo renombra."""
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    temporal = ruta.with_name(ruta.name + ".tmp")
    temporal.write_text(json.dumps(datos, indent=2, ensure_ascii=False, default=str),
                        encoding="utf-8")
    os.replace(temporal, ruta)
    return ruta


def leer_json(ruta, defecto=None):
    """Lee un JSON si existe. Si no existe devuelve el valor por defecto."""
    ruta = Path(ruta)
    if not ruta.is_file():
        return defecto
    return json.loads(ruta.read_text(encoding="utf-8"))


def guardar_figura(fig, nombre):
    """Guarda una figura en Drive y la muestra en el notebook."""
    ruta = RUTAS["figuras"] / f"{nombre}.png"
    fig.savefig(ruta, dpi=120, bbox_inches="tight")
    plt.show()
    plt.close(fig)
    return ruta


def titulo(texto):
    """Imprime un encabezado visible en la salida."""
    print("\n" + "=" * 72 + "\n" + texto + "\n" + "=" * 72)


def escribir_bitacora(paso, nombre, estado, objetivo, acciones, evidencias,
                      archivos, problemas, siguiente):
    """Escribe la bitácora Markdown de un paso con la plantilla del proyecto."""
    def lista(items):
        return "\n".join(f"- {x}" for x in items) if items else "- Ninguno."
    texto = (
        f"# Michikembo — Paso {paso} — {nombre}\n"
        f"Fecha (Colombia): {ahora():%Y-%m-%d %H:%M}\n"
        f"Estado: {estado}\n\n"
        f"## Objetivo\n{objetivo}\n\n"
        f"## Acciones ejecutadas\n{lista(acciones)}\n\n"
        f"## Evidencias y resultados\n{lista(evidencias)}\n\n"
        f"## Archivos respaldados\n{lista(archivos)}\n\n"
        f"## Problemas y advertencias\n{lista(problemas)}\n\n"
        f"## Próximo paso\n{siguiente}\n"
    )
    slug = re.sub(r"[^A-Za-z0-9]+", "_", nombre).strip("_")
    ruta = RUTAS["bitacora"] / f"PASO_{paso}_{slug}.md"
    ruta.write_text(texto, encoding="utf-8")
    print("📝 Bitácora:", ruta)
    return ruta


def fuente(nombre):
    """Clasifica de forma aproximada la procedencia de una imagen por su nombre."""
    n = nombre.lower()
    if n.startswith("egohands"):
        return "egohands"
    if n.startswith("youtube"):
        return "youtube"
    if re.search(r"_(mp4|mov|avi|mkv)", n) or "frame" in n:
        return "video"
    if n.startswith("photo") or n.startswith("img"):
        return "foto"
    return "otra"


def normalizar(nombre, tipo="images"):
    """Convierte una ruta interna del ZIP v14 a la forma 'split/tipo/archivo'."""
    patron = rf"(?:^|/)(train|valid|test)/{tipo}/([^/]+)$"
    m = re.search(patron, nombre.replace("\\", "/"))
    return f"{m.group(1)}/{tipo}/{m.group(2)}" if m else None


print("Utilidades listas.")
''')

code(r'''
# Importar PyTorch y Ultralytics ya instalados.
import torch
import ultralytics
from ultralytics import YOLO

# Fijar semillas para que los muestreos sean reproducibles.
random.seed(SEMILLA)
np.random.seed(SEMILLA)
torch.manual_seed(SEMILLA)

# Elegir el dispositivo de cómputo.
GPU = torch.cuda.is_available()
DISPOSITIVO = 0 if GPU else "cpu"

# Registrar las versiones efectivas de esta sesión.
entorno = {
    "fecha": ahora().isoformat(),
    "python": platform.python_version(),
    "torch": torch.__version__,
    "ultralytics": ultralytics.__version__,
    "cuda_disponible": GPU,
    "gpu": torch.cuda.get_device_name(0) if GPU else None,
    "memoria_gpu_mib": (torch.cuda.get_device_properties(0).total_memory // 2**20) if GPU else None,
    "semilla": SEMILLA,
    "en_colab": EN_COLAB,
}
guardar_json(RUTAS["informes"] / f"entorno_{sello()}.json", entorno)
guardar_json(RUTAS["informes"] / "entorno.json", entorno)

titulo("ENTORNO DE ESTA SESIÓN")
for clave, valor in entorno.items():
    print(f"{clave:>18}: {valor}")

# Impedir entrenamientos sin GPU por accidente.
if ENTRENAR and not GPU and not PERMITIR_CPU:
    raise RuntimeError(
        "No hay GPU. Ve a Entorno de ejecución → Cambiar tipo de entorno → T4 GPU "
        "y vuelve a ejecutar todo. Si solo quieres revisar resultados, pon ENTRENAR = False."
    )
''')

# =====================================================================
# 04. INVENTARIO
# =====================================================================
md(r'''
---
# 04. Inventario y huellas de los archivos

**Objetivo:** confirmar que los archivos de las sesiones anteriores siguen en Drive y que no cambiaron.

**Qué se verifica:**

| Archivo | Comprobación |
|---|---|
| ZIP original Roboflow v14 | Tamaño de **238.134.549 bytes** y SHA-256 conocido |
| ZIP preparado v1 | Que exista (es historia, no se usa para entrenar) |
| `manifiesto_v21.csv` | **7.335 registros** con reparto **3.446 / 341 / 341 / 3.207** |
| Pesos de E2 | Que existan (solo como referencia histórica) |
| ZIP v2.1 | Si ya existe o si quedó un temporal `.partial` |

La huella del ZIP original se calcula una sola vez y se guarda en `inventario.json`. En ejecuciones posteriores se reutiliza mientras el tamaño y la fecha del archivo no cambien.
''')

code(r'''
titulo("INVENTARIO DE ARCHIVOS")

# Recuperar el inventario previo para no recalcular huellas pesadas.
ruta_inventario = RUTAS["informes"] / "inventario.json"
inventario_previo = leer_json(ruta_inventario, {})

filas_inventario = []
for clave in ("zip_v14", "zip_v1", "manifiesto_v21", "evidencias_v21",
              "config_v21", "e2_best", "zip_ds", "sha_ds", "partial_ds"):
    ruta = RUTAS[clave]
    existe = ruta.is_file()
    filas_inventario.append({
        "archivo": clave,
        "existe": "✅" if existe else "—",
        "bytes": ruta.stat().st_size if existe else None,
        "ruta": str(ruta),
    })
display(pd.DataFrame(filas_inventario))

# Los archivos de entrada imprescindibles deben existir.
for clave in ("zip_v14", "manifiesto_v21"):
    assert RUTAS[clave].is_file(), f"Falta {RUTAS[clave]}. No se puede continuar."

# Verificar el tamaño y la huella del ZIP original.
estado_v14 = RUTAS["zip_v14"].stat()
assert estado_v14.st_size == TAM_V14, (
    f"El ZIP v14 mide {estado_v14.st_size} bytes y se esperaban {TAM_V14}."
)
huella_previa = inventario_previo.get("zip_v14", {})
if (huella_previa.get("bytes") == estado_v14.st_size
        and huella_previa.get("mtime") == estado_v14.st_mtime):
    sha_v14 = huella_previa["sha256"]
    print("SHA-256 del ZIP v14 reutilizado del inventario previo.")
else:
    print("Calculando SHA-256 del ZIP v14 (unos segundos)...")
    sha_v14 = sha256_archivo(RUTAS["zip_v14"])
assert sha_v14 == SHA_V14, "La huella del ZIP v14 no coincide. El archivo cambió."
print("✅ ZIP v14 íntegro:", sha_v14)

# Leer el manifiesto v2.1 y comprobar el reparto.
with RUTAS["manifiesto_v21"].open("r", encoding="utf-8-sig", newline="") as f:
    MANIFIESTO = list(csv.DictReader(f))
conteo_manifiesto = Counter(fila["split_propuesto"] for fila in MANIFIESTO)
print("\nRegistros del manifiesto:", len(MANIFIESTO))
print("Reparto:", dict(conteo_manifiesto))
assert len(MANIFIESTO) == TOTAL_V14, "El manifiesto no tiene 7.335 registros."
assert dict(conteo_manifiesto) == ESPERADO_V21, "El reparto del manifiesto no coincide con v2.1."
assert len({f["original"] for f in MANIFIESTO}) == TOTAL_V14, "Hay imágenes repetidas en el manifiesto."

# Comprobar que ninguna familia está en dos particiones activas.
familias_por_split = defaultdict(set)
for fila in MANIFIESTO:
    if fila["split_propuesto"] != "excluida":
        familias_por_split[fila["familia"]].add(fila["split_propuesto"])
compartidas = [f for f, s in familias_por_split.items() if len(s) > 1]
assert not compartidas, f"Hay {len(compartidas)} familias compartidas entre particiones."
print("✅ Manifiesto v2.1 íntegro y sin familias compartidas.")

# Estado del ZIP v2.1.
print(f"\nZIP {DATASET} existente:", RUTAS["zip_ds"].is_file())
print("Temporal .partial existente:", RUTAS["partial_ds"].is_file())

# Guardar el inventario.
guardar_json(ruta_inventario, {
    "fecha": ahora().isoformat(),
    "zip_v14": {"bytes": estado_v14.st_size, "mtime": estado_v14.st_mtime, "sha256": sha_v14},
    "manifiesto_v21": {"registros": len(MANIFIESTO), "reparto": dict(conteo_manifiesto),
                       "sha256": sha256_archivo(RUTAS["manifiesto_v21"])},
    "archivos": filas_inventario,
})
''')

# =====================================================================
# 04b. DATASET v2.2 — REPARTO ESTRATIFICADO POR FUENTE
# =====================================================================
md(r'''
---
# 04b. Dataset v2.2: reparto estratificado por fuente

## Por qué existe este capítulo (diagnóstico de la primera ejecución)

En la primera ejecución completa (18 y 19 de noviembre de 2026) los cinco experimentos sobre v2.1 se estancaron en el mismo techo, sin importar el tamaño del modelo, la aumentación o la resolución:

| Experimento | mAP@50 val | Recall val | mAP@50 train | Brecha |
|---|---:|---:|---:|---:|
| B1 yolov8n | 0,600 | 0,537 | 0,991 | 0,39 |
| E3a yolov8s | 0,556 | 0,451 | 0,990 | 0,43 |
| E3b yolov8m | 0,588 | 0,510 | 0,993 | 0,41 |
| E3c yolov8n + aumentación | **0,629** | 0,510 | 0,993 | 0,36 |
| E3d yolov8n + 800 px | 0,545 | 0,437 | 0,990 | 0,45 |

Un modelo **más grande no mejoró** y todos memorizan train (0,99). Cuando eso pasa, el problema no está en el modelo sino en **qué datos ve en train frente a qué datos se evalúa**. La gráfica de procedencia del capítulo 07 lo mostró:

| Fuente | Train v2.1 | Valid v2.1 | Test v2.1 |
|---|---:|---:|---:|
| Fotogramas de **video** | ≈ 2 % | **≈ 64 %** | **≈ 65 %** |
| egohands | ≈ 51 % | ≈ 23 % | ≈ 27 % |

**Causa:** el algoritmo de v2 llenaba validación y test empezando por las **familias más grandes**, y las familias más grandes son los videos (muchos fotogramas de la misma grabación). Resultado: casi todos los videos quedaron en evaluación y el modelo **casi nunca vio ese tipo de imagen al entrenar** (cámara cenital, ángulos de celular, manos pequeñas). Además, como esas familias pasaron a evaluación, sus variantes aumentadas de Roboflow quedaron **excluidas** y se perdieron como datos de entrenamiento.

## Qué cambia en v2.2

1. Se parte del **mismo manifiesto v2.1** (mismas familias, misma regla anti-fugas). No se toca el ZIP original.
2. Validación y test se llenan **por fuente**, en la misma proporción en que cada fuente aparece en el dataset completo.
3. Ninguna familia con más de `TOPE_FAMILIA_EVAL` imágenes elegibles puede ir a evaluación. Los videos largos pasan a **train completos**, con sus variantes aumentadas, y la evaluación queda formada por muchas escenas distintas en lugar de pocos videos.
4. Se repite la **auditoría de casi-duplicados** (pHash y SSIM) entre train y evaluación, con el mismo umbral de cuarentena que v2.1 (SSIM ≥ 0,85).
5. El manifiesto v2.2 se guarda en Drive y **no se vuelve a generar** en ejecuciones posteriores.

> ⚖️ **Honestidad:** las métricas v2.2 **no se pueden comparar directamente** con las de v2.1, porque la validación es otra. Lo que sí se puede afirmar es que v2.2 representa mejor la variedad real de imágenes. El test v2.2 tampoco coincide con el de v2.1, y los modelos v2.1 no se evalúan sobre v2.2 porque algunas de esas imágenes estaban en su train.
''')

code(r'''
# Parámetros del reparto v2.2.
IMAGENES_EVAL_POR_SPLIT = 341   # Mismo tamaño de validación y test que v2.1.
TOPE_FAMILIA_EVAL = 12          # Familias más grandes van completas a train.
UMBRAL_PHASH = 8                # Distancia de Hamming máxima para considerar parecido.
UMBRAL_SSIM_CUARENTENA = 0.85   # Igual que en v2.1.


def es_verdadero(valor):
    """Interpreta 'True', 'true', '1' o True como verdadero."""
    return str(valor).strip().lower() in ("true", "1", "yes", "si", "sí")


def phash(img):
    """Huella perceptual de 64 bits (DCT de 32x32) de una imagen PIL."""
    from scipy.fft import dctn
    gris = np.asarray(img.convert("L").resize((32, 32), Image.LANCZOS), dtype=np.float32)
    bajo = dctn(gris, norm="ortho")[:8, :8].flatten()
    bits = bajo > np.median(bajo[1:])
    return int("".join("1" if b else "0" for b in bits), 2)


def gris_ssim(img):
    """Versión gris de 128x128 para comparar con SSIM."""
    return np.asarray(img.convert("L").resize((128, 128), Image.BILINEAR), dtype=np.float32)


def proponer_v22(filas_v21):
    """Construye el reparto v2.2 a partir del manifiesto v2.1. Devuelve filas y un resumen."""
    rng = random.Random(SEMILLA)
    familias = defaultdict(list)
    for fila in filas_v21:
        familias[fila["familia"]].append(fila)

    # Fuente dominante de cada familia y familias aisladas (youtube-N).
    fuente_fam = {fid: Counter(fuente(Path(m["original"]).name) for m in miembros).most_common(1)[0][0]
                  for fid, miembros in familias.items()}
    youtube = {fid for fid, miembros in familias.items() if any(es_verdadero(m["youtube"]) for m in miembros)}

    # Proporción de cada fuente en el dataset completo (sin youtube, que nunca va a evaluación).
    total_fuente = Counter()
    for fid, miembros in familias.items():
        if fid not in youtube:
            total_fuente[fuente_fam[fid]] += len(miembros)
    total = sum(total_fuente.values())
    objetivo = {f: round(IMAGENES_EVAL_POR_SPLIT * n / total) for f, n in total_fuente.items()}

    # Familias que pueden ir a evaluación: tienen imágenes valid/test originales y no son enormes.
    elegibles = defaultdict(list)
    for fid, miembros in sorted(familias.items()):
        n_eval = sum(m["origen_v14"] in ("valid", "test") for m in miembros)
        if fid in youtube or n_eval == 0 or n_eval > TOPE_FAMILIA_EVAL:
            continue
        elegibles[fuente_fam[fid]].append((fid, n_eval))

    # Llenar valid y test fuente por fuente, alternando para mantenerlos parecidos.
    asignacion = {}
    llenado = {s: Counter() for s in ("valid", "test")}
    for f, lista in sorted(elegibles.items()):
        rng.shuffle(lista)
        for fid, n in lista:
            opciones = sorted(("valid", "test"), key=lambda s: (llenado[s][f], s))
            for split in opciones:
                if llenado[split][f] + n <= objetivo.get(f, 0):
                    asignacion[fid] = split
                    llenado[split][f] += n
                    break

    # Segunda pasada: si alguna fuente no tenía familias pequeñas suficientes,
    # completar hasta el tamaño deseado con las familias elegibles que sobran.
    sobrantes = [x for f in sorted(elegibles) for x in elegibles[f] if x[0] not in asignacion]
    rng.shuffle(sobrantes)
    for fid, n in sobrantes:
        for split in sorted(("valid", "test"), key=lambda s: sum(llenado[s].values())):
            if sum(llenado[split].values()) + n <= IMAGENES_EVAL_POR_SPLIT:
                asignacion[fid] = split
                llenado[split][fuente_fam[fid] + " (relleno)"] += n
                break

    # Aplicar el reparto a cada imagen.
    filas = []
    for fid, miembros in familias.items():
        split_fam = asignacion.get(fid, "train")
        for m in miembros:
            nueva = dict(m)
            nueva["split_v21"] = m["split_propuesto"]
            nueva["fuente"] = fuente(Path(m["original"]).name)
            nueva["fuente_familia"] = fuente_fam[fid]
            if split_fam == "train":
                nueva["split_propuesto"] = "train"
                nueva["motivo_v22"] = "FAMILIA_EN_TRAIN"
            elif m["origen_v14"] == "train":
                nueva["split_propuesto"] = "excluida"
                nueva["motivo_v22"] = "VARIANTE_TRAIN_DE_FAMILIA_EVAL"
            else:
                nueva["split_propuesto"] = split_fam
                nueva["motivo_v22"] = "FAMILIA_EN_EVAL"
            filas.append(nueva)
    return filas, {"objetivo_por_fuente": objetivo, "llenado": {s: dict(c) for s, c in llenado.items()}}


def auditar_casi_duplicados(filas):
    """Busca parecidos train↔evaluación con pHash + SSIM y pone en cuarentena familias de train."""
    from skimage.metrics import structural_similarity
    activas = [f for f in filas if f["split_propuesto"] != "excluida"]
    huellas, grises = {}, {}
    with zipfile.ZipFile(RUTAS["zip_v14"]) as z:
        indice = {normalizar(n, "images"): n for n in z.namelist() if normalizar(n, "images")}
        for i, fila in enumerate(activas, 1):
            img = Image.open(io.BytesIO(z.read(indice[fila["original"]])))
            huellas[fila["original"]] = (phash(img), phash(img.transpose(Image.FLIP_LEFT_RIGHT)))
            if fila["split_propuesto"] != "train":
                grises[fila["original"]] = gris_ssim(img)
            if i % 1000 == 0:
                print(f"  {i:,}/{len(activas):,} huellas calculadas")
        tren = [f for f in activas if f["split_propuesto"] == "train"]
        evalu = [f for f in activas if f["split_propuesto"] != "train"]
        h_tren = np.array([huellas[f["original"]][0] for f in tren], dtype=np.uint64)
        h_tren_flip = np.array([huellas[f["original"]][1] for f in tren], dtype=np.uint64)

        def hamming(vector, valor):
            return np.bitwise_count(np.bitwise_xor(vector, np.uint64(valor)))

        pares = []
        for fe in evalu:
            h = np.uint64(huellas[fe["original"]][0])
            dist = np.minimum(hamming(h_tren, h), hamming(h_tren_flip, h))
            for j in np.nonzero(dist <= UMBRAL_PHASH)[0]:
                ft = tren[j]
                if ft["original"] not in grises:
                    grises[ft["original"]] = gris_ssim(Image.open(io.BytesIO(z.read(indice[ft["original"]]))))
                g_t = grises[ft["original"]]
                g_e = grises[fe["original"]]
                s1 = structural_similarity(g_t, g_e, data_range=255)
                s2 = structural_similarity(g_t[:, ::-1], g_e, data_range=255)
                pares.append({"familia_train": ft["familia"], "imagen_train": ft["original"],
                              "imagen_evaluacion": fe["original"], "split_evaluacion": fe["split_propuesto"],
                              "distancia_phash": int(dist[j]), "ssim": float(max(s1, s2))})
    cuarentena = {p["familia_train"] for p in pares if p["ssim"] >= UMBRAL_SSIM_CUARENTENA}
    for fila in filas:
        if fila["split_propuesto"] == "train" and fila["familia"] in cuarentena:
            fila["split_propuesto"] = "excluida"
            fila["motivo_v22"] = "CUARENTENA_SIMILITUD_VISUAL"
    return pares, cuarentena


# ---------------------------------------------------------------------
# Crear (una sola vez) o leer el manifiesto v2.2.
# ---------------------------------------------------------------------
if DATASET == "v21":
    MANIFIESTO_ACTIVO = MANIFIESTO
    RUTA_MANIFIESTO_ACTIVO = RUTAS["manifiesto_v21"]
    print("Dataset v2.1 seleccionado: se usan el manifiesto y los resultados anteriores.")
elif RUTAS["manifiesto_v22"].is_file():
    with RUTAS["manifiesto_v22"].open("r", encoding="utf-8-sig", newline="") as f:
        MANIFIESTO_ACTIVO = list(csv.DictReader(f))
    RUTA_MANIFIESTO_ACTIVO = RUTAS["manifiesto_v22"]
    print("Manifiesto v2.2 ya existente. No se regenera:", RUTA_MANIFIESTO_ACTIVO)
else:
    titulo("CREANDO EL REPARTO V2.2")
    filas_v22, resumen_reparto = proponer_v22(MANIFIESTO)
    print("Auditando casi-duplicados entre train y evaluación (unos minutos)...")
    pares_v22, cuarentena_v22 = auditar_casi_duplicados(filas_v22)
    print(f"Pares con pHash ≤ {UMBRAL_PHASH}: {len(pares_v22)} · familias en cuarentena: {len(cuarentena_v22)}")
    RUTAS["carpeta_v22"].mkdir(parents=True, exist_ok=True)
    temporal = RUTAS["manifiesto_v22"].with_name("manifiesto_v22.csv.tmp")
    with temporal.open("w", encoding="utf-8-sig", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=list(filas_v22[0].keys()))
        escritor.writeheader()
        escritor.writerows(filas_v22)
    pd.DataFrame(pares_v22 or [{}]).to_csv(RUTAS["carpeta_v22"] / "pares_casi_duplicados.csv", index=False)
    guardar_json(RUTAS["carpeta_v22"] / "configuracion.json", {
        "version": "v2.2", "creado": ahora().isoformat(), "semilla": SEMILLA,
        "origen": str(RUTAS["manifiesto_v21"]), "origen_sha256": sha256_archivo(RUTAS["manifiesto_v21"]),
        "imagenes_eval_por_split": IMAGENES_EVAL_POR_SPLIT, "tope_familia_eval": TOPE_FAMILIA_EVAL,
        "umbral_phash": UMBRAL_PHASH, "umbral_ssim_cuarentena": UMBRAL_SSIM_CUARENTENA,
        "familias_cuarentena": sorted(cuarentena_v22), "pares_detectados": len(pares_v22),
        **resumen_reparto,
        "motivo": "v2.1 tenía ~64 % de fotogramas de video en evaluación y ~2 % en train.",
    })
    os.replace(temporal, RUTAS["manifiesto_v22"])   # El nombre definitivo aparece solo al final.
    MANIFIESTO_ACTIVO = filas_v22
    RUTA_MANIFIESTO_ACTIVO = RUTAS["manifiesto_v22"]
    print("✅ Manifiesto v2.2 guardado:", RUTA_MANIFIESTO_ACTIVO)
    titulo("OBJETIVO Y LLENADO POR FUENTE (imágenes de evaluación)")
    display(pd.DataFrame({"objetivo por split": pd.Series(resumen_reparto["objetivo_por_fuente"]),
                          "valid": pd.Series(resumen_reparto["llenado"]["valid"]),
                          "test": pd.Series(resumen_reparto["llenado"]["test"])}).fillna(0).astype(int))

# Comprobaciones que aplican a cualquier versión.
ESPERADO_ACTIVO = dict(Counter(f["split_propuesto"] for f in MANIFIESTO_ACTIVO))
assert len(MANIFIESTO_ACTIVO) == TOTAL_V14, "El manifiesto activo no tiene todas las imágenes."
familias_split = defaultdict(set)
for fila in MANIFIESTO_ACTIVO:
    if fila["split_propuesto"] != "excluida":
        familias_split[fila["familia"]].add(fila["split_propuesto"])
assert not [f for f, s in familias_split.items() if len(s) > 1], "Hay familias compartidas entre particiones."
assert not any(f["origen_v14"] == "train" for f in MANIFIESTO_ACTIVO
               if f["split_propuesto"] in ("valid", "test")), "Hay variantes aumentadas en evaluación."
print("Reparto activo:", ESPERADO_ACTIVO)
print("✅ Sin familias compartidas y sin variantes aumentadas en evaluación.")
''')

code(r'''
# Comparar la procedencia de las imágenes en v2.1 y en el dataset activo.
def tabla_fuentes(filas):
    df = pd.DataFrame({"split": [f["split_propuesto"] for f in filas],
                       "fuente": [fuente(Path(f["original"]).name) for f in filas]})
    df = df[df["split"] != "excluida"]
    return pd.crosstab(df["split"], df["fuente"], normalize="index").reindex(["train", "valid", "test"])


versiones = {"v2.1": MANIFIESTO} if DATASET == "v21" else {"v2.1": MANIFIESTO, "v2.2": MANIFIESTO_ACTIVO}
fig, ejes = plt.subplots(1, len(versiones), figsize=(6.5 * len(versiones), 4.2), squeeze=False)
for ax, (nombre, filas) in zip(ejes[0], versiones.items()):
    tabla = tabla_fuentes(filas)
    tabla.plot(kind="bar", stacked=True, ax=ax, colormap="tab20", rot=0, legend=False)
    conteo = Counter(f["split_propuesto"] for f in filas)
    ax.set_title(f"{nombre} · train {conteo['train']:,} · valid {conteo['valid']} · test {conteo['test']}")
    ax.set_ylabel("Proporción")
ejes[0][-1].legend(fontsize=8, bbox_to_anchor=(1, 1))
fig.suptitle("Procedencia de las imágenes por partición")
guardar_figura(fig, f"04b_fuentes_{DATASET}")

titulo("PROPORCIÓN DE CADA FUENTE (dataset activo)")
display((100 * tabla_fuentes(MANIFIESTO_ACTIVO)).round(1))
if DATASET == "v22":
    motivos = Counter(f.get("motivo_v22", "") for f in MANIFIESTO_ACTIVO)
    print("Motivos de asignación v2.2:", dict(motivos))
    recuperadas = sum(1 for f in MANIFIESTO_ACTIVO if f["split_v21"] == "excluida" and f["split_propuesto"] == "train")
    print(f"Imágenes excluidas en v2.1 que vuelven a train en v2.2: {recuperadas:,}")
''')


# =====================================================================
# 05. TRAZABILIDAD
# =====================================================================
md(r'''
---
# 05. Trazabilidad de los datos

**Objetivo:** dejar a la vista, con tablas y gráficas, de dónde viene el dataset v2.1 y por qué es diferente de v1.

### Resumen de lo que ya se hizo en sesiones anteriores

1. **Dataset original:** Roboflow *Rock Paper Scissors SXSW* v14, formato YOLOv8. Contiene **7.335 imágenes reales** (la web anunciaba 7.521). Alrededor del 39 % no tiene cajas, es decir, son **imágenes negativas**, y se conservan porque enseñan al modelo a no ver gestos donde no los hay.
2. **v1 (histórico):** 2.273 imágenes, reducido para forzar 70/15/15. Con él se entrenaron B0, E1 y E2.
3. **Auditoría de fugas:** se encontraron **37 pares casi idénticos (SSIM ≥ 0,95)** cruzando train, valid y test de v1. Por eso las métricas de v1 **no son una prueba ciega**.
4. **v2:** se reconstruyeron **1.256 familias** (variantes de Roboflow, fotogramas de un mismo video, archivos binarios idénticos y los 612 `youtube-N` aislados) y se repartieron familias completas.
5. **v2.1:** cuarentena preventiva de **23 familias de train** (68 imágenes) con parecido visual SSIM ≥ 0,85 a validación o test. Resultado: **cero familias compartidas**.

> ⚠️ **Licencia pendiente:** los metadatos del dataset dicen `Private` y `undefined`. No se publican imágenes en GitHub hasta aclararlo.

> ℹ️ **Sobre el test interno:** algunas imágenes del test interno se vieron durante las auditorías visuales. Se declara aquí y se trata como un test **interno**, no como una prueba totalmente ciega. La prueba más convincente será el conjunto externo del capítulo 12.
''')

code(r'''
# Construir una tabla con el manifiesto completo.
df_man = pd.DataFrame(MANIFIESTO_ACTIVO)
for col in ("cajas_paper", "cajas_rock", "cajas_scissors"):
    df_man[col] = df_man[col].astype(int)
df_man["cajas_total"] = df_man[["cajas_paper", "cajas_rock", "cajas_scissors"]].sum(axis=1)
df_man["negativa"] = df_man["cajas_total"] == 0

# Resumen por partición.
orden = ["train", "valid", "test", "excluida"]
resumen_splits = (
    df_man.groupby("split_propuesto")
    .agg(imagenes=("original", "count"),
         negativas=("negativa", "sum"),
         familias=("familia", "nunique"),
         cajas_paper=("cajas_paper", "sum"),
         cajas_rock=("cajas_rock", "sum"),
         cajas_scissors=("cajas_scissors", "sum"))
    .reindex(orden)
)
activas = resumen_splits.loc[["train", "valid", "test"], "imagenes"].sum()
resumen_splits["% activo"] = (100 * resumen_splits["imagenes"] / activas).round(2)
resumen_splits.loc["excluida", "% activo"] = np.nan
titulo(f"DATASET {DATASET} POR PARTICIÓN")
display(resumen_splits)

# Gráfica 1: imágenes con gesto y negativas por partición.
fig, ejes = plt.subplots(1, 2, figsize=(13, 4.5))
pos = resumen_splits["imagenes"] - resumen_splits["negativas"]
ejes[0].bar(orden, pos, label="Con gesto", color="#4C78A8")
ejes[0].bar(orden, resumen_splits["negativas"], bottom=pos, label="Negativas", color="#BAB0AC")
for i, total in enumerate(resumen_splits["imagenes"]):
    ejes[0].text(i, total, f"{total:,}", ha="center", va="bottom")
ejes[0].set_title(f"Imágenes por partición ({DATASET})")
ejes[0].legend()

# Gráfica 2: cajas por clase en cada partición.
ancho = 0.25
x = np.arange(len(orden))
for i, (col, clase) in enumerate(zip(("cajas_paper", "cajas_rock", "cajas_scissors"), CLASES)):
    ejes[1].bar(x + (i - 1) * ancho, resumen_splits[col], ancho, label=clase, color=COLORES[clase])
ejes[1].set_xticks(x, orden)
ejes[1].set_title("Cajas anotadas por clase")
ejes[1].legend()
guardar_figura(fig, f"05_reparto_{DATASET}")

# Historial de experimentos con v1 (solo como contexto, no comparable con v2.1).
historial_v1 = pd.DataFrame([
    {"experimento": "B0", "modelo": "yolov8n", "cambio": "línea base", "P": 0.744, "R": 0.602, "mAP50": 0.658, "mAP50-95": 0.434},
    {"experimento": "E1", "modelo": "yolov8s", "cambio": "modelo más grande", "P": 0.864, "R": 0.557, "mAP50": 0.631, "mAP50-95": 0.427},
    {"experimento": "E2", "modelo": "yolov8n", "cambio": "mosaic=0", "P": 0.880, "R": 0.483, "mAP50": 0.597, "mAP50-95": 0.389},
])
titulo("HISTORIAL V1 (validación con fugas, solo referencia)")
display(historial_v1)

# Distribución del parecido visual de los pares que provocaron la cuarentena.
if RUTAS["evidencias_v21"].is_file():
    evid = pd.read_csv(RUTAS["evidencias_v21"], encoding="utf-8-sig")
    if "ssim" in evid.columns and len(evid):
        fig, ax = plt.subplots(figsize=(7, 3.5))
        ax.hist(evid["ssim"].astype(float), bins=15, color="#E45756")
        ax.axvline(0.85, ls="--", color="k", label="Umbral de cuarentena 0,85")
        ax.set_title(f"SSIM de los {len(evid)} pares que motivaron la cuarentena v2.1")
        ax.set_xlabel("SSIM")
        ax.legend()
        guardar_figura(fig, "05_cuarentena_ssim")
''')

# =====================================================================
# 06. CONSTRUCCIÓN Y VALIDACIÓN V2.1
# =====================================================================
md(r'''
---
# 06. Construcción y validación del dataset activo

**Objetivo:** convertir el manifiesto activo (v2.2 por defecto) en un ZIP YOLO listo para entrenar, sin tocar el ZIP original, v1 ni v2.1.

**Cómo funciona:**

1. Si el ZIP del dataset activo **ya existe**, no se reconstruye. Solo se comprueba su huella y su contenido.
2. Si quedó un **`.partial`** de una sesión cortada, no se borra: se renombra como `*_revisar_<fecha>` para revisarlo después, y se construye de nuevo.
3. La construcción se hace primero en el disco rápido de Colab, se valida y luego se copia a Drive como `.partial`. Solo cuando la huella de la copia coincide, se renombra al nombre definitivo. Así nunca queda un ZIP a medias con el nombre bueno.

**Validaciones que se hacen sobre el ZIP:**

- Integridad CRC de todos los archivos (`testzip`).
- Cada imagen tiene su etiqueta y cada etiqueta su imagen.
- Clases solo 0, 1 o 2, cinco valores por línea y coordenadas dentro de [0, 1].
- Cantidad de imágenes, negativas y cajas por clase **idéntica** a la del manifiesto.
- Ningún nombre de archivo repetido.

**Salidas:** `datasets/michikenbo_dataset_v22.zip` y su `.sha256` en Drive, y una copia extraída en `/content` para entrenar rápido.
''')

code(r'''
def esperado_desde_manifiesto(filas):
    """Calcula imágenes, negativas y cajas por clase que debe tener cada partición."""
    esperado = defaultdict(Counter)
    for fila in filas:
        split = fila["split_propuesto"]
        if split == "excluida":
            continue
        cajas = [int(fila["cajas_paper"]), int(fila["cajas_rock"]), int(fila["cajas_scissors"])]
        esperado[split]["imagenes"] += 1
        esperado[split]["negativas"] += int(sum(cajas) == 0)
        for clase, n in zip(CLASES, cajas):
            esperado[split][clase] += n
    return {k: dict(v) for k, v in esperado.items()}


def verificar_zip(ruta_zip, filas):
    """Valida a fondo el contenido del ZIP v2.1 y devuelve un resumen."""
    observado = defaultdict(Counter)
    problemas = []
    segmentos = 0
    with zipfile.ZipFile(ruta_zip) as z:
        malo = z.testzip()
        assert malo is None, f"Archivo dañado dentro del ZIP: {malo}"
        nombres = z.namelist()
        assert len(nombres) == len(set(nombres)), "Hay nombres repetidos dentro del ZIP."
        for obligatorio in ("data.yaml", "split_manifest.csv", "preparation.json"):
            assert obligatorio in nombres, f"Falta {obligatorio} en el ZIP."
        for split in ("train", "valid", "test"):
            imagenes = {Path(n).stem for n in nombres if n.startswith(f"{split}/images/")}
            etiquetas = {Path(n).stem for n in nombres if n.startswith(f"{split}/labels/")}
            if imagenes != etiquetas:
                problemas.append(f"{split}: {len(imagenes ^ etiquetas)} imágenes sin etiqueta o al revés")
            for n in nombres:
                if not (n.startswith(f"{split}/labels/") and n.endswith(".txt")):
                    continue
                lineas = [l for l in z.read(n).decode("utf-8-sig").splitlines() if l.strip()]
                observado[split]["imagenes"] += 1
                observado[split]["negativas"] += int(not lineas)
                for linea in lineas:
                    partes = linea.split()
                    clase = int(float(partes[0]))
                    valores = [float(v) for v in partes[1:]]
                    if clase not in (0, 1, 2):
                        problemas.append(f"Clase {clase} en {n}")
                        continue
                    if len(valores) != 4:
                        segmentos += 1
                    if any(v < -1e-6 or v > 1 + 1e-6 for v in valores):
                        problemas.append(f"Coordenada fuera de [0,1] en {n}")
                    observado[split][CLASES[clase]] += 1
    esperado = esperado_desde_manifiesto(filas)
    for split in ("train", "valid", "test"):
        sin_ceros = lambda d: {k: v for k, v in (d or {}).items() if v}
        if sin_ceros(observado[split]) != sin_ceros(esperado.get(split)):
            problemas.append(f"{split}: observado {dict(observado[split])} ≠ esperado {esperado.get(split)}")
    assert not problemas, f"El ZIP {DATASET} no pasó la validación:\n" + "\n".join(problemas[:20])
    return {"particiones": {k: dict(v) for k, v in observado.items()},
            "lineas_con_poligono": segmentos}


def construir_zip(destino_local):
    """Construye el ZIP v2.1 en disco local a partir del manifiesto y el ZIP v14."""
    activas = [f for f in MANIFIESTO_ACTIVO if f["split_propuesto"] != "excluida"]
    nombres_usados = set()
    manifiesto_zip = []
    with zipfile.ZipFile(RUTAS["zip_v14"]) as origen:
        # Indexar imágenes y etiquetas del ZIP original.
        idx_img, idx_lbl = {}, {}
        for n in origen.namelist():
            r = normalizar(n, "images")
            if r:
                idx_img[r] = n
            r = normalizar(n, "labels")
            if r and r.endswith(".txt"):
                idx_lbl[r] = n
        with zipfile.ZipFile(destino_local, "w") as salida:
            for i, fila in enumerate(activas, 1):
                split = fila["split_propuesto"]
                original = fila["original"]
                archivo = Path(original).name
                etiqueta = original.replace("/images/", "/labels/").rsplit(".", 1)[0] + ".txt"
                assert original in idx_img, f"No encuentro la imagen {original} en el ZIP v14."
                assert etiqueta in idx_lbl, f"No encuentro la etiqueta {etiqueta} en el ZIP v14."
                destino_img = f"{split}/images/{archivo}"
                destino_lbl = f"{split}/labels/{Path(archivo).stem}.txt"
                assert destino_img not in nombres_usados, f"Nombre repetido: {destino_img}"
                nombres_usados.add(destino_img)
                # Las imágenes JPG ya están comprimidas, por eso se guardan sin recomprimir.
                salida.writestr(destino_img, origen.read(idx_img[original]),
                                compress_type=zipfile.ZIP_STORED)
                salida.writestr(destino_lbl, origen.read(idx_lbl[etiqueta]),
                                compress_type=zipfile.ZIP_DEFLATED)
                manifiesto_zip.append({**fila, "archivo_zip": destino_img})
                if i % 1000 == 0:
                    print(f"  {i:,}/{len(activas):,} imágenes copiadas")
            # data.yaml portable: rutas relativas a la carpeta donde se extraiga.
            salida.writestr("data.yaml",
                            "train: train/images\nval: valid/images\ntest: test/images\n\n"
                            "nc: 3\nnames: [Paper, Rock, Scissors]\n")
            # Manifiesto de las imágenes activas.
            buffer = io.StringIO()
            escritor = csv.DictWriter(buffer, fieldnames=list(manifiesto_zip[0].keys()))
            escritor.writeheader()
            escritor.writerows(manifiesto_zip)
            salida.writestr("split_manifest.csv", buffer.getvalue())
            # Descripción de la preparación.
            salida.writestr("preparation.json", json.dumps({
                "version": DATASET,
                "creado": ahora().isoformat(),
                "origen": RUTAS["zip_v14"].name,
                "origen_sha256": SHA_V14,
                "manifiesto": str(RUTA_MANIFIESTO_ACTIVO),
                "manifiesto_sha256": sha256_archivo(RUTA_MANIFIESTO_ACTIVO),
                "semilla_reparto": SEMILLA,
                "reparto": esperado_desde_manifiesto(MANIFIESTO_ACTIVO),
                "criterios": [
                    "familias completas por prefijo Roboflow, video, SHA-256 y youtube-N",
                    "valid y test solo con archivos valid/test originales de v14",
                    "cuarentena de familias de train con SSIM >= 0.85 frente a evaluación",
                ],
                "licencia": "Pendiente de aclarar. No redistribuir.",
            }, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------
# Ejecutar la construcción solo si hace falta.
# ---------------------------------------------------------------------
titulo(f"DATASET {DATASET}")
if RUTAS["zip_ds"].is_file():
    print(f"El ZIP {DATASET} ya existe. No se reconstruye. Verificando...")
    SHA_DS = sha256_archivo(RUTAS["zip_ds"])
    if RUTAS["sha_ds"].is_file():
        sha_registrado = RUTAS["sha_ds"].read_text().split()[0]
        assert SHA_DS == sha_registrado, f"La huella del ZIP {DATASET} no coincide con su .sha256."
        print("✅ Huella coincide con el archivo .sha256")
    else:
        print("⚠️ No había .sha256. Se crea ahora con la huella actual.")
        RUTAS["sha_ds"].write_text(f"{SHA_DS}  {RUTAS['zip_ds'].name}\n")
    RESUMEN_DS = verificar_zip(RUTAS["zip_ds"], MANIFIESTO_ACTIVO)
    CONSTRUIDO_AHORA = False
else:
    # Apartar un temporal huérfano sin borrarlo.
    if RUTAS["partial_ds"].is_file():
        apartado = RUTAS["partial_ds"].with_name(f".michikenbo_dataset_{DATASET}_revisar_{sello()}.partial")
        os.replace(RUTAS["partial_ds"], apartado)
        print("⚠️ Había un .partial de una sesión anterior. Se apartó en:", apartado)
    RUTAS["construccion"].mkdir(parents=True, exist_ok=True)
    zip_local = RUTAS["construccion"] / RUTAS["zip_ds"].name
    if zip_local.exists():
        zip_local.unlink()   # Copia local de trabajo, se puede rehacer.
    print(f"Construyendo el ZIP {DATASET} en disco local...")
    construir_zip(zip_local)
    print("Validando el ZIP local...")
    RESUMEN_DS = verificar_zip(zip_local, MANIFIESTO_ACTIVO)
    SHA_DS = sha256_archivo(zip_local)
    print("Copiando a Drive como .partial...")
    shutil.copyfile(zip_local, RUTAS["partial_ds"])
    assert sha256_archivo(RUTAS["partial_ds"]) == SHA_DS, "La copia en Drive no coincide."
    os.replace(RUTAS["partial_ds"], RUTAS["zip_ds"])
    RUTAS["sha_ds"].write_text(f"{SHA_DS}  {RUTAS['zip_ds'].name}\n")
    CONSTRUIDO_AHORA = True
    print(f"✅ ZIP {DATASET} guardado en Drive.")

print("SHA-256:", SHA_DS)
print("Tamaño:", f"{RUTAS['zip_ds'].stat().st_size:,} bytes")
display(pd.DataFrame(RESUMEN_DS["particiones"]).T[["imagenes", "negativas"] + CLASES])
if RESUMEN_DS["lineas_con_poligono"]:
    print(f"ℹ️ {RESUMEN_DS['lineas_con_poligono']} líneas tienen polígonos. YOLO las convierte a cajas.")
''')

code(r'''
# Extraer el ZIP v2.1 en el disco rápido de Colab para entrenar.
destino = RUTAS["dataset_local"]
marca = destino / f".extraido_{SHA_DS[:16]}"
if marca.is_file():
    print("El dataset ya estaba extraído en", destino)
else:
    if destino.exists():
        shutil.rmtree(destino)   # Copia local reconstruible.
    destino.mkdir(parents=True)
    with zipfile.ZipFile(RUTAS["zip_ds"]) as z:
        z.extractall(destino)
    marca.write_text(SHA_DS)
    print("Dataset extraído en", destino)

# Escribir un data.yaml con ruta absoluta para esta sesión.
DATA_YAML = destino / "data_local.yaml"
DATA_YAML.write_text(
    f"path: {destino}\ntrain: train/images\nval: valid/images\ntest: test/images\n\n"
    "nc: 3\nnames: [Paper, Rock, Scissors]\n"
)

# Comprobar las cantidades extraídas.
for split in ("train", "valid", "test"):
    n = len(list((destino / split / "images").iterdir()))
    assert n == ESPERADO_ACTIVO[split], f"{split}: {n} imágenes extraídas."
    print(f"{split}: {n} imágenes ✅")

escribir_bitacora(
    "05", f"Construccion y validacion del dataset {DATASET}", "COMPLETADO",
    f"Construir el ZIP YOLO {DATASET} a partir de su manifiesto, sin tocar el ZIP original ni v1.",
    ["ZIP construido en esta sesión" if CONSTRUIDO_AHORA else "ZIP ya existente, solo verificado",
     "Validación CRC, etiquetas, clases, coordenadas y conteos frente al manifiesto"],
    [f"{s}: {RESUMEN_DS['particiones'][s]}" for s in ("train", "valid", "test")],
    [f"{RUTAS['zip_ds']} (SHA-256 {SHA_DS})", str(RUTAS["sha_ds"])],
    ["Licencia del dataset pendiente: no redistribuir."],
    "Diagnóstico visual y entrenamiento B1 (capítulos 07 a 09).",
)
''')

# =====================================================================
# 07. DIAGNÓSTICOS VISUALES
# =====================================================================
md(r'''
---
# 07. Diagnósticos visuales

**Objetivo:** mirar los datos con gráficas automáticas, sin revisar imagen por imagen.

- **Mosaico de muestras** con sus cajas, para comprobar que las etiquetas tienen sentido.
- **Negativas**, para ver qué tipo de escenas sin gesto contiene el dataset.
- **Tamaño y posición de las cajas** en cada partición. Si validación tuviera manos mucho más pequeñas que train, eso explicaría un recall bajo.
- **Fuentes de las imágenes** (egohands, fotos, videos), para saber si cada partición representa bien las situaciones reales.
''')

code(r'''
def leer_etiquetas(ruta_txt):
    """Lee un archivo YOLO y devuelve una lista de (clase, cx, cy, ancho, alto)."""
    cajas = []
    for linea in Path(ruta_txt).read_text().splitlines():
        partes = linea.split()
        if len(partes) == 5:
            cajas.append((int(float(partes[0])), *map(float, partes[1:])))
        elif len(partes) > 5:
            # Polígono: se convierte a la caja que lo contiene.
            xs = list(map(float, partes[1::2]))
            ys = list(map(float, partes[2::2]))
            cajas.append((int(float(partes[0])), (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2,
                          max(xs) - min(xs), max(ys) - min(ys)))
    return cajas


def dibujar(ax, ruta_img, cajas, titulo_img=""):
    """Dibuja una imagen con sus cajas de colores por clase."""
    img = Image.open(ruta_img).convert("RGB")
    w, h = img.size
    ax.imshow(img)
    for clase, cx, cy, bw, bh in cajas:
        nombre = CLASES[clase] if isinstance(clase, int) and clase < 3 else str(clase)
        color = COLORES.get(nombre, "red")
        ax.add_patch(plt.Rectangle(((cx - bw / 2) * w, (cy - bh / 2) * h), bw * w, bh * h,
                                   fill=False, lw=2, color=color))
        ax.text((cx - bw / 2) * w, (cy - bh / 2) * h, nombre, color="white", fontsize=7,
                bbox=dict(facecolor=color, alpha=0.8, pad=1, lw=0))
    ax.set_title(titulo_img, fontsize=8)
    ax.axis("off")


# Leer todas las cajas del dataset extraído.
registros = []
for split in ("train", "valid", "test"):
    for ruta_lbl in sorted((RUTAS["dataset_local"] / split / "labels").glob("*.txt")):
        cajas = leer_etiquetas(ruta_lbl)
        registros.append({"split": split, "archivo": ruta_lbl.stem, "fuente": fuente(ruta_lbl.stem),
                          "n_cajas": len(cajas)})
        for clase, cx, cy, bw, bh in cajas:
            registros[-1].setdefault("cajas", []).append((clase, cx, cy, bw, bh))
df_img = pd.DataFrame(registros)
df_cajas = pd.DataFrame([
    {"split": r["split"], "clase": CLASES[c], "cx": cx, "cy": cy, "ancho": bw, "alto": bh, "area": bw * bh}
    for r in registros for (c, cx, cy, bw, bh) in r.get("cajas", [])
])


def ruta_imagen(split, stem):
    """Encuentra la imagen que corresponde a una etiqueta."""
    carpeta = RUTAS["dataset_local"] / split / "images"
    for ext in (".jpg", ".jpeg", ".png", ".bmp", ".webp"):
        if (carpeta / (stem + ext)).exists():
            return carpeta / (stem + ext)
    return next(carpeta.glob(stem + ".*"))


# Mosaico de muestras con gesto de cada partición.
rng = random.Random(SEMILLA)
fig, ejes = plt.subplots(3, 6, figsize=(18, 9))
for fila_ax, split in zip(ejes, ("train", "valid", "test")):
    con_gesto = [r for r in registros if r["split"] == split and r["n_cajas"] > 0]
    for ax, r in zip(fila_ax, rng.sample(con_gesto, min(6, len(con_gesto)))):
        dibujar(ax, ruta_imagen(split, r["archivo"]), r["cajas"], f"{split} · {r['fuente']}")
fig.suptitle("Muestras aleatorias con sus cajas", fontsize=14)
guardar_figura(fig, "07_muestras_con_cajas")

# Mosaico de imágenes negativas.
negativas = [r for r in registros if r["n_cajas"] == 0]
fig, ejes = plt.subplots(1, 6, figsize=(18, 3.2))
for ax, r in zip(ejes, rng.sample(negativas, min(6, len(negativas)))):
    dibujar(ax, ruta_imagen(r["split"], r["archivo"]), [], f"{r['split']} · negativa")
fig.suptitle("Ejemplos de imágenes negativas (sin gesto)")
guardar_figura(fig, "07_negativas")
''')

code(r'''
# Tamaño y posición de las cajas por partición.
fig, ejes = plt.subplots(1, 3, figsize=(17, 4.2))
for split in ("train", "valid", "test"):
    sub = df_cajas[df_cajas["split"] == split]
    ejes[0].hist(np.sqrt(sub["area"]), bins=30, alpha=0.5, density=True, label=split, color=COLORES[split])
ejes[0].set_title("Tamaño relativo de las cajas (√área)")
ejes[0].set_xlabel("0 = diminuta · 1 = ocupa toda la imagen")
ejes[0].legend()

for split in ("train", "valid"):
    sub = df_cajas[df_cajas["split"] == split]
    ejes[1].scatter(sub["cx"], sub["cy"], s=3, alpha=0.3, label=split, color=COLORES[split])
ejes[1].invert_yaxis()
ejes[1].set_title("Centro de las cajas")
ejes[1].legend()

tabla_fuentes = pd.crosstab(df_img["split"], df_img["fuente"], normalize="index").reindex(["train", "valid", "test"])
tabla_fuentes.plot(kind="bar", stacked=True, ax=ejes[2], colormap="tab20")
ejes[2].set_title("Procedencia aproximada de las imágenes")
ejes[2].set_ylabel("Proporción")
ejes[2].legend(fontsize=7, bbox_to_anchor=(1, 1))
guardar_figura(fig, "07_cajas_y_fuentes")

titulo("TAMAÑO MEDIANO DE CAJA (√área) POR PARTICIÓN Y CLASE")
display(df_cajas.assign(lado=np.sqrt(df_cajas["area"]))
        .pivot_table(index="split", columns="clase", values="lado", aggfunc="median").round(3))
''')

# =====================================================================
# 08. PLAN EXPERIMENTAL
# =====================================================================
md(r'''
---
# 08. Plan experimental

Cada experimento cambia **una sola cosa** respecto a otro y tiene una **hipótesis** que se puede comprobar en la validación v2.1. Todos usan pesos preentrenados de COCO (nunca los de E2, que se entrenaron con datos con fugas).

| Experimento | Parte de | Cambio | Hipótesis |
|---|---|---|---|
| **B1** | `yolov8n.pt` (COCO) | Línea base sobre v2.1 | Establece el punto de partida honesto con el dataset nuevo, el doble de grande que v1. |
| **E3a** | `yolov8s.pt` (COCO) | Modelo pequeño → mediano-pequeño | Más capacidad mejora el **recall**, que fue el punto débil en v1. |
| **E3b** | `yolov8m.pt` (COCO) | Modelo mediano | Comprueba si aún más capacidad ayuda o si ya empieza a sobreajustar. Es más lento en el juego. |
| **E3c** | El mejor tamaño de B1/E3a/E3b | Aumentación más fuerte de color, rotación y escala, y `mixup` | La webcam real tiene iluminación, ángulos y distancias distintas. Más variedad debería generalizar mejor y reducir la brecha train-val. |
| **E3d** | El mejor tamaño de B1/E3a/E3b | Resolución 800 en lugar de 640 | Las manos pequeñas o lejanas se detectan mejor con más resolución. Cuesta más latencia. |

### Experimentos sobre v2.2 (los que se entrenan ahora)

| Experimento | Parte de | Cambio | Hipótesis |
|---|---|---|---|
| **E4a** | `yolov8n.pt` (COCO) | Receta de E3c (aumentación fuerte) con hasta 150 épocas y paciencia 35 | E3c fue el mejor en v2.1 y seguía mejorando cerca de la época 80. Con train que ya incluye videos, debería subir sobre todo el **recall**. |
| **E4b** | `yolov8s.pt` (COCO) | Igual que E4a con un modelo más grande | En v2.1 un modelo más grande solo memorizaba. Con datos más variados puede aprovechar su capacidad. Es más lento en CPU. |

> Tiempo aproximado en T4: E4a unas 2 a 3 horas y E4b unas 3 a 4 horas. Si solo quieres un experimento, pon `EXPERIMENTOS_ACTIVOS = ["E4a"]`.

**Parámetros comunes:** hasta 100 épocas con parada temprana de 25 épocas sin mejora, lote 16, semilla 42, modo determinista, y gráficas activadas. Los resultados se guardan **directamente en Drive**, así que el checkpoint `last.pt` sobrevive a una desconexión.

> El orden importa: E3c y E3d eligen automáticamente su tamaño de modelo con los resultados de validación de B1, E3a y E3b. Si alguno de esos no ha terminado, E3c y E3d esperan a una sesión posterior.
''')

code(r'''
# @experimentos
# Parámetros compartidos por todos los experimentos.
COMUNES = {
    "epochs": 100,          # Máximo de épocas.
    "patience": 25,         # Parada temprana si la validación no mejora en 25 épocas.
    "imgsz": 640,           # Resolución de entrada.
    "batch": 16,            # Imágenes por lote.
    "workers": 2,           # Procesos de carga de datos en Colab.
    "seed": SEMILLA,        # Semilla fija.
    "deterministic": True,  # Operaciones reproducibles.
    "save": True,           # Guardar best.pt y last.pt.
    "save_period": -1,      # Sin checkpoints extra: last.pt basta para reanudar.
    "plots": True,          # Curvas, matriz de confusión y ejemplos.
    "exist_ok": False,      # Nunca sobrescribir un experimento.
    "verbose": True,
}

# Aumentación más fuerte para E3c.
AUMENTACION_FUERTE = {
    "hsv_h": 0.02,      # Variación de tono.
    "hsv_s": 0.8,       # Variación de saturación.
    "hsv_v": 0.5,       # Variación de brillo (iluminación de webcam).
    "degrees": 10.0,    # Rotaciones de hasta 10 grados.
    "translate": 0.15,  # Desplazamientos.
    "scale": 0.6,       # Cambios de distancia a la cámara.
    "mixup": 0.1,       # Mezcla de imágenes para regularizar.
}

# Experimentos ya ejecutados sobre v2.1 (se conservan para poder revisarlos).
EXPERIMENTOS_V21 = [
    {"nombre": "B1", "carpeta": "B1_yolov8n_v21", "pesos": "yolov8n.pt", "cambios": {},
     "hipotesis": "Línea base honesta sobre v2.1."},
    {"nombre": "E3a", "carpeta": "E3a_yolov8s_v21", "pesos": "yolov8s.pt", "cambios": {},
     "hipotesis": "Más capacidad mejora el recall."},
    {"nombre": "E3b", "carpeta": "E3b_yolov8m_v21", "pesos": "yolov8m.pt", "cambios": {},
     "hipotesis": "Aún más capacidad: ¿mejora o sobreajusta?"},
    {"nombre": "E3c", "carpeta": "E3c_{tam}_aumentacion_v21", "pesos": "AUTO", "cambios": AUMENTACION_FUERTE,
     "hipotesis": "Aumentación fuerte mejora la generalización a webcam."},
    {"nombre": "E3d", "carpeta": "E3d_{tam}_img800_v21", "pesos": "AUTO", "cambios": {"imgsz": 800},
     "hipotesis": "Mayor resolución mejora manos pequeñas o lejanas."},
]

# Experimentos sobre v2.2. En v2.1 ganó yolov8n con aumentación fuerte (E3c), seguía
# mejorando cerca de la época 80 y los modelos más grandes no ayudaron. Por eso:
ENTRENAMIENTO_LARGO = {"epochs": 150, "patience": 35}
EXPERIMENTOS_V22 = [
    {"nombre": "E4a", "carpeta": "E4a_yolov8n_aumentacion_v22", "pesos": "yolov8n.pt",
     "cambios": {**AUMENTACION_FUERTE, **ENTRENAMIENTO_LARGO},
     "hipotesis": "La receta ganadora de v2.1 (E3c) mejora claramente cuando train incluye todas las fuentes."},
    {"nombre": "E4b", "carpeta": "E4b_yolov8s_aumentacion_v22", "pesos": "yolov8s.pt",
     "cambios": {**AUMENTACION_FUERTE, **ENTRENAMIENTO_LARGO},
     "hipotesis": "Con datos más variados, un modelo más grande ya no memoriza y sí aprovecha su capacidad."},
]

EXPERIMENTOS = EXPERIMENTOS_V22 if DATASET == "v22" else EXPERIMENTOS_V21
EXPERIMENTOS_TAMANO = ["B1", "E3a", "E3b"]   # De estos se elige el tamaño para E3c y E3d (solo v2.1).
if EXPERIMENTOS_ACTIVOS is None:
    EXPERIMENTOS_ACTIVOS = [e["nombre"] for e in EXPERIMENTOS]

guardar_json(RUTAS["informes"] / "plan_experimental.json",
             {"comunes": COMUNES, "experimentos": EXPERIMENTOS, "fecha": ahora().isoformat()})
display(pd.DataFrame([{k: e[k] for k in ("nombre", "pesos", "hipotesis")} | {"cambios": e["cambios"]}
                      for e in EXPERIMENTOS]))
''')

# =====================================================================
# 09. ENTRENAMIENTO
# =====================================================================
md(r'''
---
# 09. Entrenamiento reanudable

**Objetivo:** entrenar los experimentos pendientes sin repetir los terminados.

**Estados posibles de un experimento:**

| Estado | Qué significa | Qué hace el notebook |
|---|---|---|
| `completo` | Existe `completado.json` | No lo toca |
| `interrumpido` | Existe `weights/last.pt` pero no `completado.json` | **Reanuda** con `resume=True` desde la última época |
| `vacio` | La carpeta existe pero sin pesos (falló al arrancar) | La renombra como `_fallido_<fecha>` y empieza de nuevo |
| `nuevo` | No hay carpeta | Empieza desde los pesos COCO |

> **Reanudar no es lo mismo que afinar.** `resume=True` continúa *el mismo* entrenamiento con su optimizador y su época. Cargar un `best.pt` terminado como punto de partida sería un experimento **nuevo**, y aquí no se hace.

Al terminar cada experimento se escribe `completado.json` con la época final, la mejor época, la duración y la huella de `best.pt`.
''')

code(r'''
import yaml


def tamano_desde_pesos(pesos):
    """Extrae 'yolov8n', 'yolov8s'... del nombre de unos pesos."""
    return Path(pesos).stem


def resultado_val(nombre_exp):
    """Devuelve el mAP@50 de validación guardado de un experimento, si existe."""
    exp = next(e for e in EXPERIMENTOS if e["nombre"] == nombre_exp)
    carpeta = carpeta_experimento(exp)
    datos = leer_json(carpeta / "metricas_val.json") if carpeta else None
    return datos["global"]["mAP50"] if datos else None


def resolver_pesos(exp):
    """Devuelve los pesos iniciales. Para 'AUTO' elige el mejor tamaño por validación."""
    if exp["pesos"] != "AUTO":
        return exp["pesos"]
    candidatos = [e for e in EXPERIMENTOS if e["nombre"] in EXPERIMENTOS_TAMANO
                  and e["nombre"] in EXPERIMENTOS_ACTIVOS]
    if not candidatos or any(estado(e) != "completo" for e in candidatos):
        return None
    puntajes = {e["pesos"]: resultado_val(e["nombre"]) for e in candidatos}
    if any(v is None for v in puntajes.values()):
        return None
    return max(puntajes, key=puntajes.get)


def carpeta_experimento(exp):
    """Ruta de la carpeta de un experimento. None si su tamaño aún no se puede decidir."""
    if exp["pesos"] != "AUTO":
        return RUTAS["experimentos"] / exp["carpeta"]
    # Si ya existe una carpeta de este experimento, se respeta la elección hecha.
    previas = sorted(p for p in RUTAS["experimentos"].glob(exp["carpeta"].replace("{tam}", "*"))
                     if "_fallido_" not in p.name)
    if previas:
        return previas[0]
    pesos = resolver_pesos(exp)
    return RUTAS["experimentos"] / exp["carpeta"].format(tam=tamano_desde_pesos(pesos)) if pesos else None


def estado(exp):
    """Clasifica un experimento en completo, interrumpido, vacio, nuevo o bloqueado."""
    carpeta = carpeta_experimento(exp)
    if carpeta is None:
        return "bloqueado"
    if (carpeta / "completado.json").is_file():
        return "completo"
    if (carpeta / "weights" / "last.pt").is_file():
        return "interrumpido"
    if carpeta.exists():
        return "vacio"
    return "nuevo"


def leer_resultados(carpeta):
    """Lee results.csv de Ultralytics con nombres de columna limpios."""
    df = pd.read_csv(carpeta / "results.csv")
    df.columns = [c.strip() for c in df.columns]
    return df


def marcar_completado(exp, carpeta, pesos_iniciales, duracion_s):
    """Escribe completado.json con el resumen del entrenamiento."""
    df = leer_resultados(carpeta)
    m50, m95 = "metrics/mAP50(B)", "metrics/mAP50-95(B)"
    # Ultralytics guarda best.pt con su 'fitness' (0,1·mAP50 + 0,9·mAP50-95).
    fitness = 0.1 * df[m50] + 0.9 * df[m95]
    mejor = int(df.loc[fitness.idxmax(), "epoch"])
    args = yaml.safe_load((carpeta / "args.yaml").read_text())
    datos = {
        "experimento": exp["nombre"],
        "carpeta": carpeta.name,
        "pesos_iniciales": pesos_iniciales,
        "hipotesis": exp["hipotesis"],
        "epocas_ejecutadas": int(df["epoch"].max()),
        "mejor_epoca": mejor,
        "duracion_horas_sesion": round(duracion_s / 3600, 3),
        "best_sha256": sha256_archivo(carpeta / "weights" / "best.pt"),
        "imgsz": args.get("imgsz"),
        "fecha": ahora().isoformat(),
        "entorno": entorno,
    }
    guardar_json(carpeta / "completado.json", datos)
    return datos


def checkpoint_reanudable(ruta):
    """True si el checkpoint conserva el optimizador y la época, es decir, si quedó a medias."""
    ckpt = torch.load(ruta, map_location="cpu", weights_only=False)
    return ckpt.get("optimizer") is not None and ckpt.get("epoch", -1) >= 0


def entrenar(exp):
    """Entrena, reanuda o salta un experimento según su estado."""
    est = estado(exp)
    carpeta = carpeta_experimento(exp)
    print(f"\n▶ {exp['nombre']}: estado = {est}")
    if est == "completo":
        print("  Ya terminado. No se repite.")
        return
    if est == "bloqueado":
        print("  Espera a que B1, E3a y E3b terminen para elegir su tamaño de modelo.")
        return
    if not ENTRENAR:
        print("  Pendiente. ENTRENAR = False, así que no se entrena.")
        return
    pesos = resolver_pesos(exp)
    if est == "vacio":
        apartada = carpeta.with_name(f"{carpeta.name}_fallido_{sello()}")
        os.replace(carpeta, apartada)
        print("  Carpeta sin pesos apartada en", apartada.name)
        est = "nuevo"
    inicio = time.time()
    if est == "interrumpido":
        ultimo = carpeta / "weights" / "last.pt"
        if checkpoint_reanudable(ultimo):
            print("  Reanudando desde", ultimo)
            YOLO(ultimo).train(resume=True)
        elif (carpeta / "weights" / "best.pt").is_file():
            # Al terminar, Ultralytics quita el optimizador de last.pt. Reanudar ese archivo
            # iniciaría un entrenamiento NUEVO con otro dataset, así que solo se registra.
            print("  El entrenamiento ya había terminado. Se registra como completo sin reentrenar.")
        else:
            raise RuntimeError(f"{ultimo} no se puede reanudar y no existe best.pt. Revisa la carpeta.")
    else:
        configuracion = {**COMUNES, **exp["cambios"], "data": str(DATA_YAML),
                         "project": str(RUTAS["experimentos"]), "name": carpeta.name,
                         "device": DISPOSITIVO}
        guardar_json(RUTAS["configs"] / f"{carpeta.name}_solicitada.json",
                     {"pesos_iniciales": pesos, **configuracion})
        print("  Pesos iniciales:", pesos)
        resultado = YOLO(pesos).train(**configuracion)
        guardado = Path(getattr(resultado, "save_dir", None) or carpeta)
        if guardado.resolve() != carpeta.resolve() and (guardado / "weights").exists():
            raise RuntimeError(f"Ultralytics guardó en {guardado} en lugar de {carpeta}. Revisa antes de seguir.")
    if not (carpeta / "weights" / "best.pt").is_file():
        raise RuntimeError(f"No se encontró best.pt en {carpeta}.")
    datos = marcar_completado(exp, carpeta, pesos, time.time() - inicio)
    print(f"  ✅ Terminado: {datos['epocas_ejecutadas']} épocas, mejor época {datos['mejor_epoca']}.")
''')

code(r'''
# Ejecutar los experimentos activos en orden.
# Después de cada experimento se calculan sus métricas de validación,
# porque E3c y E3d las necesitan para elegir el tamaño de modelo.
titulo("ENTRENAMIENTO")
for exp in EXPERIMENTOS:
    if exp["nombre"] not in EXPERIMENTOS_ACTIVOS:
        continue
    entrenar(exp)
    if estado(exp) == "completo":
        evaluar_validacion(exp)

display(pd.DataFrame([{"experimento": e["nombre"], "estado": estado(e),
                       "carpeta": (carpeta_experimento(e).name if carpeta_experimento(e) else "—")}
                      for e in EXPERIMENTOS if e["nombre"] in EXPERIMENTOS_ACTIVOS]))
''')

# The evaluation function must be defined before the training loop runs. Insert it
# in a cell before the loop (we reorder below).

EVAL_CELL = r'''
def metricas_desde_val(m):
    """Convierte la salida de model.val() en un diccionario global y por clase."""
    caja = m.box
    por_clase = {}
    for i, idx in enumerate(caja.ap_class_index):
        por_clase[CLASES[int(idx)]] = {"P": float(caja.p[i]), "R": float(caja.r[i]),
                                       "mAP50": float(caja.ap50[i]), "mAP50-95": float(caja.ap[i])}
    return {"global": {"P": float(caja.mp), "R": float(caja.mr),
                       "mAP50": float(caja.map50), "mAP50-95": float(caja.map)},
            "por_clase": por_clase,
            "velocidad_ms": {k: float(v) for k, v in m.speed.items()}}


def evaluar_validacion(exp):
    """Calcula (una vez) las métricas de validación y de train de un experimento."""
    carpeta = carpeta_experimento(exp)
    datos = leer_json(carpeta / "completado.json")
    imgsz = datos["imgsz"]
    modelo = None
    for split, archivo in (("val", "metricas_val.json"), ("train", "metricas_train.json")):
        if (carpeta / archivo).is_file():
            continue
        modelo = modelo or YOLO(carpeta / "weights" / "best.pt")
        print(f"  Evaluando {exp['nombre']} en {split}...")
        m = modelo.val(data=str(DATA_YAML), split=split, imgsz=imgsz, batch=16, device=DISPOSITIVO,
                       plots=(split == "val"), project=str(RUTAS["informes"] / "val"),
                       name=f"{carpeta.name}_{split}", exist_ok=True, verbose=False)
        guardar_json(carpeta / archivo, metricas_desde_val(m) | {"split": split, "fecha": ahora().isoformat()})
    if not (carpeta / "latencia.json").is_file():
        guardar_json(carpeta / "latencia.json", medir_latencia(carpeta / "weights" / "best.pt", imgsz))
'''

LAT_CELL = r'''
def imagenes_de(split, n=None, semilla=SEMILLA):
    """Devuelve rutas de imágenes de una partición (todas o una muestra fija)."""
    rutas = sorted((RUTAS["dataset_local"] / split / "images").iterdir())
    if n is not None and n < len(rutas):
        rutas = random.Random(semilla).sample(rutas, n)
    return rutas


def medir_latencia(pesos, imgsz, n=50):
    """Mide el tiempo medio por imagen en GPU (si hay) y en CPU con una muestra fija."""
    muestras = imagenes_de("valid", n)
    resultado = {}
    dispositivos = [("gpu", 0)] if GPU else []
    dispositivos.append(("cpu", "cpu"))
    for etiqueta, disp in dispositivos:
        modelo = YOLO(pesos)
        modelo.predict(muestras[0], imgsz=imgsz, device=disp, verbose=False)   # Calentamiento.
        tiempos = []
        for ruta in muestras[: (n if etiqueta == "gpu" else 20)]:
            t = time.perf_counter()
            modelo.predict(ruta, imgsz=imgsz, device=disp, verbose=False)
            tiempos.append((time.perf_counter() - t) * 1000)
        resultado[f"{etiqueta}_ms_mediana"] = float(np.median(tiempos))
    return resultado
'''

# =====================================================================
# 10. MÉTRICAS Y COMPARACIÓN
# =====================================================================
MD10 = r'''
---
# 10. Métricas y comparación de experimentos

**Objetivo:** comparar todos los experimentos terminados **en la misma validación v2.1**.

**Qué se muestra:**

1. **Tabla comparativa** con P, R, mAP@50 y mAP@50-95 de validación, épocas, latencia y brecha train-val. Se guarda como `comparacion_experimentos.csv`.
2. **Curvas de entrenamiento:** pérdida de train y de validación por época. Si la de validación sube mientras la de train sigue bajando, hay sobreajuste.
3. **Barras comparativas** con la meta del 90 % dibujada.
4. **Métricas por clase**, para ver si algún gesto se confunde más.
5. **Brecha de sobreajuste:** mAP@50 en train menos mAP@50 en validación.
6. **Precisión frente a velocidad**, porque el juego necesita responder rápido.

> **Nota sobre la brecha:** el train de Roboflow incluye copias aumentadas de las mismas fotos, así que el modelo las «conoce» mejor. Una brecha de unos puntos es normal. Por encima de 15 puntos se marca como posible sobreajuste.

> **Nota sobre la latencia:** se mide en Colab. La GPU T4 no representa tu computador. La cifra de CPU se parece más a lo que verá el juego, pero también depende del equipo.
'''

CMP_CELL = r'''
# Reunir las métricas de los experimentos terminados.
filas_cmp, filas_clase = [], []
for exp in EXPERIMENTOS:
    if exp["nombre"] not in EXPERIMENTOS_ACTIVOS or estado(exp) != "completo":
        continue
    carpeta = carpeta_experimento(exp)
    evaluar_validacion(exp)
    comp = leer_json(carpeta / "completado.json")
    val = leer_json(carpeta / "metricas_val.json")
    tr = leer_json(carpeta / "metricas_train.json")
    lat = leer_json(carpeta / "latencia.json")
    brecha = tr["global"]["mAP50"] - val["global"]["mAP50"]
    filas_cmp.append({
        "experimento": exp["nombre"], "carpeta": carpeta.name, "pesos_iniciales": comp["pesos_iniciales"],
        "imgsz": comp["imgsz"], "epocas": comp["epocas_ejecutadas"], "mejor_epoca": comp["mejor_epoca"],
        **{f"val_{k}": round(v, 4) for k, v in val["global"].items()},
        "train_mAP50": round(tr["global"]["mAP50"], 4), "brecha_mAP50": round(brecha, 4),
        "posible_sobreajuste": brecha > BRECHA_MAXIMA,
        **{k: round(v, 1) for k, v in lat.items()},
        "best_sha256": comp["best_sha256"],
    })
    for clase, met in val["por_clase"].items():
        filas_clase.append({"experimento": exp["nombre"], "clase": clase, **met})

COMPARACION = pd.DataFrame(filas_cmp)
POR_CLASE = pd.DataFrame(filas_clase)
if COMPARACION.empty:
    print("Todavía no hay experimentos terminados. Vuelve a ejecutar cuando termine alguno.")
else:
    COMPARACION.to_csv(RUTAS["informes"] / "comparacion_experimentos.csv", index=False)
    POR_CLASE.to_csv(RUTAS["informes"] / "metricas_por_clase_val.csv", index=False)
    titulo(f"COMPARACIÓN EN VALIDACIÓN {DATASET}")
    columnas = ["experimento", "pesos_iniciales", "imgsz", "epocas", "mejor_epoca", "val_P", "val_R",
                "val_mAP50", "val_mAP50-95", "train_mAP50", "brecha_mAP50", "posible_sobreajuste"]
    columnas += [c for c in COMPARACION.columns if c.endswith("_ms_mediana")]
    display(COMPARACION[columnas].style.format(precision=3)
            .background_gradient(subset=["val_mAP50", "val_mAP50-95"], cmap="Greens"))
'''

CURVAS_CELL = r'''
# Curvas de entrenamiento de cada experimento.
if not COMPARACION.empty:
    n = len(COMPARACION)
    fig, ejes = plt.subplots(n, 3, figsize=(17, 3.6 * n), squeeze=False)
    for fila_ax, (_, fila) in zip(ejes, COMPARACION.iterrows()):
        df = leer_resultados(RUTAS["experimentos"] / fila["carpeta"])
        # Pérdida de cajas: train frente a validación.
        fila_ax[0].plot(df["epoch"], df["train/box_loss"], label="train")
        fila_ax[0].plot(df["epoch"], df["val/box_loss"], label="validación")
        fila_ax[0].set_title(f"{fila['experimento']} · pérdida de caja")
        # Pérdida de clasificación: train frente a validación.
        fila_ax[1].plot(df["epoch"], df["train/cls_loss"], label="train")
        fila_ax[1].plot(df["epoch"], df["val/cls_loss"], label="validación")
        fila_ax[1].set_title(f"{fila['experimento']} · pérdida de clase")
        # Métricas de validación por época.
        for col, nombre in (("metrics/precision(B)", "P"), ("metrics/recall(B)", "R"),
                            ("metrics/mAP50(B)", "mAP50"), ("metrics/mAP50-95(B)", "mAP50-95")):
            fila_ax[2].plot(df["epoch"], df[col], label=nombre)
        fila_ax[2].axhline(META, ls="--", color="k", lw=1)
        fila_ax[2].axvline(fila["mejor_epoca"], ls=":", color="gray")
        fila_ax[2].set_ylim(0, 1)
        fila_ax[2].set_title(f"{fila['experimento']} · métricas de validación")
        for ax in fila_ax:
            ax.set_xlabel("época")
            ax.legend(fontsize=8)
    fig.tight_layout()
    guardar_figura(fig, "10_curvas_entrenamiento")
'''

BARRAS_CELL = r'''
if not COMPARACION.empty:
    # Barras de métricas globales con la meta del 90 %.
    fig, ejes = plt.subplots(1, 3, figsize=(18, 4.5))
    metricas = ["val_P", "val_R", "val_mAP50", "val_mAP50-95"]
    x = np.arange(len(COMPARACION))
    ancho = 0.2
    for i, met in enumerate(metricas):
        ejes[0].bar(x + (i - 1.5) * ancho, COMPARACION[met], ancho, label=met.replace("val_", ""))
    ejes[0].axhline(META, ls="--", color="k", label="meta 90 %")
    ejes[0].set_xticks(x, COMPARACION["experimento"])
    ejes[0].set_ylim(0, 1)
    ejes[0].set_title(f"Validación {DATASET} · métricas globales")
    ejes[0].legend(fontsize=8)

    # Brecha train-validación.
    colores = ["#E45756" if s else "#54A24B" for s in COMPARACION["posible_sobreajuste"]]
    ejes[1].bar(COMPARACION["experimento"], COMPARACION["brecha_mAP50"], color=colores)
    ejes[1].axhline(BRECHA_MAXIMA, ls="--", color="k", label=f"límite {BRECHA_MAXIMA:.2f}")
    ejes[1].set_title("Brecha mAP@50 (train − validación)")
    ejes[1].legend()

    # Precisión frente a velocidad en CPU.
    ejes[2].scatter(COMPARACION["cpu_ms_mediana"], COMPARACION["val_mAP50"], s=80)
    for _, fila in COMPARACION.iterrows():
        ejes[2].annotate(fila["experimento"], (fila["cpu_ms_mediana"], fila["val_mAP50"]),
                         xytext=(5, 5), textcoords="offset points")
    ejes[2].set_xlabel("ms por imagen en CPU de Colab (mediana)")
    ejes[2].set_ylabel("mAP@50 validación")
    ejes[2].set_title("Precisión frente a velocidad")
    guardar_figura(fig, "10_comparacion")

    # Métricas por clase.
    fig, ejes = plt.subplots(1, 3, figsize=(18, 4.2), sharey=True)
    for ax, met in zip(ejes, ("P", "R", "mAP50")):
        tabla = POR_CLASE.pivot(index="experimento", columns="clase", values=met).reindex(COMPARACION["experimento"])
        tabla.plot(kind="bar", ax=ax, color=[COLORES[c] for c in tabla.columns], rot=0)
        ax.axhline(META, ls="--", color="k", lw=1)
        ax.set_ylim(0, 1)
        ax.set_title(f"{met} por clase (validación)")
    guardar_figura(fig, "10_por_clase")
'''

# =====================================================================
# 11. SELECCIÓN
# =====================================================================
MD11 = r'''
---
# 11. Selección responsable del modelo y umbral del juego

**Regla de selección (solo con validación):**

1. Se descartan los experimentos marcados con posible sobreajuste, salvo que todos lo estén.
2. Se elige el de mayor **mAP@50 de validación**.
3. Si dos quedan a menos de 1 punto, gana el de mayor **mAP@50-95** y, si siguen empatados, el **más rápido en CPU**.

La selección queda **congelada** en cuanto se evalúa el test interno. Así el test no puede influir en la elección.

### Exactitud de decisión del juego

El mAP evalúa cajas, pero el juego necesita una **decisión por imagen**: Papel, Piedra, Tijera o **Nada**. Para cada imagen de validación:

- se toma la detección con mayor confianza por encima de un **umbral**,
- si no hay ninguna, la decisión es «Nada»,
- se compara con la verdad (una imagen negativa debería dar «Nada»).

Se prueban umbrales de 0,10 a 0,90 y se elige el que maximiza la **exactitud balanceada** (el promedio de aciertos de las cuatro opciones, para que «Nada» no domine). Este umbral se guarda en `config_inferencia.json` y es el que usará el juego.

Las imágenes con dos gestos distintos a la vez se excluyen de esta medida porque no tienen una única respuesta correcta.
'''

SEL_CELL = r'''
titulo("SELECCIÓN DEL MODELO")
ruta_seleccion = RUTAS["informes"] / "seleccion.json"
ruta_test = RUTAS["informes"] / "test_interno_evaluado.json"
SELECCION = leer_json(ruta_seleccion)

if ruta_test.is_file() and SELECCION:
    print("🔒 El test interno ya se evaluó. La selección queda congelada:", SELECCION["experimento"])
elif COMPARACION.empty:
    print("No hay experimentos terminados todavía.")
else:
    candidatos = COMPARACION[~COMPARACION["posible_sobreajuste"]]
    if candidatos.empty:
        print("⚠️ Todos los experimentos tienen brecha alta. Se elige igualmente entre todos.")
        candidatos = COMPARACION
    mejor_map50 = candidatos["val_mAP50"].max()
    finalistas = candidatos[candidatos["val_mAP50"] >= mejor_map50 - 0.01]
    finalistas = finalistas.sort_values(["val_mAP50-95", "cpu_ms_mediana"], ascending=[False, True])
    elegido = finalistas.iloc[0]
    pendientes = [e["nombre"] for e in EXPERIMENTOS
                  if e["nombre"] in EXPERIMENTOS_ACTIVOS and estado(e) != "completo"]
    SELECCION = {
        "experimento": elegido["experimento"],
        "carpeta": elegido["carpeta"],
        "imgsz": int(elegido["imgsz"]),
        "best_sha256": elegido["best_sha256"],
        "val": {k: float(elegido[f"val_{k}"]) for k in ("P", "R", "mAP50", "mAP50-95")},
        "brecha_mAP50": float(elegido["brecha_mAP50"]),
        "finalistas": finalistas["experimento"].tolist(),
        "experimentos_pendientes": pendientes,
        "regla": "sin sobreajuste → mayor mAP50 val → empate <1 pt: mayor mAP50-95 → menor latencia CPU",
        "fecha": ahora().isoformat(),
    }
    guardar_json(ruta_seleccion, SELECCION)
    if pendientes:
        print("⚠️ Selección PROVISIONAL: faltan por terminar", pendientes)

if SELECCION:
    print("Modelo elegido:", SELECCION["experimento"], "·", SELECCION["carpeta"])
    for k, v in SELECCION["val"].items():
        marca = "✅" if v >= META else "—"
        print(f"  {k:>9} validación: {v:.3f} {marca}")
    PESOS_ELEGIDOS = RUTAS["experimentos"] / SELECCION["carpeta"] / "weights" / "best.pt"
    assert sha256_archivo(PESOS_ELEGIDOS) == SELECCION["best_sha256"], "best.pt cambió desde la selección."
    # Copia versionada del modelo elegido (nunca se sobrescribe).
    destino_modelo = RUTAS["modelos"] / SELECCION["carpeta"] / "best.pt"
    if not destino_modelo.is_file():
        destino_modelo.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(PESOS_ELEGIDOS, destino_modelo)
    print("Copia del modelo:", destino_modelo)
'''

DEC_CELL = r'''
def verdad_juego(ruta_img):
    """Respuesta correcta de una imagen para el juego, o None si tiene gestos mezclados."""
    lbl = ruta_img.parent.parent / "labels" / (ruta_img.stem + ".txt")
    clases = {c for c, *_ in leer_etiquetas(lbl)}
    if not clases:
        return "Nada"
    if len(clases) == 1:
        return CLASES[clases.pop()]
    return None


def predecir_candidatos(modelo, rutas, imgsz, lote=32):
    """Para cada imagen devuelve (clase, confianza) de su detección más segura, o None."""
    salida = []
    for i in range(0, len(rutas), lote):
        for r in modelo.predict([str(p) for p in rutas[i:i + lote]], imgsz=imgsz, conf=0.05,
                                device=DISPOSITIVO, verbose=False):
            if len(r.boxes):
                j = int(r.boxes.conf.argmax())
                salida.append((CLASES[int(r.boxes.cls[j])], float(r.boxes.conf[j])))
            else:
                salida.append(None)
    return salida


def decidir(candidato, umbral):
    """Convierte la mejor detección en una decisión del juego."""
    return candidato[0] if candidato and candidato[1] >= umbral else "Nada"


def evaluar_decisiones(verdades, candidatos, umbral):
    """Exactitud global, balanceada y matriz de confusión para un umbral."""
    pred = [decidir(c, umbral) for c in candidatos]
    matriz = pd.crosstab(pd.Categorical(verdades, CLASES_JUEGO), pd.Categorical(pred, CLASES_JUEGO),
                         rownames=["verdad"], colnames=["decisión"], dropna=False)
    aciertos_clase = {c: (matriz.loc[c, c] / matriz.loc[c].sum()) if matriz.loc[c].sum() else np.nan
                      for c in CLASES_JUEGO}
    return {"umbral": umbral,
            "exactitud": float(np.mean([v == p for v, p in zip(verdades, pred)])),
            "exactitud_balanceada": float(np.nanmean(list(aciertos_clase.values()))),
            "acierto_por_clase": {k: float(v) for k, v in aciertos_clase.items()},
            "falsas_activaciones": float(1 - aciertos_clase["Nada"]) if not np.isnan(aciertos_clase["Nada"]) else None,
            "matriz": matriz}


def dibujar_matriz(matriz, titulo_fig, nombre):
    """Dibuja una matriz de confusión con los conteos."""
    fig, ax = plt.subplots(figsize=(5.5, 4.5))
    valores = matriz.values
    normalizada = valores / np.maximum(valores.sum(axis=1, keepdims=True), 1)
    ax.imshow(normalizada, cmap="Blues", vmin=0, vmax=1)
    for i in range(valores.shape[0]):
        for j in range(valores.shape[1]):
            ax.text(j, i, f"{valores[i, j]}\n{normalizada[i, j]:.0%}", ha="center", va="center",
                    color="white" if normalizada[i, j] > 0.5 else "black", fontsize=9)
    ax.set_xticks(range(len(CLASES_JUEGO)), CLASES_JUEGO)
    ax.set_yticks(range(len(CLASES_JUEGO)), CLASES_JUEGO)
    ax.set_xlabel("decisión del modelo")
    ax.set_ylabel("verdad")
    ax.set_title(titulo_fig)
    ax.grid(False)
    return guardar_figura(fig, nombre)


ruta_inferencia = RUTAS["informes"] / "config_inferencia.json"
if SELECCION:
    CONFIG_INFERENCIA = leer_json(ruta_inferencia)
    if CONFIG_INFERENCIA and CONFIG_INFERENCIA.get("best_sha256") == SELECCION["best_sha256"]:
        print("Umbral ya calibrado para este modelo:", CONFIG_INFERENCIA["umbral_confianza"])
    else:
        titulo("CALIBRACIÓN DEL UMBRAL EN VALIDACIÓN")
        modelo_elegido = YOLO(PESOS_ELEGIDOS)
        rutas_val = [p for p in imagenes_de("valid") if verdad_juego(p) is not None]
        verdades_val = [verdad_juego(p) for p in rutas_val]
        cand_val = predecir_candidatos(modelo_elegido, rutas_val, SELECCION["imgsz"])
        umbrales = np.round(np.arange(0.10, 0.91, 0.05), 2)
        barrido = [evaluar_decisiones(verdades_val, cand_val, float(u)) for u in umbrales]
        mejor = max(barrido, key=lambda r: r["exactitud_balanceada"])

        fig, ax = plt.subplots(figsize=(8, 4))
        ax.plot(umbrales, [r["exactitud"] for r in barrido], label="exactitud")
        ax.plot(umbrales, [r["exactitud_balanceada"] for r in barrido], label="exactitud balanceada")
        ax.plot(umbrales, [r["falsas_activaciones"] for r in barrido], label="falsas activaciones")
        ax.axvline(mejor["umbral"], ls=":", color="k", label=f"umbral elegido {mejor['umbral']:.2f}")
        ax.axhline(META, ls="--", color="gray", lw=1)
        ax.set_xlabel("umbral de confianza")
        ax.set_ylim(0, 1)
        ax.set_title("Decisión del juego en validación según el umbral")
        ax.legend()
        guardar_figura(fig, "11_umbral_validacion")
        dibujar_matriz(mejor["matriz"], f"Validación · umbral {mejor['umbral']:.2f}", "11_matriz_juego_validacion")

        CONFIG_INFERENCIA = {
            "modelo": SELECCION["carpeta"],
            "best_sha256": SELECCION["best_sha256"],
            "clases": {i: c for i, c in enumerate(CLASES)},
            "imgsz": SELECCION["imgsz"],
            "umbral_confianza": mejor["umbral"],
            "iou_nms": 0.7,
            "regla_varias_manos": "se usa la detección con mayor confianza",
            "filtro_temporal": {"ventana_s": 2.0, "fotogramas_min": 5, "mayoria_min": 0.6,
                                "nota": "propuesta inicial, ajustar con la prueba de webcam"},
            "validacion": {k: v for k, v in mejor.items() if k != "matriz"},
            "imagenes_excluidas_por_gesto_mixto": len(imagenes_de("valid")) - len(rutas_val),
            "fecha": ahora().isoformat(),
        }
        guardar_json(ruta_inferencia, CONFIG_INFERENCIA)
    v = CONFIG_INFERENCIA["validacion"]
    print(f"Umbral: {CONFIG_INFERENCIA['umbral_confianza']:.2f}")
    print(f"Exactitud de decisión en validación: {v['exactitud']:.3f}")
    print(f"Exactitud balanceada en validación: {v['exactitud_balanceada']:.3f}")
    print("Acierto por clase:", {k: round(x, 3) for k, x in v["acierto_por_clase"].items()})

    escribir_bitacora(
        "06", "Entrenamiento y seleccion", "PARCIAL" if SELECCION.get("experimentos_pendientes") else "COMPLETADO",
        f"Entrenar los experimentos sobre {DATASET} y elegir el mejor modelo solo con validación.",
        [f"Experimentos terminados: {', '.join(COMPARACION['experimento'])}",
         f"Regla: {SELECCION['regla']}"],
        [f"{f['experimento']}: P {f['val_P']:.3f} · R {f['val_R']:.3f} · mAP50 {f['val_mAP50']:.3f} · "
         f"mAP50-95 {f['val_mAP50-95']:.3f} · brecha {f['brecha_mAP50']:.3f}" for _, f in COMPARACION.iterrows()]
        + [f"Elegido: {SELECCION['experimento']} con umbral {CONFIG_INFERENCIA['umbral_confianza']:.2f}"],
        [str(RUTAS["informes"] / "comparacion_experimentos.csv"), str(ruta_seleccion), str(ruta_inferencia)],
        ([f"Pendientes: {SELECCION['experimentos_pendientes']}"] if SELECCION.get("experimentos_pendientes") else [])
        + ([] if SELECCION["val"]["mAP50"] >= META else ["mAP50 de validación por debajo de la meta del 90 %."]),
        "Evaluar una vez en test interno y exportar a ONNX (capítulos 12 y 13).",
    )
'''

# =====================================================================
# 12. TEST
# =====================================================================
MD12 = r'''
---
# 12. Test interno y evaluación externa

## Test interno

Se evalúa **solo el modelo elegido** y **una sola vez**. El resultado se guarda en `test_interno_evaluado.json` junto con la huella del modelo. Si más adelante se elige otro modelo, el notebook **no** lo evaluará en test (salvo `FORZAR_TEST_NUEVO = True`), porque probar varios modelos en test y quedarse con el mejor convertiría el test en otra validación.

Si la selección todavía es provisional (faltan experimentos), el test **espera**.

## Conjunto externo independiente

Es la prueba más convincente: fotos **nuevas**, tomadas con **tu cámara**, de **personas, fondos e iluminación** que el modelo nunca vio.

**Protocolo recomendado:**

- Al menos 3 personas, 2 lugares y 2 condiciones de luz.
- Unas 30 fotos por opción: Paper, Rock, Scissors y Nada (sin mano o con la mano relajada).
- Distancias habituales del juego (unos 40 a 100 cm de la cámara).

Puedes tomarlas con la celda de captura (`CAPTURAR_EXTERNO = True`) o copiarlas a mano en Drive:

```text
MyDrive/Michikenbo/datasets/externo_v1/
  Paper/   Rock/   Scissors/   Nada/
```

Una vez evaluado, el conjunto externo **no se usa para reentrenar ni para cambiar el umbral**.
'''

TEST_CELL = r'''
titulo("TEST INTERNO")
REGISTRO_TEST = leer_json(ruta_test)
if not SELECCION:
    print("No hay modelo elegido todavía.")
elif SELECCION.get("experimentos_pendientes") and not REGISTRO_TEST:
    print("⏸️ La selección es provisional. El test se evaluará cuando terminen:",
          SELECCION["experimentos_pendientes"])
elif REGISTRO_TEST and REGISTRO_TEST["best_sha256"] != SELECCION["best_sha256"] and not FORZAR_TEST_NUEVO:
    print("🔒 El test ya se usó con otro modelo:", REGISTRO_TEST["modelo"], "· no se evalúa uno nuevo.")
elif not EVALUAR_TEST:
    print("EVALUAR_TEST = False.")
else:
    if not REGISTRO_TEST or REGISTRO_TEST["best_sha256"] != SELECCION["best_sha256"]:
        print("Evaluando el modelo elegido en test interno (única vez)...")
        modelo_elegido = YOLO(PESOS_ELEGIDOS)
        m = modelo_elegido.val(data=str(DATA_YAML), split="test", imgsz=SELECCION["imgsz"], batch=16,
                               device=DISPOSITIVO, plots=True, project=str(RUTAS["informes"] / "val"),
                               name=f"{SELECCION['carpeta']}_test", exist_ok=True, verbose=False)
        rutas_test = [p for p in imagenes_de("test") if verdad_juego(p) is not None]
        verdades_test = [verdad_juego(p) for p in rutas_test]
        cand_test = predecir_candidatos(modelo_elegido, rutas_test, SELECCION["imgsz"])
        juego_test = evaluar_decisiones(verdades_test, cand_test, CONFIG_INFERENCIA["umbral_confianza"])
        dibujar_matriz(juego_test["matriz"], "Test interno · decisión del juego", "12_matriz_juego_test")
        REGISTRO_TEST = {
            "modelo": SELECCION["carpeta"], "best_sha256": SELECCION["best_sha256"],
            "deteccion": metricas_desde_val(m),
            "juego": {k: v for k, v in juego_test.items() if k != "matriz"},
            "matriz_juego": juego_test["matriz"].to_dict(),
            "advertencia": "Test interno parcialmente inspeccionado en auditorías visuales anteriores.",
            "forzado": bool(REGISTRO_TEST),
            "fecha": ahora().isoformat(),
        }
        historial = RUTAS["informes"] / f"test_interno_{sello()}.json"
        guardar_json(historial, REGISTRO_TEST)
        guardar_json(ruta_test, REGISTRO_TEST)
    g = REGISTRO_TEST["deteccion"]["global"]
    print("Modelo:", REGISTRO_TEST["modelo"])
    display(pd.DataFrame({"validación": SELECCION["val"], "test interno": g}).T.style.format("{:.3f}"))
    display(pd.DataFrame(REGISTRO_TEST["deteccion"]["por_clase"]).T.style.format("{:.3f}"))
    j = REGISTRO_TEST["juego"]
    print(f"Decisión del juego en test: exactitud {j['exactitud']:.3f} · balanceada {j['exactitud_balanceada']:.3f}")
    print("⚠️", REGISTRO_TEST["advertencia"])
'''

CAPTURA_CELL = r'''
# Utilidades de cámara en Colab: abren la webcam en el navegador y devuelven fotos.
def capturar_rafaga(n_fotos=12, intervalo_ms=160, cuenta=3, mensaje="Muestra tu gesto"):
    """Abre la cámara, hace una cuenta atrás y devuelve una lista de imágenes PIL."""
    from IPython.display import Javascript, display as mostrar
    from google.colab.output import eval_js
    import base64
    mostrar(Javascript("""
    async function capturarRafaga(n, intervalo, cuenta, mensaje) {
      const caja = document.createElement('div');
      const aviso = document.createElement('h3');
      const video = document.createElement('video');
      video.style.maxWidth = '480px';
      caja.appendChild(aviso); caja.appendChild(video);
      document.body.appendChild(caja);
      const stream = await navigator.mediaDevices.getUserMedia({video: true});
      video.srcObject = stream;
      await video.play();
      google.colab.output.setIframeHeight(document.documentElement.scrollHeight, true);
      for (let s = cuenta; s > 0; s--) {
        aviso.textContent = mensaje + ' en ' + s + '...';
        await new Promise(r => setTimeout(r, 1000));
      }
      aviso.textContent = '¡Ahora!';
      const lienzo = document.createElement('canvas');
      lienzo.width = video.videoWidth; lienzo.height = video.videoHeight;
      const fotos = [];
      for (let i = 0; i < n; i++) {
        lienzo.getContext('2d').drawImage(video, 0, 0);
        fotos.push(lienzo.toDataURL('image/jpeg', 0.9));
        await new Promise(r => setTimeout(r, intervalo));
      }
      stream.getVideoTracks()[0].stop();
      caja.remove();
      return fotos;
    }
    """))
    datos = eval_js(f"capturarRafaga({n_fotos}, {intervalo_ms}, {cuenta}, {json.dumps(mensaje)})")
    return [Image.open(io.BytesIO(base64.b64decode(d.split(",")[1]))).convert("RGB") for d in datos]


# Captura guiada del conjunto externo.
if CAPTURAR_EXTERNO:
    assert EN_COLAB, "La captura con cámara solo funciona en Colab."
    persona = input("Nombre corto o código de la persona (sin espacios): ").strip() or "anonimo"
    lugar = input("Lugar o condición de luz (sin espacios): ").strip() or "lugar"
    for clase in CLASES_JUEGO:
        carpeta = RUTAS["externo"] / clase
        carpeta.mkdir(parents=True, exist_ok=True)
        fotos = capturar_rafaga(n_fotos=10, intervalo_ms=400, cuenta=3,
                                mensaje=f"Muestra {clase}" if clase != "Nada" else "Sin gesto")
        for i, foto in enumerate(fotos):
            foto.save(carpeta / f"{persona}_{lugar}_{sello()}_{i:02d}.jpg", quality=92)
        print(f"{clase}: {len(fotos)} fotos guardadas en {carpeta}")
else:
    print("CAPTURAR_EXTERNO = False. No se abre la cámara.")
'''

EXT_CELL = r'''
titulo("EVALUACIÓN EXTERNA")
carpetas_ext = {c: RUTAS["externo"] / c for c in CLASES_JUEGO}
fotos_ext = {c: sorted(p for p in d.glob("*") if p.suffix.lower() in (".jpg", ".jpeg", ".png"))
             for c, d in carpetas_ext.items() if d.is_dir()}
total_ext = sum(len(v) for v in fotos_ext.values())
if not SELECCION:
    print("No hay modelo elegido todavía.")
elif total_ext == 0:
    print("Todavía no hay conjunto externo en", RUTAS["externo"])
else:
    huella_conjunto = hashlib.sha256("".join(sorted(str(p.name) for v in fotos_ext.values() for p in v)).encode()).hexdigest()
    ruta_ext = RUTAS["informes"] / f"externo_{SELECCION['carpeta']}_{huella_conjunto[:10]}.json"
    if ruta_ext.is_file():
        resultado_ext = leer_json(ruta_ext)
        print("Resultado ya calculado para este modelo y este conjunto.")
    else:
        modelo_elegido = YOLO(PESOS_ELEGIDOS)
        rutas_ext = [p for v in fotos_ext.values() for p in v]
        verdades_ext = [c for c, v in fotos_ext.items() for _ in v]
        cand_ext = predecir_candidatos(modelo_elegido, rutas_ext, SELECCION["imgsz"])
        ev = evaluar_decisiones(verdades_ext, cand_ext, CONFIG_INFERENCIA["umbral_confianza"])
        dibujar_matriz(ev["matriz"], "Conjunto externo · decisión del juego", "12_matriz_juego_externo")
        resultado_ext = {"modelo": SELECCION["carpeta"], "fotos": {c: len(v) for c, v in fotos_ext.items()},
                         **{k: v for k, v in ev.items() if k != "matriz"},
                         "matriz": ev["matriz"].to_dict(), "fecha": ahora().isoformat()}
        guardar_json(ruta_ext, resultado_ext)
    print("Fotos por clase:", resultado_ext["fotos"])
    print(f"Exactitud: {resultado_ext['exactitud']:.3f} · balanceada: {resultado_ext['exactitud_balanceada']:.3f}")
    print("Acierto por clase:", {k: (round(v, 3) if v == v else None) for k, v in resultado_ext["acierto_por_clase"].items()})
'''

# =====================================================================
# 13. ONNX
# =====================================================================
MD13 = r'''
---
# 13. Exportación a ONNX y verificación

**Objetivo:** obtener un modelo portable para el juego (navegador o Python sin PyTorch) y comprobar que **decide lo mismo** que el `.pt`.

**Qué se comprueba:**

- Mapa de clases idéntico (0=Paper, 1=Rock, 2=Scissors).
- **Coincidencia de decisiones** entre `.pt` y `.onnx` en 60 imágenes de validación con el umbral del juego.
- Diferencia de confianza y latencia en CPU de ambos formatos.

> Que el ONNX funcione aquí **no garantiza** el rendimiento en todos los navegadores. Eso se probará cuando se construya el juego.
'''

ONNX_CELL = r'''
titulo("EXPORTACIÓN ONNX")
if not (SELECCION and EXPORTAR_ONNX):
    print("Nada que exportar todavía (o EXPORTAR_ONNX = False).")
else:
    destino_onnx = RUTAS["modelos"] / SELECCION["carpeta"] / "best.onnx"
    ruta_verif = RUTAS["modelos"] / SELECCION["carpeta"] / "verificacion_onnx.json"
    if not destino_onnx.is_file():
        copia_local = RUTAS["construccion"] / "export" / "best.pt"
        copia_local.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(PESOS_ELEGIDOS, copia_local)
        exportado = YOLO(copia_local).export(format="onnx", imgsz=SELECCION["imgsz"], simplify=True,
                                             dynamic=False, device="cpu")
        shutil.copyfile(exportado, destino_onnx)
    print("ONNX:", destino_onnx, f"({destino_onnx.stat().st_size / 2**20:.1f} MiB)")

    if ruta_verif.is_file() and leer_json(ruta_verif).get("onnx_sha256") == sha256_archivo(destino_onnx):
        VERIF_ONNX = leer_json(ruta_verif)
    else:
        muestras = imagenes_de("valid", 60)
        umbral = CONFIG_INFERENCIA["umbral_confianza"]
        mod_pt = YOLO(PESOS_ELEGIDOS)
        mod_onnx = YOLO(str(destino_onnx), task="detect")
        assert {int(k): v for k, v in mod_onnx.names.items()} == dict(enumerate(CLASES)), "Mapa de clases distinto."
        coinciden, dif_conf, t_pt, t_onnx = 0, [], [], []
        for ruta in muestras:
            t = time.perf_counter()
            a = mod_pt.predict(str(ruta), imgsz=SELECCION["imgsz"], conf=0.05, device="cpu", verbose=False)[0]
            t_pt.append((time.perf_counter() - t) * 1000)
            t = time.perf_counter()
            b = mod_onnx.predict(str(ruta), imgsz=SELECCION["imgsz"], conf=0.05, device="cpu", verbose=False)[0]
            t_onnx.append((time.perf_counter() - t) * 1000)
            ca = (CLASES[int(a.boxes.cls[a.boxes.conf.argmax()])], float(a.boxes.conf.max())) if len(a.boxes) else None
            cb = (CLASES[int(b.boxes.cls[b.boxes.conf.argmax()])], float(b.boxes.conf.max())) if len(b.boxes) else None
            coinciden += decidir(ca, umbral) == decidir(cb, umbral)
            if ca and cb:
                dif_conf.append(abs(ca[1] - cb[1]))
        VERIF_ONNX = {
            "onnx_sha256": sha256_archivo(destino_onnx),
            "pt_sha256": SELECCION["best_sha256"],
            "imagenes": len(muestras),
            "coincidencia_decisiones": coinciden / len(muestras),
            "dif_confianza_media": float(np.mean(dif_conf)) if dif_conf else None,
            "cpu_ms_mediana_pt": float(np.median(t_pt[1:])),
            "cpu_ms_mediana_onnx": float(np.median(t_onnx[1:])),
            "fecha": ahora().isoformat(),
        }
        guardar_json(ruta_verif, VERIF_ONNX)
    for k, v in VERIF_ONNX.items():
        print(f"{k:>26}: {v}")
    if VERIF_ONNX["coincidencia_decisiones"] < 0.98:
        print("⚠️ El ONNX no decide igual que el .pt en más del 2 % de los casos. Revisar antes de usarlo.")
'''

# =====================================================================
# 14. WEBCAM
# =====================================================================
MD14 = r'''
---
# 14. Prueba de webcam

Hay dos formas de probar el modelo con cámara real:

**A. En Colab (`PROBAR_WEBCAM = True`):** simula rondas del juego. En cada ronda hay cuenta atrás de 3 segundos, luego se toman 12 fotos en unos 2 segundos, se decide cada foto y se aplica el **filtro temporal** (mayoría de al menos 60 % entre las fotos con gesto). Así se ve si la decisión es estable. La latencia aquí es la del servidor de Colab, no la de tu computador.

**B. En tu computador (Windows, VS Code):** el notebook escribe `webcam_local.py` en la carpeta del modelo en Drive. Ese script abre la cámara en tiempo real, dibuja las cajas, muestra los FPS y la decisión estable. Es la prueba de latencia que de verdad importa para el juego.

```text
# En la terminal de VS Code, dentro de tu .venv:
pip install ultralytics==8.4.215 opencv-python
python webcam_local.py --modelo best.pt
```
'''

WEB_CELL = r'''
def decision_estable(decisiones, fotogramas_min, mayoria_min):
    """Aplica el filtro temporal: mayoría entre los fotogramas que vieron un gesto."""
    gestos = [d for d in decisiones if d != "Nada"]
    if len(gestos) < fotogramas_min:
        return "Nada", 0.0
    clase, votos = Counter(gestos).most_common(1)[0]
    proporcion = votos / len(gestos)
    return (clase if proporcion >= mayoria_min else "Nada"), proporcion


if PROBAR_WEBCAM and SELECCION:
    assert EN_COLAB, "Esta prueba usa la cámara a través de Colab."
    modelo_elegido = YOLO(PESOS_ELEGIDOS)
    filtro = CONFIG_INFERENCIA["filtro_temporal"]
    rondas = []
    for gesto in ["Rock", "Paper", "Scissors", "Nada"] * 2:
        fotos = capturar_rafaga(n_fotos=12, intervalo_ms=160, mensaje=f"Ronda: muestra {gesto}")
        t = time.perf_counter()
        resultados = modelo_elegido.predict(fotos, imgsz=SELECCION["imgsz"], conf=0.05, device=DISPOSITIVO, verbose=False)
        ms = (time.perf_counter() - t) * 1000 / len(fotos)
        decisiones = []
        for r in resultados:
            c = (CLASES[int(r.boxes.cls[r.boxes.conf.argmax()])], float(r.boxes.conf.max())) if len(r.boxes) else None
            decisiones.append(decidir(c, CONFIG_INFERENCIA["umbral_confianza"]))
        final, proporcion = decision_estable(decisiones, filtro["fotogramas_min"], filtro["mayoria_min"])
        rondas.append({"esperado": gesto, "decision": final, "acuerdo": round(proporcion, 2),
                       "por_foto": " ".join(d[0] for d in decisiones), "ms_por_foto": round(ms, 1)})
        print(f"Esperado {gesto:>8} → decidido {final:>8} · fotos: {rondas[-1]['por_foto']}")
        # Mostrar la última foto con sus cajas.
        plt.figure(figsize=(4, 3))
        plt.imshow(resultados[-1].plot()[:, :, ::-1])
        plt.axis("off")
        plt.show()
    df_rondas = pd.DataFrame(rondas)
    display(df_rondas)
    print("Acierto de rondas:", f"{(df_rondas['esperado'] == df_rondas['decision']).mean():.0%}")
    guardar_json(RUTAS["informes"] / f"webcam_colab_{sello()}.json", rondas)
else:
    print("PROBAR_WEBCAM = False o sin modelo elegido. No se abre la cámara.")
'''

LOCAL_CELL = r'''
# Escribir el script de prueba local para Windows junto al modelo elegido.
SCRIPT_LOCAL = r"""
# webcam_local.py — Prueba en tiempo real del detector de Michikembo.
# Uso:  python webcam_local.py --modelo best.pt  [--umbral 0.5] [--camara 0]
# Teclas: Q o Esc para salir.
import argparse
import time
from collections import Counter, deque

import cv2
from ultralytics import YOLO

CLASES = ["Paper", "Rock", "Scissors"]

parser = argparse.ArgumentParser()
parser.add_argument("--modelo", default="best.pt")
parser.add_argument("--umbral", type=float, default=__UMBRAL__)
parser.add_argument("--imgsz", type=int, default=__IMGSZ__)
parser.add_argument("--camara", type=int, default=0)
parser.add_argument("--ventana", type=float, default=2.0, help="segundos del filtro temporal")
args = parser.parse_args()

modelo = YOLO(args.modelo)
camara = cv2.VideoCapture(args.camara)
if not camara.isOpened():
    raise SystemExit("No se pudo abrir la cámara.")

historial = deque()          # (instante, decisión) de los últimos segundos.
tiempos = deque(maxlen=30)   # Duración de las últimas inferencias.
try:
    while True:
        ok, cuadro = camara.read()
        if not ok:
            break
        inicio = time.perf_counter()
        r = modelo.predict(cuadro, imgsz=args.imgsz, conf=0.05, verbose=False)[0]
        tiempos.append(time.perf_counter() - inicio)
        decision = "Nada"
        if len(r.boxes) and float(r.boxes.conf.max()) >= args.umbral:
            decision = CLASES[int(r.boxes.cls[r.boxes.conf.argmax()])]
        ahora = time.time()
        historial.append((ahora, decision))
        while historial and ahora - historial[0][0] > args.ventana:
            historial.popleft()
        gestos = [d for _, d in historial if d != "Nada"]
        estable = "Nada"
        if len(gestos) >= 5:
            clase, votos = Counter(gestos).most_common(1)[0]
            if votos / len(gestos) >= 0.6:
                estable = clase
        vista = r.plot()
        fps = len(tiempos) / sum(tiempos)
        cv2.putText(vista, f"Instante: {decision}  Estable: {estable}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.putText(vista, f"{fps:.1f} FPS  {1000 * sum(tiempos) / len(tiempos):.0f} ms", (10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
        cv2.imshow("Michikembo - prueba de webcam", vista)
        if cv2.waitKey(1) & 0xFF in (ord("q"), 27):
            break
finally:
    camara.release()          # Liberar siempre la cámara.
    cv2.destroyAllWindows()
"""

if SELECCION:
    ruta_script = RUTAS["modelos"] / SELECCION["carpeta"] / "webcam_local.py"
    ruta_script.write_text(SCRIPT_LOCAL.replace("__UMBRAL__", str(CONFIG_INFERENCIA["umbral_confianza"]))
                           .replace("__IMGSZ__", str(SELECCION["imgsz"])).lstrip(), encoding="utf-8")
    print("Script local escrito en:", ruta_script)
    print("Descárgalo junto con best.pt desde esa carpeta de Drive.")
'''

# =====================================================================
# 15. PUBLICACIÓN
# =====================================================================
MD15 = r'''
---
# 15. Publicación de artefactos

**Objetivo:** reunir en `publicacion/v21/` todo lo que luego irá al repositorio o a un *Release* de GitHub.

**Se incluye:** pesos `.pt` y `.onnx` con sus SHA-256, configuración de inferencia, selección, comparación de experimentos, métricas por clase, resultados de test, gráficas y el script de webcam.

**No se incluye:** imágenes ni ZIPs del dataset, porque su licencia está pendiente. En su lugar van los manifiestos y las huellas, que permiten reconstruirlo desde Roboflow.

> Los pesos pueden pesar decenas de MB. Para GitHub conviene subirlos como **Release** y no dentro de un commit normal.
'''

PUB_CELL = r'''
titulo("PUBLICACIÓN")
if SELECCION:
    pub = RUTAS["publicacion"] / SELECCION["carpeta"]
    (pub / "figuras").mkdir(parents=True, exist_ok=True)
    origen_modelo = RUTAS["modelos"] / SELECCION["carpeta"]
    copias = {
        "best.pt": origen_modelo / "best.pt",
        "best.onnx": origen_modelo / "best.onnx",
        "webcam_local.py": origen_modelo / "webcam_local.py",
        "verificacion_onnx.json": origen_modelo / "verificacion_onnx.json",
        "config_inferencia.json": ruta_inferencia,
        "seleccion.json": ruta_seleccion,
        "comparacion_experimentos.csv": RUTAS["informes"] / "comparacion_experimentos.csv",
        "metricas_por_clase_val.csv": RUTAS["informes"] / "metricas_por_clase_val.csv",
        "test_interno_evaluado.json": ruta_test,
        "plan_experimental.json": RUTAS["informes"] / "plan_experimental.json",
        "args.yaml": RUTAS["experimentos"] / SELECCION["carpeta"] / "args.yaml",
        "results.csv": RUTAS["experimentos"] / SELECCION["carpeta"] / "results.csv",
        f"split_manifest_{DATASET}.csv": RUTA_MANIFIESTO_ACTIVO,
        RUTAS["sha_ds"].name: RUTAS["sha_ds"],
    }
    for nombre, origen in copias.items():
        if origen.is_file():
            shutil.copyfile(origen, pub / nombre)
    for fig_png in RUTAS["figuras"].glob("*.png"):
        shutil.copyfile(fig_png, pub / "figuras" / fig_png.name)
    # Huellas de todo lo publicado.
    lineas = [f"{sha256_archivo(p)}  {p.relative_to(pub).as_posix()}"
              for p in sorted(pub.rglob("*")) if p.is_file() and p.name != "SHA256SUMS.txt"]
    (pub / "SHA256SUMS.txt").write_text("\n".join(lineas) + "\n")
    print(f"{len(lineas)} archivos publicados en {pub}")
'''

# =====================================================================
# 16. ESTADO
# =====================================================================
MD16 = r'''
---
# 16. Estado del proyecto y reanudación

Esta celda escribe `ESTADO_ACTUAL.md` en Drive **a partir de lo que realmente existe**, sin suponer nada. Distingue entre **completado**, **parcial** y **pendiente**. Si la sesión se corta, este archivo dice exactamente dónde retomar.
'''

ESTADO_CELL = r'''
def marca(condicion, parcial=False):
    """Traduce una condición a un estado legible."""
    return "COMPLETADO" if condicion else ("PARCIAL" if parcial else "PENDIENTE")


estados_exp = {e["nombre"]: estado(e) for e in EXPERIMENTOS if e["nombre"] in EXPERIMENTOS_ACTIVOS}
terminados = [k for k, v in estados_exp.items() if v == "completo"]
fases = [
    (f"Dataset {DATASET} construido y validado", marca(RUTAS["zip_ds"].is_file())),
    ("Entrenamiento de experimentos", marca(len(terminados) == len(estados_exp), bool(terminados))),
    ("Selección por validación", marca(bool(SELECCION) and not SELECCION.get("experimentos_pendientes"), bool(SELECCION))),
    ("Umbral del juego calibrado", marca(ruta_inferencia.is_file())),
    ("Test interno evaluado", marca(ruta_test.is_file())),
    ("Exportación ONNX verificada", marca(bool(SELECCION) and (RUTAS["modelos"] / SELECCION["carpeta"] / "verificacion_onnx.json").is_file())),
    ("Conjunto externo evaluado", marca(any(RUTAS["informes"].glob("externo_*.json")))),
    ("Prueba de webcam en Colab", marca(any(RUTAS["informes"].glob("webcam_colab_*.json")))),
]

lineas = [
    "# Michikembo — ESTADO ACTUAL del entrenamiento",
    f"Actualizado (Colombia): {ahora():%Y-%m-%d %H:%M}",
    "",
    "## Fases",
    "| Fase | Estado |",
    "|---|---|",
    *[f"| {f} | {e} |" for f, e in fases],
    "",
    "## Experimentos",
    "| Experimento | Estado |",
    "|---|---|",
    *[f"| {k} | {v} |" for k, v in estados_exp.items()],
]
if not COMPARACION.empty:
    cols = ["experimento", "val_P", "val_R", "val_mAP50", "val_mAP50-95", "brecha_mAP50"]
    lineas += ["", f"## Validación {DATASET}", "", "| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for _, f in COMPARACION.iterrows():
        lineas.append("| " + " | ".join(str(f[c]) if c == "experimento" else f"{f[c]:.3f}" for c in cols) + " |")
if SELECCION:
    lineas += ["", "## Modelo elegido",
               f"- {SELECCION['experimento']} (`{SELECCION['carpeta']}`), SHA-256 `{SELECCION['best_sha256']}`",
               f"- Validación: " + ", ".join(f"{k} {v:.3f}" for k, v in SELECCION["val"].items())]
    if ruta_test.is_file():
        t = leer_json(ruta_test)
        lineas.append("- Test interno: " + ", ".join(f"{k} {v:.3f}" for k, v in t["deteccion"]["global"].items())
                      + f" · decisión del juego {t['juego']['exactitud']:.3f}")
pendientes = [f for f, e in fases if e != "COMPLETADO"]
lineas += ["", "## Cómo continuar",
           "1. Abrir el notebook en Colab con GPU T4.",
           "2. Entorno de ejecución → Ejecutar todas. Todo lo terminado se salta y lo interrumpido se reanuda.",
           "3. Pendiente ahora: " + (", ".join(pendientes) if pendientes else "nada en la fase de modelo. Siguiente etapa: repositorio y juego."),
           "",
           "> Nota: Claude no puede medir el porcentaje de créditos diarios. Este archivo funciona como checkpoint preventivo."]

ESTADO_MD = "\n".join(lineas)
(RUTAS["informes"] / "ESTADO_ACTUAL.md").write_text(ESTADO_MD, encoding="utf-8")
print(ESTADO_MD)
'''

# ---------------------------------------------------------------------
# Insert evaluation helpers before the training loop.
# ---------------------------------------------------------------------
# Find the training-loop cell (the last code cell so far) and insert helper cells before it.
loop = CELDAS.pop()
md(r'''
### Funciones de evaluación

Antes de entrenar se definen las funciones que miden cada experimento terminado:

- `evaluar_validacion` calcula **una sola vez** las métricas en validación y en train (para la brecha) y las guarda junto al experimento.
- `medir_latencia` mide la mediana de milisegundos por imagen en GPU y en CPU con 50 imágenes fijas de validación.
''')
code(LAT_CELL)
code(EVAL_CELL)
md(r'''
### Ejecutar los experimentos

Esta celda recorre los experimentos activos en orden. Es la que más tarda. Si Colab se desconecta durante esta celda, vuelve a conectar y pulsa **Ejecutar todas**: el experimento interrumpido continúa desde su última época.
''')
CELDAS.append(loop)

md(MD10)
code(CMP_CELL)
code(CURVAS_CELL)
code(BARRAS_CELL)
md(MD11)
code(SEL_CELL)
code(DEC_CELL)
md(MD12)
code(TEST_CELL)
code(CAPTURA_CELL)
code(EXT_CELL)
md(MD13)
code(ONNX_CELL)
md(MD14)
code(WEB_CELL)
code(LOCAL_CELL)
md(MD15)
code(PUB_CELL)
md(MD16)
code(ESTADO_CELL)


def construir(ruta):
    celdas = []
    for tipo, texto in CELDAS:
        lineas = texto.splitlines(keepends=True)
        if tipo == "markdown":
            celdas.append({"cell_type": "markdown", "metadata": {}, "source": lineas})
        else:
            celdas.append({"cell_type": "code", "metadata": {}, "execution_count": None,
                           "outputs": [], "source": lineas})
    nb = {
        "nbformat": 4, "nbformat_minor": 0,
        "metadata": {
            "colab": {"provenance": [], "gpuType": "T4", "toc_visible": True},
            "kernelspec": {"name": "python3", "display_name": "Python 3"},
            "language_info": {"name": "python"},
            "accelerator": "GPU",
        },
        "cells": celdas,
    }
    Path(ruta).parent.mkdir(parents=True, exist_ok=True)
    Path(ruta).write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
    print("Notebook escrito:", ruta, "·", len(celdas), "celdas")


if __name__ == "__main__":
    construir(sys.argv[1])
