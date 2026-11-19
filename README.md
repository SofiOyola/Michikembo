# Michikembo

## Objetivos del proyecto

- Construir una consola virtual retro, responsive y usable con ratón, teclado, táctil y pantalla completa.
- Hacer jugable Michikembo con la mano frente a la cámara: piedra, papel o tijera contra Michi.
- Mantener el modelo de IA reemplazable mediante `manifest.json`, sin reescribir las reglas del juego.
- Mantener el entrenamiento reproducible y separado del producto web mediante notebooks, manifiestos y bitácoras.

## Qué contiene

| Carpeta | Contenido |
|---|---|
| `console/` | Carcasa, selector, previews, máquina de estados y pantalla expandida. |
| `games/michikembo/` | Juego, cámara, reglas, filtro temporal, modelo ONNX y detector simulado. |
| `games/dinosaur/` | Dino Corredor original sobre canvas, con obstáculos, récord y soporte táctil. |
| `games/cosmic_drift/` | Adaptador e integración del juego espacial existente. |
| `compartido/audio/` | Mezclador, preferencias, música y efectos sintetizados con Web Audio. |
| `assets/` | Animaciones de Michi, tipografía, audio opcional y modelo web activo. |
| `notebooks/` | Construcción del dataset, entrenamiento, evaluación y exportación a ONNX. |
| `scripts/` | Descarga de Cosmic Drift, preparación del modelo y utilidades. |
| `tests/` | Pruebas de reglas, modelo, audio y equivalencia ONNX/JavaScript. |
| `docs/` | Arquitectura, decisiones, evidencias, entrenamiento y bitácora de fases. |

## Arquitectura de la aplicación

La aplicación es web nativa, sin framework ni bundler. Cada juego se integra como un cartucho mediante `games/<id>/adapter.js`, con `createPreview(canvas)` para la vista previa y `mount(host, api)` para el ciclo de vida real.

```text
console/index.html
  ├── console/js/main.js       off → boot → select → playing → closing
  ├── console/js/catalog.js    catálogo de cartuchos
  ├── console/js/sfx.js        sonido de la consola
  └── media-guard.js           cierre seguro de cámaras
          ├── Michikembo       iframe + cámara + ONNX
          ├── Cosmic Drift     iframe del juego integrado
          └── Dino             canvas directo

games/michikembo/
  ├── reglas.js                 reglas y marcador
  ├── maquina.js                estados de la partida
  ├── estabilizador.js          estabilidad temporal del gesto
  ├── detector/onnx.js          detector real
  ├── detector/simulado.js      pruebas sin modelo/webcam
  └── vision/yolo.js            pre y postprocesamiento YOLO
```

La consola monta un solo juego a la vez, detiene la preview antes de jugar, suspende su audio y ejecuta una limpieza final de las pistas de cámara aunque el juego no las haya liberado correctamente.

## Modelo de visión artificial

### Flujo completo

```text
fotograma de cámara → letterbox y normalización → YOLOv8n ONNX
→ detecciones y NMS → Paper / Rock / Scissors / Nada
→ filtro temporal → jugada confirmada de la ronda
```

`Nada` no es una clase del modelo: es la decisión del sistema cuando no hay detección sobre el umbral o no se consigue estabilidad. `Ambigua` representa detecciones incompatibles y también impide puntuar.

### Modelo activo y arquitectura final

El modelo consumido por el juego es `assets/models/michikembo/current/model.onnx`, descrito por `manifest.json`.

| Propiedad | Valor |
|---|---|
| Experimento | E3c, `E3c_yolov8n_aumentacion_v21` |
| Red | YOLOv8n de detección, ajustada desde `yolov8n.pt` |
| Dataset | Michikembo v2.1, derivado de Rock Paper Scissors SXSW v14 |
| Clases | `Paper`, `Rock`, `Scissors` |
| Entrada | `640 × 640` |
| Umbral de confianza | `0,20` |
| IoU de NMS | `0,45` |
| Exportación | ONNX, opset 12, `nms=False` |
| Runtime web | ONNX Runtime Web 1.20.1, WASM |
| Estado | Experimental; umbrales pendientes de validar con webcam actual |
| SHA-256 ONNX | `82ea7a5d358031f171caf010c0aa06badb4b55e750d700c4fa8d265f0ede4646` |

