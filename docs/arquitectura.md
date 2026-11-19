# Arquitectura de la consola y los juegos

Decisión tomada el 18/11/2026 con el usuario: **web (HTML, CSS y JavaScript)**, sin Pygame. Es la opción recomendada en el plan (§12) porque Cosmic Drift ya es web y así no se mantienen dos motores.

## Consola (`console/`) — versión unificada

Unificación del 18/11/2026: carcasa y máquina de estados de la consola A (crema, orejas de gato, pantalla de matriz de puntos) con el Michikembo jugable de la consola B (MichiBox). Ver `docs/bitacora/PASO_10_unificacion_consolas.md`.

- Estados: `off → boot → select → launching → playing → closing → select` (`console/js/main.js`).
- Cada juego es un **cartucho** `games/<id>/adapter.js` con el contrato `createPreview(canvas)` y `mount(host, api) → {start, pause, resume, destroy}` (`console/js/catalog.js`).
- **Vistas previas sin cámara:** se dibujan en un único canvas de la consola. Solo hay un bucle de preview a la vez y se detiene antes de montar el juego. Al cambiar de cartucho se limpia la transformación del canvas.
- **Pantalla expandida:** el escenario crece desde el rectángulo de la pantalla hasta ocupar la ventana. La barra «◀ Consola» se oculta sola a los 2,5 s y reaparece al mover el ratón (también dentro de los iframes). Pantalla completa del sistema opcional (⛶).
- **Salida limpia:** `destroy()` del cartucho y luego `media-guard.js` cierra cualquier pista de cámara que siguiera viva (envuelve `getUserMedia` de la consola y de cada iframe de misma procedencia).
- Michikembo y Cosmic Drift se montan en un `<iframe>` de la misma procedencia. Dino Corredor se monta directamente en un canvas.
- Protocolo `postMessage` con Michikembo: la consola envía `pausar | reanudar | detener`. El juego envía `{origen:"michikembo", tipo:"listo"|"salir"}`.
- Cosmic Drift no conoce la consola: el adaptador escucha Esc en su ventana (fase de captura) y, si el juego está en su menú o en Game Over, vuelve. Al salir llama a sus propios `cameraManager.stopCamera()` y `audioManager.music.pause()`. Su código no se toca.

## Audio compartido (`compartido/audio/`)

`gestor_audio.js` (mezclador: maestro, música, efectos, silencio, una sola música a la vez con fundidos, archivos opcionales por `pistas.json`), `notas.js` (notación de melodías) y `composiciones.js` (música y efectos originales). Lo usan `console/js/sfx.js` y `games/michikembo/js/sonido.js`. Guía: `docs/AUDIO.md`.

## Michikembo (`games/michikembo/`)

| Módulo | Responsabilidad |
|---|---|
| `reglas.js` | Jugadas, clases del modelo (0=Paper, 1=Rock, 2=Scissors), quién gana, elección de Michi con `crypto.getRandomValues` |
| `estabilizador.js` | Decisión por fotograma y filtro temporal (nunca decide con un solo fotograma) |
| `maquina.js` | Máquina de estados única con reloj inyectado. Puntúa una sola vez por ronda |
| `detector/` | `onnx.js` (modelo real, lee `assets/models/michikembo/current/manifest.json`) y `simulado.js`, mismo contrato |
| `vision/` | `yolo.js` (letterbox, decodificación YOLOv8, NMS) y `manifiesto.js` (validación y clases por nombre), módulos puros |
| `camara.js` | Abrir, traducir errores a mensajes claros y liberar siempre |
| `michi.js` | Reproductor de GIF por estado (compatible con sprite sheets PNG) y marcador provisional |
| `sonido.js` | Crea el gestor de audio de Michikembo y decide la música de cada estado (`musicaDeEstado`) |
| `main.js` | Interfaz, bucle `requestAnimationFrame`, teclado, ajustes y mensajes con la consola |

### Estados (plan §6.6)

`GAME_MENU → ASK_READY → SELECT_TARGET_WINS → CAMERA_PERMISSION → ROUND_PREPARE → COUNTDOWN_3 → COUNTDOWN_2 → COUNTDOWN_1_REVEAL_CAT → CAPTURE_PLAYER_GESTURE → EVALUATE_ROUND → ROUND_WIN_PLAYER | ROUND_WIN_CAT | ROUND_TIE | ROUND_INVALID_GESTURE → WAIT_NEXT_ROUND → (ROUND_PREPARE…)` y al final `GAME_OVER_WIN` o `GAME_OVER_LOSE`. Además `PAUSED`, `CAMERA_ERROR` y `RETURN_TO_CONSOLE`.

`GAME_OVER_WIN` = el jugador llegó a la meta (Michi muestra `sad.gif`). `GAME_OVER_LOSE` = Michi llegó a la meta (Michi muestra `happy.gif`).

### Reglas de detección (ver `docs/DECISIONES_TECNICAS.md`, D10–D15)

- Michi elige y bloquea su jugada en `ROUND_PREPARE`, **antes** del 3, y la revela en el 1.
- La ventana de captura dura 2 s desde que aparece el 1. Fuera de ella los fotogramas no cuentan.
- Cada fotograma es piedra, papel, tijera, **nada** o **ambigua** (manos con gestos distintos). El umbral de confianza viene del `manifest.json` del modelo.
- Un gesto es estable con **5 fotogramas seguidos**. Se confirma el último gesto estable. "Nada" rompe las rachas.
- Sin gesto estable → `ROUND_INVALID_GESTURE` (`sin_mano`, `ambigua`, `inestable` o `insuficiente`): nadie suma.
- Las inferencias llevan el número de ronda. Una respuesta tardía se descarta y, tras cerrar la ventana, el resultado queda bloqueado.
- Los valores están en `js/config.js` y son **propuestas** hasta probarlas con webcam.

## Dino Corredor (`games/dinosaur/`)

Motor `dino.js` (canvas 16:9) + `adapter.js`. Salto variable, agacharse, caída rápida, cactus, meteoritos a 3 alturas, velocidad creciente, récord en `localStorage`, pausa (P), táctil y piloto automático para la vista previa. Arte en píxeles y sonido hechos con código.
