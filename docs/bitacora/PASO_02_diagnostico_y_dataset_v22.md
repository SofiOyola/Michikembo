# Michikembo — Paso 02 — Diagnóstico de v2.1 y dataset v2.2
Fecha (Colombia): 2026-11-19
Estado: PARCIAL (notebook 1.1 listo y probado, entrenamiento v2.2 PENDIENTE de ejecutar en Colab)

## Objetivo
Entender por qué los cinco experimentos sobre v2.1 se quedaron en mAP@50 de validación ≈ 0,55 a 0,63 y proponer una corrección metodológicamente válida, sin usar el test para ajustar.

## Evidencias de la primera ejecución (Colab T4, 18 y 19/11/2026)
| Experimento | P | R | mAP50 | mAP50-95 | mAP50 train | Brecha |
|---|---:|---:|---:|---:|---:|---:|
| B1 yolov8n | 0,715 | 0,537 | 0,600 | 0,359 | 0,991 | 0,391 |
| E3a yolov8s | 0,798 | 0,451 | 0,556 | 0,354 | 0,990 | 0,434 |
| E3b yolov8m | 0,747 | 0,510 | 0,588 | 0,349 | 0,993 | 0,406 |
| E3c yolov8n + aumentación (elegido) | 0,812 | 0,510 | 0,629 | 0,364 | 0,993 | 0,364 |
| E3d yolov8n + 800 px | 0,834 | 0,437 | 0,545 | 0,340 | 0,990 | 0,445 |

- Test interno de E3c: P 0,785 · R 0,570 · mAP50 0,680 · mAP50-95 0,419 · decisión del juego 0,692.
- ONNX de E3c verificado: 100 % de decisiones iguales al `.pt`.
- Matriz del juego en validación: 20 % de Piedra y Tijera se quedaron como «Nada» (gestos no detectados) y 20 % de las negativas se confundieron con Piedra.

## Diagnóstico
- Todos los modelos memorizan train (mAP50 ≈ 0,99) y un modelo más grande no mejora la validación. Eso apunta a los datos, no al modelo.
- La procedencia de las imágenes (gráfica del capítulo 07) muestra **≈ 64 % de fotogramas de video en valid y test, frente a ≈ 2 % en train**.
- Causa: el algoritmo de v2 llenaba la evaluación empezando por las familias más grandes, que son los videos. El modelo casi no vio ese tipo de imagen al entrenar, y las variantes aumentadas de esas familias quedaron excluidas.

## Acciones ejecutadas
- Notebook 1.1: nuevo capítulo 04b que crea el dataset **v2.2** a partir del manifiesto v2.1. Valid y test se estratifican por fuente, las familias con más de 12 imágenes elegibles van completas a train, y se repite la auditoría pHash + SSIM (cuarentena con SSIM ≥ 0,85).
- Interruptor `DATASET` ("v22" por defecto, "v21" para revisar lo anterior). Todas las rutas de resultados se separan por versión, así que nada de v2.1 se sobrescribe.
- Experimentos v2.2: E4a (yolov8n + aumentación fuerte, 150 épocas, paciencia 35) y E4b (lo mismo con yolov8s).
- Probado con un Drive simulado: creación de v2.2, construcción del ZIP, entrenamiento, selección, test, ONNX y publicación. Con `DATASET = "v21"` no se reentrena nada y la selección sigue congelada.

## Archivos
- `notebooks/Michikembo_entrenamiento_organizado.ipynb` (versión 1.1)
- `notebooks/Michikembo_entrenamiento_organizado_v1_0.ipynb` (versión ejecutada, como respaldo)
- `docs/README_ENTRENAMIENTO.md` actualizado

## Problemas y advertencias
- Las métricas v2.2 no son comparables con las de v2.1 porque la validación cambia.
- El 90 % sigue sin estar garantizado. Si v2.2 no se acerca, lo siguiente es añadir imágenes propias de webcam (personas, fondos y luz reales del juego).
- La auditoría pHash + SSIM es heurística, igual que en v2.1.

## Próximo paso
En Colab con GPU T4: subir el notebook 1.1 y pulsar Ejecutar todas. Compartir el notebook con salidas o `documentacion/notebook_v22/ESTADO_ACTUAL.md`.
