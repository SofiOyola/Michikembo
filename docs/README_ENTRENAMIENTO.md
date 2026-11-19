# Michikembo — Guía de entrenamiento y recuperación

Notebook: `notebooks/Michikembo_entrenamiento_organizado.ipynb`

## Cómo ejecutarlo

1. Sube el notebook a Google Colab (Archivo → Subir notebook).
2. Entorno de ejecución → Cambiar tipo de entorno → **GPU T4**.
3. Entorno de ejecución → **Ejecutar todas**.
4. Acepta los permisos de Google Drive con la misma cuenta de las sesiones anteriores.

## Si Colab se desconecta

Vuelve a conectar con GPU y pulsa otra vez **Ejecutar todas**. No hay que tocar nada:

- El ZIP v2.1 no se reconstruye si ya existe y su SHA-256 coincide.
- Un experimento con `completado.json` nunca se vuelve a entrenar.
- Un experimento con `weights/last.pt` pero sin `completado.json` se **reanuda** desde la última época.
- Las métricas, la selección, el umbral, el test y la exportación se leen de Drive si ya existen.

Para saber en qué punto quedó todo, abre en Drive:
`MyDrive/Michikenbo/documentacion/notebook_v22/ESTADO_ACTUAL.md`

## Interruptores (capítulo 01)

| Interruptor | Por defecto | Para qué sirve |
|---|---|---|
| `DATASET` | `"v22"` | Dataset con reparto estratificado por fuente. `"v21"` muestra los resultados anteriores sin entrenar. |
| `ENTRENAR` | `True` | Entrena solo lo pendiente. En `False` revisa resultados sin gastar GPU. |
| `EXPERIMENTOS_ACTIVOS` | `None` (todos) | En v2.2 son E4a y E4b. Pon `["E4a"]` para entrenar solo el más rápido. |
| `EVALUAR_TEST` | `True` | Evalúa el modelo elegido en test interno, una sola vez. |
| `EXPORTAR_ONNX` | `True` | Exporta el modelo elegido a ONNX y comprueba que decide igual que el `.pt`. |
| `PROBAR_WEBCAM` | `False` | Abre la cámara en Colab y simula 8 rondas. |
| `CAPTURAR_EXTERNO` | `False` | Abre la cámara para fotografiar el conjunto externo. |
| `FORZAR_TEST_NUEVO` | `False` | No activar salvo una razón documentada. |

## Dónde queda cada cosa en Drive

```text
MyDrive/Michikenbo/
  datasets/
    michikenbo_dataset_v21.zip         ← dataset v2.1 (primera ejecución, se conserva)
    michikenbo_dataset_v22.zip         ← dataset v2.2 (reparto estratificado por fuente)
    michikenbo_dataset_v22.sha256
    externo_v1/Paper|Rock|Scissors|Nada/   ← conjunto externo (cuando lo captures)
  documentacion/propuesta_v22/
    manifiesto_v22.csv, configuracion.json, pares_casi_duplicados.csv
  experiments/v21/                     ← B1, E3a, E3b, E3c, E3d (primera ejecución)
  experiments/v22/
    E4a_yolov8n_aumentacion_v22/  E4b_yolov8s_aumentacion_v22/
      weights/best.pt, weights/last.pt, results.csv, args.yaml
      completado.json, metricas_val.json, metricas_train.json, latencia.json
  models/<versión>/<modelo elegido>/
    best.pt, best.onnx, verificacion_onnx.json, webcam_local.py
  documentacion/notebook_<versión>/
    ESTADO_ACTUAL.md, comparacion_experimentos.csv, seleccion.json,
    config_inferencia.json, test_interno_evaluado.json, figuras/, bitacora/
  publicacion/<versión>/<modelo elegido>/    ← lo que irá a GitHub o a un Release
```

## Reglas de honestidad que aplica el notebook

- El modelo se elige **solo con validación**. El test interno se usa una vez y queda bloqueado.
- La selección queda congelada en cuanto se evalúa el test.
- Si la selección es provisional (faltan experimentos), el test espera.
- La brecha train−validación por encima de 0,15 en mAP@50 se marca como posible sobreajuste y ese experimento no se elige mientras haya otro sin esa marca.
- El conjunto externo no se usa para reentrenar ni para cambiar el umbral.
- La meta del 90 % se dibuja en las gráficas, pero no se fuerza ni se garantiza.

## Prueba local de webcam (Windows, VS Code)

Descarga `best.pt` y `webcam_local.py` desde `models/<versión>/<modelo elegido>/` y, en la terminal de VS Code con tu `.venv` activo:

```text
pip install ultralytics==8.4.215 opencv-python
python webcam_local.py --modelo best.pt
```

Pulsa Q o Esc para salir. La ventana muestra la decisión instantánea, la decisión estable (filtro de 2 segundos) y los FPS reales de tu computador.
