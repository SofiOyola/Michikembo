# Michikembo — Paso 02 — Juego Michikembo, Dino Sprint y consola (sin modelo)
Fecha (Colombia): 2026-11-18
Estado: COMPLETADO en lo que no depende del modelo · integración del modelo PENDIENTE · animaciones de Michi PENDIENTES del autor

## Objetivo
Avanzar con todo lo que no necesita el detector entrenado: el juego Michikembo completo con un detector simulado, el juego del dinosaurio, la consola con sus tres juegos y la estructura del repositorio.

## Acciones ejecutadas
- Decisión de tecnología confirmada por el usuario: **web HTML/CSS/JS** (ver `docs/arquitectura.md`).
- Michikembo: máquina de estados con los 10 estados del plan, filtro de estabilidad, detector simulado (modo manual con teclas 1/2/3 y modo aleatorio que provoca todos los casos), stub ONNX que falla con "modelo no disponible", cámara con manejo de errores, marcador, historial, pausa, ajustes, sonido sintetizado y vista previa automática.
- Michi: reproductor de sprite sheets listo. Se muestran marcadores provisionales rotulados porque **no hay animaciones todavía** (no se fabricó arte).
- Dino Sprint: corredor original completo.
- Consola MichiBox: encendido, selección con vistas previas, modo juego expandido, salida limpia.
- Cosmic Drift: copiado sin cambios desde su repositorio (commit `4a88579`), fuera de Git por su peso, con scripts de descarga.

## Evidencias y resultados
- `node --test tests/*.test.mjs`: **9 de 9 pruebas pasan** (reglas, azar uniforme de Michi, decisión por fotograma, estabilidad, partida completa a 3, derrota, descarte de inferencias de otra ronda, pausa).
- Prueba en Chromium sin interfaz (Playwright, cámara falsa):
  - Michikembo en modo aleatorio jugó una partida completa hasta VICTORY y pasó por gana, pierde, empate, sin mano e inestable. La cámara quedó liberada al terminar.
  - Detector ONNX → pantalla de error "Modelo no disponible" → botón "Jugar con detector simulado" funciona.
  - Pausa congela la ronda. Esc vuelve al menú y apaga la cámara.
  - Consola: un solo iframe a la vez en selección y en juego. Esc en el título de Dino y en el menú de Cosmic Drift vuelve a la consola. Michikembo abre la cámara dentro de la consola y el botón ◀ Consola la cierra.
  - Sin desbordes horizontales a 390 px de ancho.
- **No probado:** Cosmic Drift jugando de verdad (en el entorno de prueba no había acceso a la CDN de MediaPipe), cámara real, Safari y Firefox, rendimiento en el equipo del usuario.

## Archivos respaldados
`console/`, `games/michikembo/`, `games/dinosaurio/`, `games/cosmic_drift/PROCEDENCIA.md`, `assets/michi/`, `models/README.md`, `scripts/traer_cosmic_drift.sh`, `scripts/traer_cosmic_drift.ps1`, `tests/michikembo.test.mjs`, `README.md`, `docs/arquitectura.md`, `.gitignore`, `package.json`.

## Problemas y advertencias
- Los tiempos (ventana de 2 s, 6 fotogramas, umbral 0,6) son propuestas sin validar con webcam.
- Cosmic Drift no tiene archivo de licencia. Confirmar antes de redistribuirlo.
- Nada se ha subido aún a GitHub.

## Próximo paso
1. Probar en Windows: `python -m http.server 8000` y abrir `http://localhost:8000/console/`.
2. Cuando exista `best.onnx`: implementar `games/michikembo/js/detector/onnx.js` (onnxruntime-web, letterbox, NMS) y medir FPS reales.
3. Actualización posterior: el reproductor admite GIF directos. Las seis animaciones entregadas están en `assets/michi/sprites/` y declaradas en `animations.json`.
4. Con autorización: subir el repositorio a `SofiOyola/Michikembo`.
