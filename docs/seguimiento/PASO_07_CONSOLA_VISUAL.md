# Paso 07. Consola visual inspirada en la imagen de referencia (Fase 7)

## Objetivo
Una consola portátil original, bonita y funcional, inspirada en la imagen de Jesus: fondo azul pastel, carcasa blanca con borde morado, pantalla violeta con reflejos, cruceta, botones A/B rosados, controles inclinados y rejilla de altavoz. En la pantalla: GAME SELECT con previews, ◀ 1/3 ▶ y [A] JUGAR. Al jugar, el juego se expande y se puede volver.

## Estado inicial
Consola horizontal crema con orejas de gato, solo con cruceta y A (B, SELECT y START retirados por Jesus). Tipografía cargada desde Google Fonts.

## Trabajo realizado
- `console/index.html` y `console/css/console.css` reescritos: consola **vertical**, toda dibujada con CSS (sin imágenes copiadas), escalable con `--u`.
- Elementos de la referencia reinterpretados: franja superior con interruptor POWER y LED, marco violeta con esquina inferior redondeada, LED rosa de encendido, líneas bajo la pantalla, cruceta morada sobre círculo lavanda, A y B rosados en una pastilla lavanda inclinada, SELECT/START inclinados, rejilla diagonal.
- Pantalla GAME SELECT: insignia del juego, título pixel, preview, `◀ 1/3 ▶`, descripción en 2 líneas, puntos y `Ⓐ JUGAR` parpadeante. Todas son pulsables.
- Microanimaciones: latido al encender, botones que se hunden e iluminan, flechas que se mueven, reflejos del cristal.
- Preview de Michikembo nueva: Michi con **tus GIF** (idle → jugada → feliz/triste), cuenta 3‑2‑1 y "primero en ganar 3". Sin cámara ni modelo.
- Fuente local (Press Start 2P), ya no depende de Google Fonts.
- La lógica de `console/js/main.js` no cambió: solo un juego montado a la vez, la cámara se cierra al salir (`media-guard`), el audio de la consola se suspende durante el juego.

## Archivos creados o modificados
`console/index.html`, `console/css/console.css`, `console/README.md`, `games/michikembo/adapter.js` (preview e insignia), `docs/DECISIONES_TECNICAS.md` (D20–D23), `docs/ESTADO_ACTUAL.md`.

## Pruebas ejecutadas y resultados
Chromium headless (Playwright), consola en <http://localhost:8765/console/>:

| Interacción | Resultado |
|---|---|
| POWER (clic) y `P` | enciende → arranque → GAME SELECT · apaga |
| Cruceta derecha (clic), flecha ◀ de la pantalla, `←` `→` | cambia de juego (1/3 ↔ 2/3 ↔ 3/3) |
| SELECT | sonido `♪ ON` ↔ `♪ OFF` |
| A (clic) | Michikembo se expande a pantalla completa y muestra su menú |
| Abrir cámara dentro de Michikembo y salir con Esc dos veces | 1 cámara abierta → **0** al volver |
| START con Cosmic Drift | se abre (abre su cámara) · «◀ CONSOLA» → **0** cámaras |
| `Enter` con Dino Corredor · `Esc` | se abre y vuelve |
| Móvil 390×844 con toques | cruceta y A responden, el juego se abre |
| Errores de consola | ninguno propio. Solo el aviso de MediaPipe sin internet en el servidor de pruebas (Cosmic Drift carga MediaPipe de un CDN) |

`npm test`: 42/42 (la lógica no cambió).

## Riesgos y limitaciones
- **Esc dentro de un juego** retrocede primero dentro del juego (por ejemplo, de la pantalla de cámara al menú de Michikembo). Otra pulsación vuelve a la consola. El botón «◀ CONSOLA» vuelve siempre de inmediato.
- Cosmic Drift necesita internet para MediaPipe. Con cámara real **sin probar** (Fase 8).
- No se probó en Safari ni Firefox.

## Evidencias y rutas
`docs/seguimiento/capturas_fase7/` (apagada, select Michikembo, select Dino, juego expandido, móvil).

## Estado final
**Completado.**

## Siguiente paso exacto
Fase 6: música y efectos por escena con un gestor de audio y carpetas reemplazables.
