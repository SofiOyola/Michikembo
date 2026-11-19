// ============================================================
// AUDIO COMPARTIDO — Notación musical sencilla (módulo puro)
//
// Las melodías originales del proyecto se escriben como texto:
//   "C5:2 E5:2 .:4 G5:1"
// Cada símbolo es NOTA:PASOS. Un paso es una semicorchea (1/16)
// salvo que la composición diga otra cosa.
//   · NOTA  → letra A-G, alteración opcional (# o b) y octava: C5, F#4, Bb3
//   · "."   → silencio
//   · k s h → percusión (bombo, caja, platillo) para la voz de ruido
// Si se omite ":PASOS" vale 1 paso. La barra "|" separa compases y se ignora.
// ============================================================

const SEMITONOS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const PERCUSION = new Set(["k", "s", "h"]);

/** Convierte "A4" → 440 Hz (afinación estándar). Lanza error si la nota no es válida. */
export function frecuencia(nota) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(nota);
    if (!m) throw new Error(`Nota no válida: "${nota}"`);
    let midi = SEMITONOS[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) + 1) * 12;
    return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Convierte un patrón de texto en eventos.
 * @returns {{eventos: Array<{paso:number, pasos:number, tipo:"nota"|"percusion", valor:number|string}>, total:number}}
 *   paso = posición de inicio (en pasos), total = longitud del patrón en pasos.
 */
export function parsearPatron(texto) {
    const eventos = [];
    let paso = 0;
    for (const simbolo of texto.replace(/\|/g, " ").trim().split(/\s+/).filter(Boolean)) {
        const [nombre, crudo = "1"] = simbolo.split(":");
        const pasos = Number(crudo);
        if (!Number.isFinite(pasos) || pasos <= 0) throw new Error(`Duración no válida en "${simbolo}"`);
        if (nombre === ".") { /* silencio: solo avanza */ }
        else if (PERCUSION.has(nombre)) eventos.push({ paso, pasos, tipo: "percusion", valor: nombre });
        else eventos.push({ paso, pasos, tipo: "nota", valor: frecuencia(nombre) });
        paso += pasos;
    }
    return { eventos, total: paso };
}

/** Segundos que dura un paso de semicorchea a un tempo dado. */
export const pasoDeBpm = (bpm) => 60 / bpm / 4;

/**
 * Prepara una composición: parsea cada voz y calcula su duración.
 * Todas las voces deben medir lo mismo para que el bucle no se desfase.
 */
export function compilar(comp) {
    const voces = comp.voces.map((v) => ({ ...v, ...parsearPatron(v.patron) }));
    const total = Math.max(...voces.map((v) => v.total));
    const desfasadas = voces.filter((v) => v.total !== total);
    if (desfasadas.length) {
        throw new Error(`Las voces de "${comp.titulo}" no miden lo mismo (${voces.map((v) => v.total).join(" / ")} pasos).`);
    }
    return { ...comp, voces, total, duracion: total * comp.paso };
}