La arquitectura estándar de YOLOv8n incluye un **backbone convolucional con bloques C2f y SPPF**, un **neck multiescala FPN/PAN** y una **cabeza de detección desacoplada y anchor-free**. El modelo elegido conserva esa arquitectura; el trabajo específico estuvo en adaptar el entrenamiento al dominio de gestos, preparar el dataset, comparar configuraciones y hacer funcionar la inferencia ONNX en el navegador.

La salida se exporta sin NMS embebido. JavaScript decodifica `cx, cy, w, h`, aplica umbral, NMS por clase y deshace el letterbox. Las clases se traducen por nombre, no por índice fijo.

### Dataset y cambios realizados

La versión v2.1 se reconstruyó para reducir fugas entre entrenamiento y evaluación:

- `3.446` imágenes de entrenamiento, `341` de validación y `341` de test interno.
- `4.128` imágenes activas en total.
- `68` imágenes de `23` familias enviadas a cuarentena por similitud.
- Validación y test repartidos por familias/fuentes, no solo aleatoriamente.
- Imágenes con gestos mezclados excluidas de ciertas métricas de decisión del juego.

### Hiperparámetros de E3c

| Parámetro | Valor |
|---|---:|
| Épocas máximas | `100` |
| Early stopping (`patience`) | `25` |
| `imgsz` | `640` |
| `batch` | `16` |
| `workers` | `2` |
| Semilla | fija (`SEMILLA`) |
| Determinismo | `True` |
| Guardado | `best.pt` y `last.pt` |
| `hsv_h` / `hsv_s` / `hsv_v` | `0,02` / `0,8` / `0,5` |
| `degrees` | `10,0` grados |
| `translate` | `0,15` |
| `scale` | `0,6` |
| `mixup` | `0,1` |

La hipótesis de E3c fue que una aumentación fuerte mejoraría la generalización ante iluminación, distancia, orientación y calidad variables de una webcam.

### Experimentos y selección

| Experimento | Configuración | P | R | mAP@50 | mAP@50-95 |
|---|---|---:|---:|---:|---:|
| B1 | YOLOv8n base | 0,715 | 0,537 | 0,600 | 0,359 |
| E3a | YOLOv8s | 0,798 | 0,451 | 0,556 | 0,354 |
| E3b | YOLOv8m | 0,747 | 0,510 | 0,588 | 0,349 |
| **E3c** | **YOLOv8n + aumentación fuerte** | **0,812** | **0,510** | **0,629** | **0,364** |
| E3d | YOLOv8n + entrada 800 px | 0,834 | 0,437 | 0,545 | 0,340 |

E3c se seleccionó usando validación: primero se evita un sobreajuste marcado, luego se prioriza mAP@50; los empates dentro de un punto usan mAP@50-95 y finalmente latencia CPU. 

### Métricas, equivalencia y limitaciones

- Validación E3c: `P=0,812`, `R=0,510`, `mAP@50=0,629`, `mAP@50-95=0,364`.
- El manifiesto registra para el checkpoint: `P=0,73149`, `R=0,54694`, `mAP@50=0,6331`, `mAP@50-95=0,36528`.
- Test interno registrado previamente: `P=0,785`, `R=0,570`, `mAP@50=0,680`, `mAP@50-95=0,419`.
- Train mAP@50 aproximado `0,993` frente a validación `0,629`: existe una brecha compatible con sobreajuste.
- PyTorch/ONNX coincidieron en la clase principal en `10/10` marcos; JavaScript coincidió con Ultralytics-ONNX en cajas, clases y confianzas dentro de las tolerancias documentadas.
- Latencia medida en CPU sin GPU: aproximadamente `400–470 ms` por imagen; no representa todos los equipos.
- Una prueba webcam anterior con umbral `0,10` obtuvo `35,55 %` de acierto estable y `6,85 %` de falsas activaciones sin mano.

Conclusión: E3c sirve para integrar y depurar el flujo del juego, pero requiere evaluación externa nueva con varias personas, fondos, distancias e iluminaciones antes de afirmar robustez.

## Cambios y decisiones relevantes

- Se adoptó una arquitectura web única y modular.
- Cada juego quedó aislado detrás de un adaptador con ciclo de vida común.
- Se separaron reglas, máquina de estados, cámara, visión, audio y presentación.
- Se agregaron detector ONNX real y detector simulado para pruebas sin webcam.
- Se implementaron manifiesto, SHA-256 y cache-busting mediante `?rev=`.
- Se añadió `media-guard.js` para cerrar cámaras al salir de un iframe.
- Se incorporó ONNX Runtime Web local, sin depender de CDN para la inferencia.
- La música y los efectos actuales son composiciones sintetizadas y configurables.

