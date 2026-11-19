# Paso 04. Ronda y partida completas de Michikembo (Fase 4, con el filtro de la Fase 3)

## Objetivo
Una partida completa según el plan §6: «¿Estás listo?», meta de victorias, cuenta 3‑2‑1, jugada de Michi bloqueada y revelada en el 1, captura limitada del último gesto estable, marcador encima de cada casilla, empates y gestos inválidos sin puntos, y finales `YOU WIN` / `YOU LOSE`.

## Estado inicial
Partida fija "primero a 3" sin pantallas de «¿Estás listo?» ni meta. Michi elegía al terminar la cuenta. El filtro aceptaba "mayoría ≥ 60 % de fotogramas válidos" (ignoraba "nada").

## Trabajo realizado
- `maquina.js` reescrita con **los 20 estados del plan §6.6** (`GAME_MENU`, `ASK_READY`, `SELECT_TARGET_WINS`, `CAMERA_PERMISSION`, `ROUND_PREPARE`, `COUNTDOWN_3/2`, `COUNTDOWN_1_REVEAL_CAT`, `CAPTURE_PLAYER_GESTURE`, `EVALUATE_ROUND`, `ROUND_WIN_PLAYER/CAT`, `ROUND_TIE`, `ROUND_INVALID_GESTURE`, `WAIT_NEXT_ROUND`, `GAME_OVER_WIN/LOSE`, `CAMERA_ERROR`, `PAUSED`, `RETURN_TO_CONSOLE`). Cada acción comprueba el estado: un clic fuera de lugar no hace nada.
- Meta **"Primero en ganar N"** con N = 1, 3, 5, 7 (D9). VOLVER A JUGAR conserva la meta y CAMBIAR META vuelve a elegirla.
- Michi elige en `ROUND_PREPARE` (antes del 3) y se revela en el 1 (D10). Captura de 2 s desde el 1 (D11).
- `estabilizador.js` reescrito: "nada" y "ambigua" son estados reales, K = 5 seguidos, último gesto estable, bloqueo al cerrar, motivo `insuficiente` si la cámara/modelo van lentos (D12, D13).
- Interfaz nueva en pixel art pastel (inspirada en la imagen de referencia): **MICHI a la izquierda y JUGADOR a la derecha, cada uno con "VICTORIAS: n" encima**, "PRIMERO EN GANAR N" arriba y abajo, cartas VS, barra de captura, botón CONTINUAR para saltar pausas.
- Pantalla de cámara: explicación la primera vez, permiso solo al pulsar **ACTIVAR CÁMARA**, estado del detector y de la cámara, y **¡EMPEZAR!** solo cuando ambos están listos. La cámara se apaga en menús, fin de partida, error y salida.
- Mensajes `NO DETECTÉ TU GESTO` / `AMBIGUO` con la causa, sin tocar el marcador.
- Final con `YOU WIN` (dorado, confeti) o `YOU LOSE` (rojo), marcador final, historial y botones VOLVER A JUGAR · CAMBIAR META · SALIR A LA CONSOLA.
- Modo desarrollo (`D`, botón DEV o `?dev=1`): modelo, revision, umbrales, backend, estado, predicción instantánea, decisión estable, confianza, cajas, FPS, latencia y conteo de nada/ambiguo.
- Teclado: Enter/Espacio acción principal · Esc atrás/pausa · P pausa · M sonido · D desarrollo · 1/3/5/7 en la meta · 1/2/3/0 mano simulada.

## Archivos creados o modificados
`games/michikembo/index.html`, `css/michikembo.css`, `js/main.js`, `js/maquina.js`, `js/estabilizador.js`, `js/config.js`, `adapter.js` (textos de la consola), `assets/fonts/PressStart2P.woff2` + licencia OFL, `tests/michikembo.test.mjs`.

## Pruebas ejecutadas y resultados
`npm test` → **42/42** (28 de juego + 14 del modelo), 0 omitidas con el modelo y las fixtures presentes. Casos del plan §13 cubiertos automáticamente:

| Caso §13 | Prueba |
|---|---|
| NO en «¿Estás listo?» | vuelve al menú, ronda 0, Michi sin elegir |
| SÍ | abre la meta; metas inválidas rechazadas |
| Meta 3, 2–1 y gana Michi | termina 3–1 → `GAME_OVER_LOSE` (con un empate intermedio que no cambia el 2–1) |
| Meta 3, 2–2 y gana el jugador | termina 3–2 → `GAME_OVER_WIN` |
| Rock>Scissors, Paper>Rock, Scissors>Paper, mismo gesto | reglas |
| Sin mano / ambiguo / detección aislada | `ROUND_INVALID_GESTURE`, marcador intacto |
| Cambio de gesto tras confirmar | no modifica la ronda |
| Salir de Michikembo | `RETURN_TO_CONSOLE`: sin cámara ni fotogramas |
| Modelo ausente o corrupto | error legible (`manifest.json` / sha256) → pantalla de error con REINTENTAR y "jugar sin modelo" |
| 30 partidas aleatorias completas | el ganador llega exactamente a la meta y el historial suma el marcador |

Navegador (Chromium headless, Playwright):
- Con **cámara falsa = foto de tijera** y el **modelo E3c real**: meta 1 → cuenta → Michi revela piedra → se detecta tijera estable (7 fotogramas) → `MICHI GANA LA RONDA` → `YOU LOSE`. Cámara cerrada al terminar. Sin errores de consola.
- Con **cámara falsa vacía**: `NO DETECTÉ TU GESTO` (5 fotogramas "nada"), marcador 0–0.
- Con detector simulado manual: `YOU WIN` en escritorio y en móvil (390×844).
- Errores en el navegador: manifiesto ausente (404), `model.onnx` corrupto (sha256 distinto) y permiso de cámara denegado → `CAMERA_ERROR` con mensaje legible y sin cerrar la consola.
- Dentro de la consola: el juego se abre en su iframe y muestra el menú. La vista previa juega sola sin cámara.

## Riesgos y limitaciones
- **No probado con una webcam y una mano reales** (solo cámara falsa). Los tiempos y K = 5 son **PROPUESTA**.
- Los GIF de Michi cambian de escala entre `idle` y las jugadas (arte, Fase 5).
- Sonidos: siguen siendo los efectos sintetizados existentes. Música por escena = Fase 6.
- La consola todavía no tiene el diseño de la imagen de referencia (Fase 7).

## Evidencias y rutas
`docs/seguimiento/capturas_fase4/` (9 capturas: 1_estas_listo … 9_movil).

## Estado final
**Completado en modo de prueba sin webcam y con cámara falsa + modelo real.** Pendiente la validación con webcam real (Fase 3).

## Siguiente paso exacto
Jesus: jugar en <http://localhost:8000/games/michikembo/?dev=1> con su webcam y anotar en `docs/PRUEBAS_Y_EVIDENCIAS.md` FPS, latencia y cuántas rondas se resolvieron bien por gesto.
