# Estado actual — Michikembo
Actualizado: 19/11/2026. Fases según `docs/PLAN_MAESTRO.md` §12.

| Fase | Estado | Detalle |
|---|---|---|
| 0. Inventario y respaldo | **Completada** | `seguimiento/PASO_00_INVENTARIO.md` |
| 1. Base y arquitectura web | **Completada antes** (consola + 3 módulos navegables). Se mantiene la estructura actual (D1) | — |
| 2. Modelo reemplazable | **Completada** (E3c en `assets/models/michikembo/current/`, sha256, equivalencia JS/Python 10/10) | `seguimiento/PASO_02_MODELO_REEMPLAZABLE.md`, `COMO_CAMBIAR_MODELO.md` |
| 3. Webcam y estabilidad | **Parcial**: permiso explícito, diagnóstico, filtro con Nada/Ambiguo, ventana tras el 1, bloqueo. Jesus probó una partida con su webcam el 19/11 y **funciona bien**. **Falta** el informe con cifras (FPS, acierto por gesto, falsas activaciones) | `PRUEBAS_Y_EVIDENCIAS.md` |
| 4. Mecánicas de Michikembo | **Completada** en modo prueba y con cámara falsa + modelo real | `seguimiento/PASO_04_RONDA_COMPLETA.md` |
| 5. Animaciones de Michi | **Cerrada por decisión de Jesus** (19/11): se usan tal cual los 6 GIF de su ZIP | — |
| 6. Música y efectos | **Completada**: gestor de audio, música y efectos originales, volúmenes, archivos propios por `pistas.json`. Falta que Jesus lo escuche | `seguimiento/PASO_06_AUDIO.md`, `AUDIO.md` |
| 7. Consola visual (imagen de referencia) | **Completada**: carcasa nueva, GAME SELECT con previews, cruceta/A/B/SELECT/START funcionales, expansión y regreso, móvil | `seguimiento/PASO_07_CONSOLA_VISUAL.md` |
| 8. Cosmic Drift | Integrado antes. **Sin probar** con cámara real | — |
| 9. Dinosaurio | Completado antes (Dino Corredor) | — |
| 10. Pruebas integrales | Pendiente | — |
| 11. GitHub y entrega | Pendiente (decidir si se publica `model.onnx`, D16) | — |

**Modelo:** E3c (YOLOv8n + aumentación) es **provisional y experimental**. No alcanza el 90 %. El entrenamiento v2.2 (E4a/E4b) sigue en Colab en otro hilo.

## Cómo retomar
1. Probar: `python -m http.server 8000` → <http://localhost:8000/console/> o <http://localhost:8000/games/michikembo/?dev=1>.
2. Pruebas: `npm test`.
3. Siguiente trabajo: informe de cámara real (Fase 3) → Cosmic Drift (Fase 8) → Dinosaurio (Fase 9) → pruebas integrales (Fase 10) → GitHub (Fase 11).
