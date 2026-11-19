# Michikembo — Paso 10 — Unificación de las dos consolas
Fecha (Colombia): 2026-11-18
Estado: COMPLETADO (unificación y pruebas automáticas). PENDIENTE: borrar el duplicado `game/` (espera confirmación) y regenerar el bundle del repositorio.

## Objetivo
Dejar una sola consola oficial en `michikembo/console/` con lo mejor de las dos que se construyeron en paralelo.

## Qué se tomó de cada una
| Parte | Origen | Motivo |
|---|---|---|
| Carcasa, pantalla de matriz de puntos, orejas, POWER | A (`console/`) | Identidad propia más marcada y ya probada en móvil |
| Máquina de estados, contrato de cartuchos, `media-guard.js`, `sfx.js` | A | Arquitectura más limpia: cada juego es un adaptador con ciclo de vida y la cámara se cierra con red de seguridad |
| Michikembo jugable (detector simulado, listo para ONNX) | B (`game/games/michikembo/`) | A solo tenía un cartucho reservado |
| Pruebas unitarias, `package.json`, `assets/michi/`, `models/`, `docs/arquitectura.md` | B | No existían en A |
| Scripts `traer_cosmic_drift.*` | B, adaptados para descargar en `games/cosmic_drift/fuente/` | Descarga fijada al commit probado |
| Barra «◀ Consola» que se oculta sola | B (idea), reescrita en A | Tapaba el logo del HUD de Michikembo |
| Dino | A (Dino Corredor) | Integrado nativo con el contrato y la estética de la pantalla. Dino Sprint de B queda descartado por duplicado |
| Vista previa de Cosmic Drift | A | Equivalente a la de B, ya integrada en el adaptador |

## Acciones ejecutadas
- `games/michikembo/`: copiados `index.html`, `css/` y `js/` de B. `adapter.js` reescrito: preview en canvas, `mount()` en iframe, escucha `{origen:"michikembo", tipo:"salir"}`, envía `pausar | reanudar | detener`. Insignia: DETECTOR SIMULADO.
- `games/cosmic_drift/fuente/`: copia del código ya descargado por B (commit `4a88579`). Ignorada por Git (`.gitignore`).
- `console/js/main.js`: barra que se oculta sola y limpieza de la transformación del canvas de preview (antes, tras ver Dino, la preview de Michikembo se dibujaba encogida en una esquina).
- Raíz: `README.md`, `.gitignore`, `package.json`, `index.html`, `tests/`, `assets/michi/`, `models/`.
- Documentación: `docs/arquitectura.md` (sección de consola reescrita), `docs/ESTADO_ACTUAL.md`, `console/README.md` (controles de cada juego), `games/cosmic_drift/README.md`.

## Evidencias (Chromium headless, cámara simulada)
- `node --test tests/*.test.mjs`: 9 de 9 pruebas pasan.
- Michikembo: off → select → playing. Partida iniciada, tecla 1 = piedra, ronda resuelta y puntuada. Cámara abierta durante la partida (1 pista). Esc → menú del juego, Esc → consola: 0 iframes y 0 pistas vivas.
- Cosmic Drift: abre su menú con la cámara. «◀ Consola» → 0 iframes y 0 pistas vivas.
- Dino: juega y tras Esc quedan 0 canvas en el escenario.
- 390 px de ancho: sin scroll horizontal.
- Errores de consola esperados en la prueba: MediaPipe no descargó (sin red en el entorno) y la música de Cosmic no se sirvió (se excluyó del servidor de prueba por tamaño).
- Capturas: `docs/bitacora/capturas_unificada/`.

## No probado
Webcam real, Cosmic Drift con MediaPipe real, Safari, gamepad físico, detector ONNX (no hay modelo).

## Próximo paso
1. Confirmar el borrado de duplicados (`game/` y `consola_michikembo.zip`).
2. En tu PC: `python -m http.server 8000` desde `michikembo/` y abrir <http://localhost:8000/console/> con tu cámara real.
3. Regenerar el bundle del repositorio con la estructura unificada.
