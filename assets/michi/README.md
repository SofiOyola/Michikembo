# Animaciones de Michi — dónde colocar los GIF

El juego muestra archivos GIF animados directamente. Mientras falte una animación se ve un marcador provisional. También se conserva compatibilidad con hojas de sprites PNG.

## Carpeta

```text
assets/michi/
  source/GatoBase.ase      ← copia aquí tu archivo fuente
  sprites/<animacion>.gif  ← un GIF animado por estado
  animations.json          ← lista de estados (ver abajo)
```

## Estados que usa el juego

| Archivo | Cuándo se ve |
|---|---|
| `idle.gif` | Menú, cuenta regresiva, empate, espera |
| `piedra.gif` / `papel.gif` / `tijera.gif` | Michi revela su jugada y mientras tú respondes |
| `happy.gif` | Michi gana una ronda o la partida (estado lógico `feliz`) |
| `sad.gif` | Michi pierde una ronda o la partida (estado lógico `triste`) |

## Formato GIF

1. Copia cada GIF terminado en `assets/michi/sprites/` con el nombre de la tabla.
2. No es necesario separar sus fotogramas ni convertirlo a PNG.
3. Se recomienda que todos tengan las mismas dimensiones y el mismo anclaje visual para que Michi no salte al cambiar de estado.
4. El juego ajusta el GIF dentro de su panel sin deformarlo y lo reinicia al entrar en el estado.

## `animations.json`

Añade una entrada por cada sprite que ya tengas. Los que no estén siguen con el marcador provisional.

```json
{
  "frameAncho": 32,
  "frameAlto": 32,
  "estados": {
    "idle":   { "archivo": "sprites/idle.gif", "tipo": "gif" },
    "piedra": { "archivo": "sprites/piedra.gif", "tipo": "gif" },
    "feliz":  { "archivo": "sprites/happy.gif", "tipo": "gif" }
  }
}
```

El bucle y la velocidad pertenecen al propio GIF. `animations.json` declara únicamente estas seis animaciones. En empates, ausencia de jugada o errores se muestra `idle.gif`.
