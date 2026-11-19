// ============================================================
// MICHIKEMBO — Detector SIMULADO (sustituye al modelo mientras no exista)
//
// Cumple exactamente el mismo contrato que tendrá el detector real:
//   await detector.iniciar()
//   detector.nuevaRonda()
//   await detector.detectar(video) → [{ clase, confianza, caja:{x,y,w,h} }]
// con clase 0=Paper, 1=Rock, 2=Scissors y la caja normalizada (0..1).
//
// Modos:
//   "manual"    → el jugador indica su gesto con las teclas 1/2/3 o los botones.
//                 El detector lo "ve" en cada fotograma con confianza realista.
//   "aleatorio" → cada ronda se elige un escenario: gesto estable, sin mano,
//                 gesto inestable o dos manos distintas. Sirve para probar
//                 todos los caminos del juego sin tocar nada.
// ============================================================

import { CLASES_MODELO } from "../reglas.js";

const CLASE_DE = { papel: 0, piedra: 1, tijera: 2 };

export class DetectorSimulado {
    constructor(modo = "manual") {
        this.nombre = "simulado";
        this.modo = modo;
        this.manoManual = null;      // jugada que el jugador "muestra" en modo manual
        this.escenario = null;
        this.inicioRonda = 0;
    }

    async iniciar() {
        // Simula el tiempo de carga de un modelo sin bloquear la interfaz
        await new Promise((r) => setTimeout(r, 250));
        return true;
    }

    /** Modo manual: fija la mano simulada ("piedra" | "papel" | "tijera" | null). */
    mostrarMano(jugada) {
        this.manoManual = jugada;
    }

    /** Se llama al abrir cada ventana de captura. */
    nuevaRonda() {
        this.inicioRonda = performance.now();
        if (this.modo !== "aleatorio") return;
        const r = Math.random();
        const jugada = CLASES_MODELO[Math.floor(Math.random() * 3)];
        if (r < 0.7) this.escenario = { tipo: "estable", jugada, retraso: 150 + Math.random() * 600 };
        else if (r < 0.82) this.escenario = { tipo: "sin_mano" };
        else if (r < 0.92) this.escenario = { tipo: "inestable" };
        else this.escenario = { tipo: "dos_manos" };
    }

    /** Devuelve las detecciones del fotograma actual. El vídeo no se analiza. */
    async detectar(/* video */) {
        // Latencia simulada de inferencia (8–20 ms)
        await new Promise((r) => setTimeout(r, 8 + Math.random() * 12));
        const t = performance.now() - this.inicioRonda;

        if (this.modo === "manual") {
            if (!this.manoManual || Math.random() < 0.04) return []; // 4 % de fotogramas perdidos
            return [this._caja(this.manoManual, 0.72 + Math.random() * 0.25, 0.5)];
        }

        const e = this.escenario;
        if (!e || e.tipo === "sin_mano") return Math.random() < 0.1 ? [this._caja("piedra", 0.3, 0.5)] : [];
        if (e.tipo === "estable") return t < e.retraso ? [] : [this._caja(e.jugada, 0.7 + Math.random() * 0.28, 0.5)];
        if (e.tipo === "inestable") {
            const j = CLASES_MODELO[Math.floor(Math.random() * 3)];
            return Math.random() < 0.3 ? [] : [this._caja(j, 0.62 + Math.random() * 0.3, 0.5)];
        }
        // Dos manos con gestos diferentes → el juego debe tratarlo como jugada ambigua
        return [this._caja("piedra", 0.85, 0.3), this._caja("papel", 0.82, 0.7)];
    }

    _caja(jugada, confianza, cx) {
        const w = 0.28, h = 0.4;
        const j = (Math.random() - 0.5) * 0.02; // pequeño temblor de la caja
        return { clase: CLASE_DE[jugada], confianza, caja: { x: cx - w / 2 + j, y: 0.3 + j, w, h } };
    }

    liberar() {}
}