## Pruebas y reentrenamiento

Ejecuta las pruebas desde la raíz:

```powershell
npm test
```

La evidencia registrada indica `28/28` pruebas de juego, `14/14` de modelo y `13/13` de audio, además de pruebas de navegador con cámara falsa. La webcam real y la calibración definitiva del umbral siguen pendientes.

El notebook principal es [notebooks/Michikembo_entrenamiento_organizado.ipynb](notebooks/Michikembo_entrenamiento_organizado.ipynb). Se ejecuta en Google Colab con GPU T4. Usa `DATASET="v22"` para la tubería actual o `"v21"` para reproducir los experimentos históricos; `ENTRENAR=False` permite revisar resultados sin consumir GPU. El flujo reanuda desde `last.pt`, congela la selección antes del test y verifica la equivalencia ONNX antes de publicar.

## Reemplazar el modelo web

El juego siempre busca:

```text
assets/models/michikembo/current/
├── model.onnx
└── manifest.json
```

Para reemplazarlo, conserva los nombres, actualiza clases, tamaño, umbrales, revisión y SHA-256 en el manifiesto. La guía completa está en [docs/COMO_CAMBIAR_MODELO.md](docs/COMO_CAMBIAR_MODELO.md).

## Referencia rápida

Consola web con tres juegos:

1. **Michikembo**: piedra, papel o tijera contra la gata virtual Michi usando la mano frente a la cámara. Eliges la meta: primero en ganar 1, 3, 5 o 7.
2. **Cosmic Drift**: juego existente de [SofiOyola/Cosmic-Drift](https://github.com/SofiOyola/Cosmic-Drift), integrado sin modificarlo.
3. **Dino Corredor**: corredor infinito original (arte y sonido hechos con código).

Incluye también el notebook de entrenamiento del detector YOLOv8 (`notebooks/`) y su documentación (`docs/`).

## Probarlo en tu computador (Windows, VS Code)

Los juegos usan módulos de JavaScript, así que **no se abren con doble clic**: hace falta un servidor local (también lo exige la cámara).

1. En la terminal de VS Code, dentro de esta carpeta, descarga Cosmic Drift (solo la primera vez):
   ```text
   powershell -ExecutionPolicy Bypass -File scripts\traer_cosmic_drift.ps1
   ```
   En Git Bash, Linux o macOS: `bash scripts/traer_cosmic_drift.sh`
2. Arranca el servidor:
   ```text
   python -m http.server 8000
   ```
3. Abre en Chrome o Edge: <http://localhost:8000/console/>

Michikembo también funciona solo: `http://localhost:8000/games/michikembo/` (añade `?dev=1` para ver el modo desarrollo).

> `model.onnx` no está en GitHub todavía. Si clonaste el repositorio sin él, sigue `docs/COMO_CAMBIAR_MODELO.md` o juega con el detector simulado (Ajustes).

Controles completos: [`console/README.md`](console/README.md).

## Pruebas

```text
node --test tests/*.test.mjs
```

Cubren las reglas, la máquina de estados (casos del plan §13), el filtro temporal con Nada/Ambiguo, el manifiesto del modelo, el pre/posprocesamiento YOLO y, si el modelo está instalado, su carga y la equivalencia con Python.

## Estructura

```text
console/              consola (carcasa, máquina de estados, guardián de cámara, sonidos)
games/michikembo/     juego principal + adapter.js (lógica pura en js/reglas.js, estabilizador.js, maquina.js, js/vision/)
games/dinosaur/       Dino Corredor (dino.js + adapter.js)
games/cosmic_drift/   adapter.js; el juego se descarga en fuente/ (ignorado por Git)
assets/michi/         arte de Michi (instrucciones de exportación en su README)
assets/models/michikembo/current/   modelo web activo: model.onnx + manifest.json
assets/fonts/         tipografía pixel Press Start 2P (OFL)
vendor/               ONNX Runtime Web 1.20.1 (MIT), copia local
models/               best.pt locales para Python (no versionados)
notebooks/            entrenamiento del detector en Google Colab
scripts/              preparar_modelo.py, generador del notebook, descarga de Cosmic Drift
docs/                 plan maestro, estado actual, decisiones, cómo cambiar el modelo, pruebas y seguimiento por fases
tests/                pruebas unitarias (Node 18+)
```
