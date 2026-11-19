// ============================================================
// MICHIKEMBO — Reglas del juego (módulo puro, sin DOM)
// Se puede importar desde el navegador y desde Node (pruebas).
// ============================================================

/** Las tres jugadas posibles, con el nombre que se usa en todo el código. */
export const JUGADAS = Object.freeze(["piedra", "papel", "tijera"]);

/**
 * Orden de clases del modelo YOLOv8 entrenado en el notebook:
 * 0 = Paper, 1 = Rock, 2 = Scissors.
 * El detector devuelve índices de clase y aquí se traducen a jugadas.
 */
export const CLASES_MODELO = Object.freeze(["papel", "piedra", "tijera"]);

/** Emoji y texto visible de cada jugada (solo para la interfaz). */
export const ETIQUETAS = Object.freeze({
    piedra: { texto: "Piedra", emoji: "✊" },
    papel: { texto: "Papel", emoji: "✋" },
    tijera: { texto: "Tijera", emoji: "✌️" },
});

/** Qué jugada vence a cuál: piedra vence tijera, tijera vence papel, papel vence piedra. */
const VENCE_A = Object.freeze({ piedra: "tijera", tijera: "papel", papel: "piedra" });

/**
 * Resultado de una ronda SIEMPRE desde la perspectiva del jugador humano.
 * @param {string|null} jugador  jugada detectada ("piedra" | "papel" | "tijera") o null si no hubo jugada válida
 * @param {string} michi         jugada de Michi
 * @returns {"gana"|"pierde"|"empate"|"sin_jugada"}
 */
export function resolverRonda(jugador, michi) {
    if (!JUGADAS.includes(michi)) throw new Error(`Jugada de Michi inválida: ${michi}`);
    if (jugador === null || jugador === undefined) return "sin_jugada";
    if (!JUGADAS.includes(jugador)) throw new Error(`Jugada del jugador inválida: ${jugador}`);
    if (jugador === michi) return "empate";
    return VENCE_A[jugador] === michi ? "gana" : "pierde";
}

/**
 * Elige la jugada de Michi al azar, de forma independiente al jugador.
 * Usa crypto.getRandomValues cuando existe (navegador y Node 19+).
 * @param {() => number} [aleatorio] función opcional que devuelve [0,1) para pruebas
 */
export function elegirJugadaMichi(aleatorio) {
    let r;
    if (aleatorio) {
        r = aleatorio();
    } else if (globalThis.crypto?.getRandomValues) {
        // Rechazo de valores altos para que las tres opciones tengan exactamente la misma probabilidad
        const buf = new Uint8Array(1);
        do { globalThis.crypto.getRandomValues(buf); } while (buf[0] >= 255);
        return JUGADAS[buf[0] % 3];
    } else {
        r = Math.random();
    }
    return JUGADAS[Math.min(2, Math.floor(r * 3))];
}
