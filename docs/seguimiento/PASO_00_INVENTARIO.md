# Paso 00. Inventario y protección del trabajo actual (Fase 0)

## Objetivo
Saber qué existe realmente antes de cambiar código (plan §12, Fase 0) y no perder nada.

## Estado inicial
Materiales recibidos el 19/11/2026: `michikembo.zip` (versión mejorada por Jesus), `PLAN_DE_DESARROLLO_MICHIKEMBO_Y_CONSOLA_2026-11-19.md`, `best.pt` y `consola_referencia.png`.

## Trabajo realizado
Se descomprimió el ZIP en una copia de trabajo con historial git local (commit base = ZIP sin cambios) y se comparó con la copia anterior del proyecto.

### Inventario contra el plan

| Material del plan §2 | ¿Recibido? | Qué se comprobó |
|---|---|---|
| Imagen de consola | Sí | Consola portátil vertical: fondo azul pastel, carcasa blanca con contorno morado grueso, pantalla violeta con reflejo, cruceta morada, dos botones rojos sobre una pastilla lavanda, dos botones pequeños inclinados y rejilla diagonal de altavoz. La consola actual (`console/`) es **horizontal, crema y con orejas de gato**: aún **no** sigue esta referencia (Fase 7). |
| `GatoBase.ase` | **No** | `assets/michi/source/` está vacío. No se modificó ni se inventó arte. |
| Animaciones de Michi | Sí (en el ZIP) | 6 GIF en `assets/michi/sprites/`: `idle`, `piedra`, `papel`, `tijera`, `happy`, `sad`. Todos 480×270 px, 64 fotogramas, 60 ms/fotograma, con transparencia. El gato **cambia de tamaño/posición** entre `idle` y las jugadas (se ve en las capturas): revisar en la Fase 5. |
| Notebook de Colab | Sí | El ZIP traía la versión **1.0** (idéntica a `*_v1_0.ipynb`). En la carpeta del proyecto existía la **1.1** (dataset v2.2, E4a/E4b). Se incorporó la 1.1 y sus scripts sin modificarlos (los mantiene el hilo de entrenamiento). |
| `best.pt` E3c | Sí | Ver tabla siguiente. |
| `.onnx` de E3c | **No** (no se adjuntó el de Drive) | Se **re-exportó** desde `best.pt` y se validó (Paso 02). |
| Repositorio Michikembo | No accesible desde esta sesión | Se trabajó sobre el ZIP. `repo/Michikembo.bundle` es **anterior** a la unificación de consolas: no usarlo. |
| Cosmic Drift | Sí (copia en `games/cosmic_drift/fuente/`, commit `4a88579`) | 57 MB. Usa MediaPipe desde `cdn.jsdelivr.net` y `storage.googleapis.com` (necesita internet). No se tocó en esta fase. |

### `best.pt`

| Dato | Valor |
|---|---|
| Tamaño | 6.514.026 bytes |
| SHA-256 | `bc08a2921c61a2560271a5a385eb440e53240f8188cad913ce9c21c257209660` |
| Arquitectura | YOLOv8n (3.133.193 parámetros fusionados), Ultralytics 8.4.215 |
| Clases | `0 Paper · 1 Rock · 2 Scissors` |
| Experimento | `E3c_yolov8n_aumentacion_v21`, 100 épocas, imgsz 640, seed 42, `fliplr 0.5`, `mosaic 1.0`, `mixup 0.1`, `degrees 10` |
| Métricas guardadas en el checkpoint | P 0,731 · R 0,547 · mAP50 0,633 · mAP50-95 0,365 (validación durante el entrenamiento) |

**Discrepancia a tener en cuenta:** el plan reporta para E3c en validación P 0,812 · R 0,510 · mAP50 0,629 · mAP50-95 0,364. Los mAP coinciden casi exactamente, pero P y R no. Lo más probable es que el plan cite una evaluación aparte (`model.val()`, con otro umbral de confianza para P/R) y el checkpoint guarde la del último paso de entrenamiento. **No se pudo re-evaluar aquí** porque el dataset está en Drive. Ninguna de las dos cifras está cerca del 90 %: E3c sigue siendo **provisional**.

### Cambios de Jesus detectados en su ZIP (se conservan)
- Michi reproduce GIF directos (`michi.js`, `animations.json`, `<img class="michi-gif">`) y la prueba de las 6 animaciones.
- Mapeo de animaciones a 6 estados (sin `victoriosa/derrotada/confundido`).
- Consola: se quitaron los botones B, SELECT y START y la leyenda de teclado.

## Archivos creados o modificados
Solo documentación en este paso: `docs/PLAN_MAESTRO.md` (copia del plan), este archivo, `docs/ESTADO_ACTUAL.md`.
Se incorporaron sin cambios desde la carpeta del proyecto: notebook 1.1 (+ `_v1_0`), `scripts/generar_notebook.py`, `runner.py`, `fake_data2.py`, `quitar_fondo_gifs.py`, `docs/README_ENTRENAMIENTO.md`, `docs/bitacora/PASO_02_diagnostico_y_dataset_v22.md`.

## Pruebas ejecutadas y resultados
`npm test` sobre el ZIP original: **10/10** pruebas existentes pasan. Carga de `best.pt` con PyTorch 2.x CPU: correcta.

## Riesgos y limitaciones
- Sin `GatoBase.ase` no se puede comprobar la resolución base (32×32 según el README de Michi) contra los GIF 480×270.
- Sin acceso al repositorio de GitHub no se pudo ver la rama ni cambios locales: el respaldo verificable es el `michikembo.zip` original (intacto en la carpeta del proyecto) más el ZIP de esta entrega.

## Evidencias y rutas
`/mnt/project-files/michikembo.zip` (original, sin tocar) · `best.pt` del 19/11/2026 (hash arriba).

## Estado final
**Completado.** Inventario hecho, nada destruido.

## Siguiente paso exacto
Paso 02: hacer el modelo reemplazable y validar el ONNX.
