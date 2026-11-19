# Pruebas y evidencias

Regla: aquí solo va lo **ejecutado y comprobado**. Lo que falta se marca como pendiente.

## Pruebas automáticas (`npm test`)

| Fecha | Archivo | Resultado |
|---|---|---|
| 19/11/2026 | `tests/michikembo.test.mjs` (reglas, filtro temporal, máquina de estados, casos §13, 30 partidas aleatorias) | 28/28 |
| 19/11/2026 | `tests/modelo.test.mjs` (manifiesto, YOLO pre/pos, sha256, carga ORT Web, Nada, equivalencia JS/Python) | 14/14 |
| 19/11/2026 | `tests/audio.test.mjs` (notación, composiciones, pistas.json, preferencias, una sola música, nada antes del gesto, archivos propios, liberación, música por estado) | 13/13 |
| 19/11/2026 | Navegador: audio de consola y Michikembo por estado (ver `seguimiento/PASO_06_AUDIO.md`) | Correcto, sin errores |

## Modelo E3c (`best.pt` sha256 `bc08a292…`)

| Fecha | Prueba | Resultado | Dónde |
|---|---|---|---|
| 19/11/2026 | PyTorch vs ONNX, 10 marcos 640×480, conf 0,20 | 10/10 misma clase principal | servidor de Claude (CPU) |
| 19/11/2026 | JS del juego vs Ultralytics-ONNX | 10/10 cajas, clases y confianzas (|Δ| < 0,01, IoU > 0,98) | Node 22 + ORT Web 1.20.1 |
| 19/11/2026 | Latencia | ≈ 400–470 ms por imagen, 1 hilo WASM | servidor sin GPU: **no representativo** |
| — | Webcam real (plan §7: mano ausente, 3 gestos 15–20 s, transiciones, dos manos, iluminación) | **PENDIENTE** | PC de Jesus |
| — | Umbral 0,20 vs otros | **PENDIENTE** (no declarar definitivo) | PC de Jesus |

Resultados previos registrados en el plan (no re-ejecutados aquí): webcam con umbral 0,10 → 35,55 % de acierto estable y 6,85 % de falsas activaciones sin mano.

## Navegador (Chromium headless + Playwright, cámara falsa)

| Fecha | Caso | Resultado |
|---|---|---|
| 19/11/2026 | Foto de tijera como cámara, modelo real, meta 1 | Tijera estable → ronda resuelta → `YOU LOSE` (Michi piedra). Cámara cerrada al final |
| 19/11/2026 | Cámara vacía | `NO DETECTÉ TU GESTO`, marcador 0–0 |
| 19/11/2026 | Simulado manual, escritorio y móvil 390×844 | `YOU WIN` |
| 19/11/2026 | Manifiesto 404 / ONNX corrupto / permiso denegado | `CAMERA_ERROR` con mensaje legible |
| 19/11/2026 | Michikembo dentro de la consola y en vista previa | Abre en iframe; la preview juega sola sin cámara |

Capturas: `docs/seguimiento/capturas_fase4/`.

## Plantilla para tu prueba con webcam

| Fecha | PC / navegador | FPS | Latencia | Rondas por gesto (bien / total) | Falsas activaciones sin mano | Notas |
|---|---|---|---|---|---|---|
| | | | | Piedra: / · Papel: / · Tijera: / | | |
