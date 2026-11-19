# Paso 06. Música, efectos y ambientación (Fase 6)

## Objetivo
Que la consola y Michikembo tengan música y efectos adecuados para cada pantalla, sin músicas superpuestas, con silencio y volúmenes, y que Jesus pueda cambiar cualquier pieza por un archivo suyo sin tocar código (plan §10 y Fase 6).

## Estado inicial
Efectos sueltos sintetizados (`games/michikembo/js/sonido.js` y `console/js/sfx.js`), sin música, sin volúmenes y sin forma de usar archivos propios.

## Trabajo realizado
- **Gestor de audio compartido** `compartido/audio/gestor_audio.js`: volumen maestro, de música y de efectos, silencio, fundidos, una sola música a la vez, precarga de archivos opcionales, liberación completa y desbloqueo solo tras un gesto del jugador.
- **Notación** `compartido/audio/notas.js` para escribir melodías como texto.
- **Composiciones originales** `compartido/audio/composiciones.js`: 2 temas en bucle (`bienvenida` de la consola, `menu_theme` de Michikembo), 2 piezas finales (`final_win`, `final_lose`) y 15 efectos. Todo es composición propia sintetizada. **No** se generaron ni se usaron archivos de audio.
- **Archivos opcionales del usuario**: `assets/audio/<juego>/pistas.json` (todo en `null` = versión original) y `assets/audio/LICENCIAS.md`.
- Michikembo: música según el estado (`musicaDeEstado` en `games/michikembo/js/sonido.js`), cuenta 3‑2 y revelación sincronizadas con la animación, efectos de resultado, ajustes con 3 barras de volumen y silencio, fila **Audio** en el panel de desarrollo.
- Consola: tema de bienvenida en el selector, fundido al abrir un juego, vuelve al regresar. SELECT silencia (compartido con el juego).

## Archivos creados o modificados
Nuevos: `compartido/audio/{notas.js, gestor_audio.js, composiciones.js}`, `assets/audio/{LICENCIAS.md, console/pistas.json, michikembo/pistas.json}`, `tests/audio.test.mjs`, `docs/AUDIO.md`.
Modificados: `games/michikembo/js/{sonido.js, main.js}`, `games/michikembo/index.html`, `games/michikembo/css/michikembo.css`, `console/js/{sfx.js, main.js}`, `docs/{ESTADO_ACTUAL.md, DECISIONES_TECNICAS.md, PRUEBAS_Y_EVIDENCIAS.md, arquitectura.md}`.

## Pruebas ejecutadas y resultados
- `npm test`: **55/55** (13 nuevas de audio con un AudioContext falso: notación, composiciones sin desfase, pistas.json válidos, preferencias, nada antes del gesto, misma música sin reinicio, sin solapamiento, bucle y final que termina, silencio, archivo del usuario con aviso si falta, liberación, música por estado).
- Navegador (Chromium headless, Playwright):

| Paso | Resultado |
|---|---|
| Consola antes de POWER | Sin AudioContext creado |
| Selector | `bienvenida` sonando |
| SELECT dos veces | silencio sí → no |
| Abrir Michikembo | Consola suspendida y sin música. Juego: `menu_theme` |
| Menú → ¿Listo? → meta | `menu_theme` sigue (sin reinicio) |
| Ronda | Sin música |
| `YOU WIN` | `final_win`, y a los 3,6 s ya no suena (no se repite) |
| Cambiar meta | Vuelve `menu_theme` |
| Barra de música al 30 % | Preferencia 0,3 guardada |
| Tecla M | Silencio y icono `✕♪` |
| Salir con Esc | Iframe destruido, consola vuelve a `bienvenida` |
| Juego suelto sin clic / tras clic | Sin AudioContext / `menu_theme` |
| Vista previa | Sin audio |
| Archivo propio `prueba.wav` en pistas.json | Suena `(archivo)`. Un archivo inexistente deja un aviso y se usa el original |

Sin errores en la consola del navegador (salvo el 404 provocado a propósito).

## Riesgos y limitaciones
- En el contenedor no hay altavoces: se comprobó **qué** suena y **cuándo**, no cómo se oye. Jesus debe escucharlo y decir si algún volumen o melodía no le gusta.
- Si el navegador bloquea el audio del iframe, la música del menú empieza en el primer clic dentro del juego.

## Evidencias y rutas
`docs/seguimiento/capturas_fase6/ajustes_audio.png`.

## Estado final
Fase 6 **completada** en lo comprobable automáticamente. **Pendiente** la escucha de Jesus.

## Siguiente paso exacto
Informe de cámara real y umbral (Fase 3) y después Fase 8 (Cosmic Drift).
