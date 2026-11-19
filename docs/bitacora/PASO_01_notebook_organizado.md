# Michikembo — Paso 01 — Notebook de entrenamiento organizado
Fecha (Colombia): 2026-11-18
Estado: COMPLETADO (el notebook está escrito y probado) · el entrenamiento real sigue PENDIENTE

## Objetivo
Reemplazar el Colab histórico (44 celdas) por un notebook nuevo, ordenado y reanudable, que lleve el proyecto desde la verificación de Drive hasta el modelo elegido, exportado y documentado.

## Acciones ejecutadas
- Lectura completa de la memoria integral y del Colab histórico, celda por celda.
- Reutilización de la lógica verificada: `normalizar()` de rutas del ZIP v14, columnas del manifiesto v2.1 (`original`, `split_propuesto`, `familia`, `cajas_*`) y rutas de Drive.
- Notebook nuevo de 49 celdas en 16 capítulos, cada uno con su explicación en Markdown.
- Prueba completa en un entorno sin GPU con un Drive simulado (90 imágenes sintéticas, misma estructura que el real) y Ultralytics 8.4.215:
  - ejecución completa de principio a fin sin errores,
  - segunda ejecución: no reconstruye el ZIP, no reentrena nada, congela la selección y no repite el test,
  - corte real a mitad de entrenamiento: al volver a ejecutar continúa desde la época 4 en la misma carpeta,
  - experimento terminado sin `completado.json`: se registra sin reentrenar.

## Evidencias y resultados
- Error encontrado y corregido en la prueba: con Ultralytics 8.4.215, `resume=True` sobre un `last.pt` de un entrenamiento ya terminado **no da error**, sino que empieza un entrenamiento nuevo de 100 épocas con el dataset `coco8`. El notebook ahora revisa el checkpoint antes de reanudar.
- Las métricas de la prueba simulada **no significan nada** sobre el modelo real. Solo demuestran que el código funciona.

## Archivos respaldados
- `notebooks/Michikembo_entrenamiento_organizado.ipynb`
- `docs/README_ENTRENAMIENTO.md`

## Problemas y advertencias
- No se ha ejecutado en Colab con los datos reales. Las comprobaciones del capítulo 04 detendrán el notebook si algún archivo de Drive no coincide con lo esperado.
- Tiempo de GPU: los cinco experimentos pueden tardar varias horas en una T4 (E3b con yolov8m es el más lento). Colab gratuito probablemente corte la sesión. El notebook se reanuda al volver a ejecutar todo.
- La meta del 90 % no está garantizada. Con v1 el mejor mAP@50 de validación fue 59,7 % y la validación v2.1 es más estricta.
- No es posible medir el porcentaje de créditos diarios desde aquí. `ESTADO_ACTUAL.md` funciona como checkpoint preventivo.

## Próximo paso
Subir el notebook a Colab con GPU T4 y pulsar «Ejecutar todas». Compartir la salida del capítulo 04 (inventario) y, al terminar, el `ESTADO_ACTUAL.md` y `comparacion_experimentos.csv` para analizar los resultados y decidir si hace falta otro experimento.
