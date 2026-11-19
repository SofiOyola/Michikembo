// ============================================================
// MICHIKEMBO — Decisión por fotograma y filtro temporal de gestos
// Módulo puro (sin DOM). La jugada del jugador NUNCA se decide con un
// único fotograma aislado.
//
// Reglas (plan §6.3 y §7):
//   * Cada fotograma se convierte en un ESTADO: piedra, papel, tijera,
//     "nada" (sin mano) o "ambigua" (manos con gestos distintos).
//   * "nada" es un estado real: rompe las rachas y cuenta como fotograma.
//   * Un estado es ESTABLE cuando se repite K fotogramas seguidos.
//   * Al cerrar la ventana se confirma el ÚLTIMO GESTO ESTABLE observado.
//     Un salto aislado (p. ej. nada → tijera durante 1–2 fotogramas) no cuenta.
//   * Si lo último estable fue "ambigua" (dos manos distintas), la ronda es AMBIGUA.
//   * Tras cerrar, el resultado queda bloqueado: nuevos fotogramas no lo cambian.
// ============================================================

import { CLASES_MODELO } from "./reglas.js";

/**
 * Convierte las detecciones de UN fotograma en una decisión.
 *   - Sin detecciones sobre el umbral     → { jugada: null, motivo: "sin_mano" }
 *   - Todas las manos con la misma jugada → esa jugada
 *   - Manos con jugadas distintas         → { jugada: null, motivo: "ambigua" }
 * @param {Array<{clase:number, confianza:number}>} detecciones  clase en índices del juego
 * @param {number} umbral confianza mínima
 */
export function decidirFotograma(detecciones, umbral) {
    const validas = (detecciones || []).filter((d) => d.confianza >= umbral && CLASES_MODELO[d.clase]);
    if (validas.length === 0) return { jugada: null, motivo: "sin_mano", confianza: 0, manos: 0 };
    const jugadas = new Set(validas.map((d) => CLASES_MODELO[d.clase]));
    if (jugadas.size > 1) return { jugada: null, motivo: "ambigua", confianza: 0, manos: validas.length };
    const confianza = Math.max(...validas.map((d) => d.confianza));
    return { jugada: [...jugadas][0], motivo: "ok", confianza, manos: validas.length };
}

/** Estado temporal de un fotograma: jugada, "nada" o "ambigua". */
function estadoDe(decision) {
    if (decision.jugada) return decision.jugada;
    return decision.motivo === "ambigua" ? "ambigua" : "nada";
}

/**
 * Acumula las decisiones de UNA ronda. Se crea uno nuevo por ronda, así un
 * resultado anterior no puede puntuar en otra.
 */
export class Estabilizador {
    /** @param {{fotogramasEstables:number}} opciones  K = fotogramas seguidos para considerar estable */
    constructor({ fotogramasEstables }) {
        this.k = Math.max(1, fotogramasEstables);
        this.racha = { estado: null, n: 0 };
        this.ultimoGestoEstable = null;   // última jugada que llegó a K seguidos
        this.ultimoEstable = null;        // último estado (incluye nada/ambigua) que llegó a K
        this.conteo = { piedra: 0, papel: 0, tijera: 0, nada: 0, ambigua: 0 };
        this.total = 0;
        this.resultado = null;            // se rellena al cerrar y ya no cambia
    }

    get cerrado() {
        return this.resultado !== null;
    }

    /** Añade la decisión de un fotograma. Ignorado si la ventana ya se cerró. */
    agregar(decision) {
        if (this.cerrado) return false;
        const e = estadoDe(decision);
        this.total += 1;
        this.conteo[e] += 1;
        if (this.racha.estado === e) this.racha.n += 1;
        else this.racha = { estado: e, n: 1 };
        if (this.racha.n === this.k) {
            this.ultimoEstable = e;
            if (CLASES_MODELO.includes(e)) this.ultimoGestoEstable = e;
        }
        return true;
    }

    /** Progreso 0..1 de la racha actual de un GESTO (barra de estabilidad). */
    progreso() {
        if (!CLASES_MODELO.includes(this.racha.estado)) return 0;
        return Math.min(1, this.racha.n / this.k);
    }

    /** Gesto que se confirmaría si la ventana cerrara ahora (o null). */
    candidata() {
        return this.resultado?.jugada ?? this.ultimoGestoEstable;
    }

    /**
     * Cierra la ventana de captura y BLOQUEA el resultado.
     * @param {number} [minimoFotogramas]  si se analizaron menos, el resultado es "insuficiente"
     * @returns {{jugada: string|null, motivo: "estable"|"sin_mano"|"ambigua"|"inestable"|"insuficiente"}}
     */
    cerrar(minimoFotogramas = this.k) {
        if (this.cerrado) return this.resultado;
        let r;
        if (this.ultimoEstable === "ambigua") r = { jugada: null, motivo: "ambigua" };
        else if (this.ultimoGestoEstable) r = { jugada: this.ultimoGestoEstable, motivo: "estable" };
        else if (this.total < minimoFotogramas) r = { jugada: null, motivo: "insuficiente" };
        else if (this.conteo.ambigua >= this.k) r = { jugada: null, motivo: "ambigua" };
        else if (this.conteo.piedra + this.conteo.papel + this.conteo.tijera > 0) r = { jugada: null, motivo: "inestable" };
        else r = { jugada: null, motivo: "sin_mano" };
        this.resultado = Object.freeze(r);
        return this.resultado;
    }
}
