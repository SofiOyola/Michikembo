# Cómo cambiar el modelo de Michikembo

El juego web usa **un solo modelo activo**, siempre en la misma carpeta:

```text
assets/models/michikembo/current/
├── model.onnx       ← MODELO WEB ACTIVO (no se sube a GitHub por ahora)
└── manifest.json    ← nombre, versión, clases, umbrales, revision, sha256
```

Cambiar de modelo **no** obliga a tocar reglas, marcador, animaciones ni consola.
El juego lee el manifiesto, comprueba el `sha256`, traduce las clases **por nombre**
(`Paper/Rock/Scissors` o `papel/piedra/tijera`, en cualquier orden) y usa sus umbrales.

> Todo se ejecuta en la **terminal de VS Code (PowerShell, Windows)**, dentro de la carpeta del proyecto.

---

## 0. Requisitos (solo la primera vez)

```powershell
py -m pip install ultralytics onnx onnxruntime onnxslim
node --version     # Node 22 o superior, para las pruebas
```

## 1. Preparar e instalar el modelo nuevo (automático, recomendado)

1. Descarga el `best.pt` nuevo desde Drive (por ejemplo `MyDrive/Michikenbo/models/v22/E4a.../best.pt`). **No borres el E3c.**
2. Junta en una carpeta 10–40 fotos con manos (mejor si son tuyas, de tu webcam), por ejemplo `C:\michikembo_fotos`.
3. Ejecuta:

```powershell
py scripts\preparar_modelo.py --pt "C:\Descargas\best.pt" --version E4a-v2.2 --imagenes "C:\michikembo_fotos"
```

El script, sin borrar nada:

| Paso | Qué hace |
|---|---|
| 1 | Lee el checkpoint: clases, `imgsz`, nombre del experimento y métricas guardadas |
| 2 | Exporta a ONNX (opset 12, **sin NMS**: el NMS lo hace el juego) |
| 3 | Comprueba la forma `[1,3,S,S] → [1,4+nc,N]` con ONNX Runtime |
| 4 | Compara PyTorch vs ONNX en tus fotos (misma clase principal) |
| 5 | Guarda fotos 640×480 + resultados esperados en `tests/fixtures/modelo/` (no se suben) |
| 6 | **Respalda** el modelo actual en `assets/models/michikembo/anteriores/<version>_rev<N>/` |
| 7 | Copia `model.onnx` y escribe `manifest.json` con `sha256`, tamaño y `revision + 1` |

Solo verificar, sin instalar: añade `--solo-verificar`.
Otros umbrales iniciales: `--conf 0.25 --iou 0.45`. Estado: `--estado validado` solo cuando las pruebas con webcam lo justifiquen.

## 2. Pruebas automáticas

```powershell
npm test
```

Comprueban: `manifest.json` válido, `sha256` y tamaño de `model.onnx`, carga en ONNX Runtime Web,
forma de salida, imagen vacía → **Nada**, latencia y que el código JS del juego da **las mismas
cajas, clases y confianzas** que Ultralytics en Python (`tests/fixtures/modelo/`).
Si falta el modelo o las fixtures, esas pruebas aparecen como *omitidas* y dicen por qué.

## 3. Prueba con webcam

```powershell
python -m http.server 8000
```

Abre <http://localhost:8000/games/michikembo/?dev=1>. El panel **MODO DESARROLLO** muestra
versión, `revision`, estado, umbrales, predicción instantánea, decisión estable, confianza, cajas,
FPS y latencia. Juega varias rondas con cada gesto y sin mano (plan §7). Anota los resultados en
`docs/PRUEBAS_Y_EVIDENCIAS.md`.

> El navegador no reutiliza un modelo viejo: el archivo se pide como `model.onnx?rev=<revision>`.

> Si el modo desarrollo muestra un error de *MIME type* al cargar `ort.wasm.min.mjs`, usa Python 3.12 o superior para el servidor (`py --version`): versiones antiguas en Windows pueden servir `.mjs` con un tipo incorrecto.

## 4. Si algo falla: volver al modelo anterior

```powershell
Copy-Item -Force assets\models\michikembo\anteriores\E3c-v2.1_rev1\* assets\models\michikembo\current\
npm test
```

(Cambia `E3c-v2.1_rev1` por la carpeta que quieras restaurar. `dir assets\models\michikembo\anteriores` las lista.)

## 5. Instalación manual (sin el script)

1. Exporta en Colab: `YOLO("best.pt").export(format="onnx", imgsz=640, opset=12, simplify=True, nms=False)`.
2. Copia el modelo anterior a `anteriores\` (como en el paso 4, pero al revés).
3. Copia el `.onnx` nuevo como `assets\models\michikembo\current\model.onnx`.
4. Calcula huella y tamaño:
   ```powershell
   (Get-FileHash assets\models\michikembo\current\model.onnx -Algorithm SHA256).Hash.ToLower()
   (Get-Item assets\models\michikembo\current\model.onnx).Length
   ```
5. En `manifest.json` actualiza `version`, `modelName`, `classNames`, `inputSize`, `sha256`, `bytes` y **sube `revision` en 1**.
6. `npm test` (sin fixtures nuevas, la prueba de equivalencia se omitirá: créalas con `--solo-verificar`).

## 6. Campos de `manifest.json`

| Campo | Uso en el juego |
|---|---|
| `file` | Ruta del `.onnx` **relativa al manifiesto** (normalmente `model.onnx`) |
| `inputSize` | Lado del cuadrado de entrada (640; 416 o 320 si se exporta más pequeño para ganar velocidad) |
| `classNames` | Nombres en el orden del modelo. Deben aparecer piedra, papel y tijera una vez cada una |
| `confidenceThreshold` | Confianza mínima para que un fotograma cuente (0,20 **inicial, no validado**) |
| `iouThreshold` | Umbral del NMS (0,45) |
| `revision` | Entero que sube con cada cambio (invalida la caché del navegador) |
| `sha256`, `bytes` | Huella y tamaño: si no coinciden, el juego muestra un error y no carga el modelo |
| `status` | `experimental` o `validado` (se ve en el modo desarrollo) |
| resto | Informativo: experimento de origen, métricas del checkpoint, equivalencia, fecha |

## 7. Qué NO hay que tocar

`games/michikembo/js/config.js` (tiempos y filtro temporal del juego), `maquina.js`, `reglas.js`,
`estabilizador.js`, animaciones y consola. Si un modelo nuevo necesita más o menos fotogramas
estables, eso se ajusta en `config.js` (`FOTOGRAMAS_ESTABLES`) **después** de medirlo con webcam.

## 8. GitHub

Por ahora `model.onnx` está en `.gitignore` (decisión pendiente de la Fase 11: tamaño y licencias).
Se sube `manifest.json`, así el repositorio documenta qué modelo usa el juego.
