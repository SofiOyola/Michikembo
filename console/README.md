# Consola Michikembo

Consola web de tres juegos (plan §1 y §12). HTML, CSS y JavaScript sin dependencias ni compilación.

## Probarla en tu PC

Los módulos JavaScript y el iframe de Cosmic Drift necesitan un servidor local (abrir el `.html` con doble clic **no** funciona).

En la terminal de Windows o en la terminal de VS Code, desde la carpeta `michikembo/` (la que contiene `console/` y `games/`):

```bash
python -m http.server 8000
```

Abre <http://localhost:8000/console/> en Chrome o Edge. La cámara solo se permite en `localhost` o `https`.

Para Cosmic Drift, primero descarga su código (una sola vez): ver `games/cosmic_drift/README.md`.

## Controles

| Acción | Teclado | En pantalla |
|---|---|---|
| Encender / apagar | `P` (cualquier tecla enciende) | POWER |
| Elegir juego | `←` `→` (o `A` `D`) | Cruceta, flechas ◀ ▶, puntos |
| Jugar | `Enter`, `Z`, `Espacio` | A |
| Jugar (alternativa) | `Enter` | START |
| Volver a la consola | `Esc`, `X` | B o «◀ CONSOLA» (abajo a la izquierda) |
| Sonido de la consola | `Shift` | SELECT |

Dentro de un juego, la barra «◀ CONSOLA» se oculta a los 2,5 s y reaparece al mover el ratón.

| Juego | Teclas |
|---|---|
| Michikembo | mano frente a la cámara (modelo E3c) · en modo simulado `1` piedra · `2` papel · `3` tijera · `0` nada · `P` pausa · `M` sonido · `D` desarrollo · `Esc` retrocede un nivel (en su menú, vuelve a la consola) |
| Cosmic Drift | mano frente a la cámara · `F` pantalla completa · `Esc` su menú (Esc otra vez vuelve a la consola) |
| Dino Corredor | `Espacio`/`↑`/toque saltar (mantener = más alto) · `↓` agacharse · `P` pausa · `Esc` consola |

## Estructura

```text
console/
  index.html          carcasa, pantalla y escenario expandido
  css/console.css     carcasa vertical blanca y morada inspirada en la imagen de referencia (paleta en :root, medidas en --u)
  js/main.js          máquina de estados: off → boot → select → launching → playing → closing
  js/catalog.js       lista de cartuchos y contrato común
  js/media-guard.js   registra y cierra cámaras al salir de un juego
  js/sfx.js           pitidos sintetizados (sin audio de terceros)
games/
  dinosaur/           Dino Corredor: original, jugable (dino.js + adapter.js)
  cosmic_drift/       adaptador del juego existente; su código se descarga en fuente/
  michikembo/         juego completo (index.html, css/, js/) + adapter.js. Modelo ONNX E3c o detector simulado
```

## Contrato de cada juego (`games/<id>/adapter.js`)

```js
export default {
  id, title, description, status: "ready" | "pending", badge, usesCamera,
  createPreview(canvas) { return { frame(dt) {}, dispose() {} }; }, // sin cámara, sin modelo, sin audio
  async mount(host, api) { return { start(), pause(), resume(), destroy() }; } // api.exit() vuelve a la consola
};
```

Garantías de la consola: un solo juego montado a la vez, la preview se detiene al jugar, el audio de la consola se suspende durante el juego, y al volver se destruye el juego y se cierran las cámaras registradas.
