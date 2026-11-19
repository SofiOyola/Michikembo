# Paso 02. Modelo reemplazable y validación ONNX (Fase 2)

## Objetivo
Que cambiar de modelo sea **reemplazar dos archivos** y que el navegador vea exactamente lo mismo que Python.

## Estado inicial
`detector/onnx.js` era un marcador: fallaba siempre con "inferencia ONNX aún no implementada". No había `.onnx`.

## Trabajo realizado
1. `scripts/preparar_modelo.py`: exporta `best.pt` → ONNX (opset 12, sin NMS), comprueba formas, compara PyTorch vs ONNX, guarda fixtures, **respalda** el modelo anterior en `anteriores/` y escribe `manifest.json` (sha256, bytes, clases, umbrales, `revision`).
2. Modelo instalado en `assets/models/michikembo/current/` (E3c-v2.1, revision 1, `experimental`).
3. `js/vision/yolo.js` (puro): letterbox idéntico a Ultralytics, RGBA→NCHW, decodificación `[1, 4+nc, N]`, NMS por clase, vuelta a coordenadas 0..1.
4. `js/vision/manifiesto.js` (puro): validación con mensajes en español, clases **por nombre**, URL `?rev=`.
5. `js/detector/onnx.js`: carga manifiesto, descarga el modelo, **verifica sha256**, abre ONNX Runtime Web (copia local en `vendor/`), calienta, detecta y expone estadísticas para el modo desarrollo. Errores legibles para: manifiesto ausente, `.onnx` ausente, hash distinto, archivo corrupto.
6. `docs/COMO_CAMBIAR_MODELO.md` con comandos de PowerShell y restauración.

## Archivos creados o modificados
Nuevos: `assets/models/michikembo/current/{model.onnx, manifest.json}`, `games/michikembo/js/vision/{yolo.js, manifiesto.js}`, `vendor/onnxruntime-web/*`, `scripts/preparar_modelo.py`, `tests/modelo.test.mjs`, `tests/util/png.mjs`, `docs/COMO_CAMBIAR_MODELO.md`.
Modificados: `games/michikembo/js/detector/{onnx.js, index.js}`, `models/README.md`, `.gitignore`.

## Pruebas ejecutadas y resultados

| Prueba | Resultado |
|---|---|
| Forma ONNX | entrada `images [1,3,640,640]`, salida `output0 [1,7,8400]` |
| PyTorch vs ONNX (Python, 10 marcos 640×480: 9 con manos + 1 vacío, conf 0,20) | clase principal igual en **10/10** |
| JS (`yolo.js` + ORT Web en Node) vs Ultralytics-ONNX en Python | **10/10**: mismo nº de cajas, misma clase, |Δconf| < 0,01, IoU > 0,98 |
| Imágenes vacías (gris 0/114/180/255) | 0 detecciones → **Nada** |
| sha256 y tamaño del archivo vs manifiesto | coinciden |
| Manifiesto con otro orden de clases / clase faltante / umbral inválido | remapeo correcto / errores claros |
| Chromium headless con cámara falsa (foto de tijera) | el modelo detecta **tijera 0,85** y la ronda se resuelve |
| Latencia | Node 1 hilo ≈ 470 ms · Chromium headless en este servidor ≈ 400 ms (2,3–2,5 FPS) |

**Importante:** las 9 imágenes con manos provienen de las muestras del dataset que aparecen en el notebook (posiblemente de entrenamiento). Sirven para comprobar **equivalencia**, **no** la calidad del modelo. La latencia medida es de un servidor sin GPU ni SIMD multihilo: **no representa** tu computador. Hay que medirla con tu webcam en el modo desarrollo.

## Riesgos y limitaciones
- Si en tu PC el navegador da < 5 FPS, una ventana de 2 s junta < 10 fotogramas y será difícil llegar a 5 estables. Opciones con evidencia: exportar con `imgsz 416` o `320` (solo cambia el manifiesto), activar varios hilos (COOP/COEP, D5) o WebGPU.
- `model.onnx` no se sube a GitHub todavía (D16).

## Evidencias y rutas
`assets/models/michikembo/current/manifest.json` · `tests/fixtures/modelo/esperado.json` (local) · `docs/seguimiento/capturas_fase4/4_cuenta_1_revela_michi.png` y `5_resultado_modelo_real.png` (cajas y panel de desarrollo).

## Estado final
**Completado** para el modelo, el adaptador y las pruebas automáticas. **Pendiente**: medición con webcam real (Fase 3).

## Siguiente paso exacto
En tu PC: `python -m http.server 8000` → <http://localhost:8000/games/michikembo/?dev=1> y anotar FPS y latencia del panel.
