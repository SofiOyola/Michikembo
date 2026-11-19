// ============================================================
// AUDIO COMPARTIDO — Música y efectos ORIGINALES del proyecto
//
// Todo lo de este archivo es composición propia escrita en código
// (notas y ritmos), sintetizada en el navegador con Web Audio.
// No se usan muestras ni piezas de terceros.
//
// Si quieres sustituir alguna pieza por un archivo tuyo (.ogg, .mp3,
// .wav), NO edites aquí: ponlo en assets/audio/<juego>/ y apúntalo
// en el pistas.json de esa carpeta (ver docs/AUDIO.md).
//
// Formato de cada pieza:
//   { titulo, paso (s por paso), bucle, voces: [{ instrumento, volumen, patron }] }
// Instrumentos: "pulso" (onda cuadrada), "pulso25" (onda estrecha),
//               "triangulo" (bajos suaves), "ruido" (k bombo, s caja, h platillo)
// ============================================================

import { pasoDeBpm } from "./notas.js";

// ------------------------------------------------------------
// CONSOLA
// ------------------------------------------------------------
export const MUSICA_CONSOLA = {
    // Tema de bienvenida: tranquilo, para el selector de juegos (Do, Lam, Fa, Sol)
    bienvenida: {
        titulo: "Bienvenida a la consola", paso: pasoDeBpm(112), bucle: true,
        voces: [
            { instrumento: "pulso25", volumen: 0.10, patron:
                "G5:4 E5:2 G5:2 C6:6 .:2 | A5:4 E5:2 A5:2 C6:6 .:2 | A5:2 G5:2 F5:2 A5:2 C6:4 A5:4 | B5:2 A5:2 G5:2 F5:2 D5:4 G5:4 |" +
                "E5:2 G5:2 C6:2 E6:2 D6:4 C6:4 | C6:2 A5:2 E5:2 A5:2 C6:8 | A5:2 C6:2 F6:4 E6:2 D6:2 C6:4 | B5:4 D6:4 G5:8" },
            { instrumento: "triangulo", volumen: 0.16, patron:
                "C3:8 G2:8 | A2:8 E3:8 | F2:8 C3:8 | G2:8 D3:8 | C3:8 G2:8 | A2:8 E3:8 | F2:8 C3:8 | G2:8 D3:8" },
            { instrumento: "ruido", volumen: 0.04, patron:
                "k:4 h:4 k:4 h:4 | k:4 h:4 k:4 h:4 | k:4 h:4 k:4 h:4 | k:4 h:4 k:4 h:2 h:2 |" +
                "k:4 h:4 k:4 h:4 | k:4 h:4 k:4 h:4 | k:4 h:4 k:4 h:4 | k:4 h:4 s:4 s:2 s:2" },
        ],
    },
};

export const EFECTOS_CONSOLA = {
    navegar:      { titulo: "Mover selección", paso: 0.05, voces: [{ instrumento: "pulso", volumen: 0.5, patron: "E6:1" }] },
    seleccionar:  { titulo: "Elegir juego", paso: 0.06, voces: [{ instrumento: "pulso", volumen: 0.5, patron: "C6:1 G6:2" }] },
    abrir_juego:  { titulo: "Abrir juego", paso: 0.05, voces: [{ instrumento: "pulso", volumen: 0.45, patron: "C5:1 E5:1 G5:1 C6:1 E6:1 G6:3" }] },
    volver:       { titulo: "Volver", paso: 0.06, voces: [{ instrumento: "pulso", volumen: 0.45, patron: "A5:1 E5:2" }] },
    encender:     { titulo: "Encendido", paso: 0.09, voces: [
        { instrumento: "pulso", volumen: 0.45, patron: "G4:1 C5:1 E5:1 C6:3" },
        { instrumento: "triangulo", volumen: 0.6, patron: "C3:3 C4:3" }] },
    maullido:     { titulo: "Maullido de bienvenida", paso: 0.05, voces: [{ instrumento: "pulso25", volumen: 0.4, patron: "A5:1 B5:2 F#5:3" }] },
    apagar:       { titulo: "Apagado", paso: 0.09, voces: [{ instrumento: "pulso", volumen: 0.45, patron: "C5:1 C4:2" }] },
};

