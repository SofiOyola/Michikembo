# Michikembo — Paso 09 (+11) — Consola de tres juegos y Dino Corredor
Fecha (Colombia): 2026-11-18
Estado: PARCIAL (consola y dino COMPLETADOS y probados en navegador automatizado; Michikembo PENDIENTE del modelo; Cosmic Drift integrado pero sin prueba con MediaPipe real)

## Objetivo
Construir la parte de la consola que no depende del modelo entrenado (plan §12, etapas 9, 10 y 11).

## Acciones ejecutadas
- Consola web propia (carcasa crema con orejas de gato, pantalla de matriz de puntos), inspirada solo en el patrón de interacción de sadok.mx: encendido, cruceta, A/B, Start/Select.
- Carrusel de 3 cartuchos con preview animada sin cámara ni modelo. Selección y silencio persistentes en `localStorage`.
- Modo expandido: la pantalla crece hasta ocupar la ventana y muestra solo el juego. Pantalla completa del sistema opcional.
- Contrato común de juegos (`createPreview`, `mount` → `start/pause/resume/destroy`).
- Guardián de cámara (`media-guard.js`) que cierra cualquier stream al volver.
- Dino Corredor original: salto variable, agacharse, caída rápida, cactus, meteoritos a 3 alturas, velocidad creciente, puntaje y récord, pausa (P), táctil.
- Cosmic Drift montado en iframe de misma procedencia sin modificar su código (commit `4a88579`).
- Michikembo: cartucho reservado con preview ilustrativa y aviso honesto.

## Evidencias y resultados (Chromium headless, cámara simulada)
- Estados: off → select → playing → select correcto en los 3 cartuchos.
- Cosmic Drift: la cámara se abrió (pista `live`) y tras Escape quedó `ended`. 0 iframes restantes.
- Dino: tras Escape, 0 canvas en el escenario (bucle y listeners eliminados).
- Selección persistida tras recargar. Sin scroll horizontal a 390 px de ancho.
- Único error de consola: MediaPipe no descargó por la red del entorno de prueba (esperado, no es un fallo del código).
- Capturas en `docs/bitacora/capturas_consola/`.

## Archivos
`console/` (index.html, css/console.css, js/main.js, catalog.js, media-guard.js, sfx.js, README.md) y `games/` (dinosaur/, cosmic_drift/, michikembo/).

## Problemas y advertencias
- NO probado aún: Cosmic Drift con MediaPipe real y mano real, Safari, gamepad físico.
- El repo Cosmic-Drift no tiene LICENSE: no se copia, se clona en `games/cosmic_drift/fuente/`.
- Michikembo no es jugable: requiere el modelo (etapa 5) y las animaciones del usuario.

## Próximo paso
En tu PC: clonar Cosmic Drift (ver `games/cosmic_drift/README.md`), `python -m http.server 8000` desde `michikembo/`, abrir `http://localhost:8000/console/` y probar Cosmic Drift con tu cámara real.
