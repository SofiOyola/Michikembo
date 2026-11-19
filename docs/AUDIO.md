# Audio de la consola y de Michikembo

## Qué hay ahora (completado)

Toda la música y los efectos que suenan hoy son **composiciones originales** escritas como notas en
`compartido/audio/composiciones.js` y **sintetizadas en el navegador** con Web Audio (ondas cuadradas,
triangulares y ruido, estilo 8-bit). No hay ningún archivo de audio ni pieza de terceros.

| Momento | Id | Tipo | Conducta |
|---|---|---|---|
| Selector de juegos de la consola | `bienvenida` | Música, bucle de 8 compases (112 bpm) | Suena tras pulsar POWER. Se apaga con un fundido corto al abrir un juego y vuelve al regresar |
| Encender / apagar consola | `encender` / `apagar` | Efecto | — |
| Mover selección / abrir juego / volver | `navegar` / `abrir_juego` / `volver` | Efecto | — |
| Entrar al GAME SELECT | `maullido` | Efecto | — |
| Menú, «¿Estás listo?», elegir victorias, cámara | `menu_theme` | Música, bucle de 8 compases (138 bpm) | **No se reinicia** al pasar de una pantalla a otra |
| Rondas | — | Sin música | Para oír bien la cuenta y los resultados |
| Cuenta 3 y 2 | `cuenta_3`, `cuenta_2` | Efecto | Suena con cada número, cada vez más agudo |
| «1» + revelación de Michi | `reveal` | Efecto | Coincide con la animación del gato |
| Ganas la ronda / Michi gana / empate | `round_win` / `round_lose` / `round_tie` | Efecto | Breves (menos de 1 s) |
| No se vio tu gesto | `no_gesture` | Efecto | Aviso suave, sin tono de castigo |
| `YOU WIN` | `final_win` | Fanfarria (3,2 s) | No se repite |
| `YOU LOSE` | `final_lose` | Tema breve descendente (3,3 s) | No se repite |
| Botones del juego | `boton` | Efecto | — |

## Reglas del gestor (`compartido/audio/gestor_audio.js`)

- **Una sola música a la vez.** Pedir otra hace un fundido de salida y la nueva entra después. Nunca se superponen.
- **Nada suena antes de un clic o una tecla.** El juego abierto desde la consola ya cuenta con el clic de la consola. Abierto suelto, espera al primer clic.
- La consola **suspende su audio** mientras hay un juego abierto. Al salir del juego, el juego **cierra su audio** por completo.
- La pestaña oculta suspende el audio. La vista previa de la consola **no tiene audio**.
- Volúmenes y silencio se guardan en el navegador (`mk.audio.v1`) y son **compartidos**: silenciar en la consola (SELECT) también silencia el juego.

## Controles para el jugador

- **Consola:** botón SELECT (o tecla Shift) = silencio sí/no.
- **Michikembo:** botón ♪ arriba a la derecha o tecla **M** = silencio. En **AJUSTES** hay tres barras: volumen general, música y efectos.

## Cómo poner tus propios archivos

1. Copia tu archivo en la carpeta del juego:
   - `assets/audio/michikembo/` para Michikembo
   - `assets/audio/console/` para la consola
2. Abre el `pistas.json` de esa carpeta (en VS Code) y cambia `null` por el nombre de tu archivo:

   ```json
   "menu_theme": "mi_tema.ogg",
   "final_win": { "archivo": "victoria.mp3", "volumen": 0.7 },
   ```

   - `volumen` es opcional (de 0 a 1).
   - `"bucle": false` es opcional, para que una música no se repita.
   - Para volver a la música original, pon otra vez `null`.
3. Recarga la página con **Ctrl+F5**.
4. Comprueba que funcionó: abre `http://localhost:8000/games/michikembo/?dev=1`. En el panel de desarrollo, la fila **Audio** dice `(archivo)` cuando suena tu archivo. Si un archivo falta o está mal escrito, aparece `⚠` y el juego usa la versión original (no se rompe).
5. Añade una fila en `assets/audio/LICENCIAS.md` con el autor y la licencia del archivo.

Formatos: `.ogg` y `.mp3` para música, `.wav` u `.ogg` para efectos. Los ids válidos son los que ya aparecen en cada `pistas.json`.

## Cambiar la música original

Las notas están en `compartido/audio/composiciones.js`. Cada voz es un texto como `"C5:2 E5:2 .:4"`
(nota:duración en semicorcheas, `.` = silencio, `k s h` = bombo, caja, platillo, `|` separa compases).
Todas las voces de una pieza deben medir lo mismo: `npm test` lo comprueba.

## Licencias

Ver `assets/audio/LICENCIAS.md`. No uses canciones comerciales ni piezas sin licencia.