// ------------------------------------------------------------
// MICHIKEMBO
// ------------------------------------------------------------
export const MUSICA_MICHIKEMBO = {
    // Tema del menú: 8-bit cálido y juguetón (Do, Fa, Sol, Do, Lam, Fa, Sol, Do)
    menu_theme: {
        titulo: "Michi juega", paso: pasoDeBpm(138), bucle: true,
        voces: [
            { instrumento: "pulso", volumen: 0.09, patron:
                "E5:2 G5:2 C6:2 G5:2 A5:2 G5:2 E5:4 | F5:2 A5:2 C6:2 A5:2 G5:2 F5:2 E5:2 D5:2 |" +
                "D5:2 G5:2 B5:2 G5:2 A5:2 B5:2 C6:4 | E5:2 C5:2 G4:4 .:2 G4:1 A4:1 B4:4 |" +
                "C5:2 E5:2 A5:3 G5:1 E5:2 C5:2 E5:4 | F5:2 A5:2 C6:3 B5:1 A5:2 F5:2 A5:4 |" +
                "G5:2 B5:2 D6:2 B5:2 C6:2 B5:2 A5:2 G5:2 | C6:4 G5:2 E5:2 C5:4 .:4" },
            { instrumento: "triangulo", volumen: 0.15, patron:
                "C3:2 G3:2 C4:2 G3:2 C3:2 G3:2 C4:2 G3:2 | F2:2 C3:2 F3:2 C3:2 F2:2 C3:2 F3:2 C3:2 |" +
                "G2:2 D3:2 G3:2 D3:2 G2:2 D3:2 G3:2 D3:2 | C3:2 G3:2 C4:2 G3:2 C3:2 G3:2 C4:2 G3:2 |" +
                "A2:2 E3:2 A3:2 E3:2 A2:2 E3:2 A3:2 E3:2 | F2:2 C3:2 F3:2 C3:2 F2:2 C3:2 F3:2 C3:2 |" +
                "G2:2 D3:2 G3:2 D3:2 G2:2 D3:2 G3:2 D3:2 | C3:4 G2:4 C3:4 .:4" },
            { instrumento: "ruido", volumen: 0.035, patron:
                "k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2 | k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2 |" +
                "k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2 | k:2 h:2 s:2 h:2 k:2 h:2 s:2 s:2 |" +
                "k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2 | k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2 |" +
                "k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2 | k:4 s:4 k:4 .:4" },
        ],
    },
    // Fanfarria final al ganar la partida (no se repite)
    final_win: {
        titulo: "¡Ganaste a Michi!", paso: pasoDeBpm(150), bucle: false,
        voces: [
            { instrumento: "pulso", volumen: 0.12, patron: "C5:1 E5:1 G5:1 C6:3 G5:1 C6:1 E6:6 .:2 D6:2 E6:2 F6:2 G6:10" },
            { instrumento: "triangulo", volumen: 0.18, patron: "C3:6 .:2 C3:6 .:2 G2:4 B2:4 C3:8" },
            { instrumento: "ruido", volumen: 0.05, patron: "k:4 s:4 k:4 s:4 k:2 k:2 s:2 s:2 k:8" },
        ],
    },
    // Tema breve al perder: descendente y simpático, sin dramatismo
    final_lose: {
        titulo: "Michi gana esta vez", paso: pasoDeBpm(110), bucle: false,
        voces: [
            { instrumento: "pulso25", volumen: 0.11, patron: "G5:2 F#5:2 F5:2 E5:4 .:2 C5:1 B4:1 Bb4:1 A4:1 G#4:8" },
            { instrumento: "triangulo", volumen: 0.16, patron: "C3:4 B2:4 Bb2:4 A2:4 G#2:8" },
        ],
    },
};

export const EFECTOS_MICHIKEMBO = {
    boton:        { titulo: "Botón", paso: 0.04, voces: [{ instrumento: "pulso", volumen: 0.35, patron: "E6:1" }] },
    // Cuenta regresiva: cada número sube de tono (3 grave → 1 agudo)
    cuenta_3:     { titulo: "Cuenta 3", paso: 0.05, voces: [
        { instrumento: "pulso", volumen: 0.5, patron: "C5:3" }, { instrumento: "ruido", volumen: 0.5, patron: "k:3" }] },
    cuenta_2:     { titulo: "Cuenta 2", paso: 0.05, voces: [
        { instrumento: "pulso", volumen: 0.5, patron: "E5:3" }, { instrumento: "ruido", volumen: 0.5, patron: "k:3" }] },
    // El «1» coincide con la revelación del gato
    reveal:       { titulo: "1 y revelación de Michi", paso: 0.045, voces: [
        { instrumento: "pulso", volumen: 0.5, patron: "G5:1 C6:1 E6:1 G6:3" },
        { instrumento: "ruido", volumen: 0.5, patron: "k:2 s:4" }] },
    round_win:    { titulo: "Ganas la ronda", paso: 0.07, voces: [{ instrumento: "pulso", volumen: 0.5, patron: "C5:1 E5:1 G5:1 C6:3" }] },
    round_lose:   { titulo: "Michi gana la ronda", paso: 0.09, voces: [{ instrumento: "triangulo", volumen: 0.8, patron: "E5:2 C5:2 A4:3" }] },
    round_tie:    { titulo: "Empate", paso: 0.08, voces: [{ instrumento: "pulso25", volumen: 0.4, patron: "G5:2 .:1 G5:2" }] },
    // Aviso suave: sin tono de castigo
    no_gesture:   { titulo: "No vi tu mano", paso: 0.09, voces: [{ instrumento: "triangulo", volumen: 0.6, patron: "A5:2 E5:3" }] },
};
