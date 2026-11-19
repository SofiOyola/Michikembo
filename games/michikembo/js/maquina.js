// ============================================================
// MICHIKEMBO — Máquina de estados de la partida (módulo puro, sin DOM)
//
// Un único estado decide qué botones funcionan, cuándo se escucha la
// cámara, qué suena y cuándo se congela el resultado (plan §6.6).
// El tiempo se pasa desde fuera (performance.now() en el navegador o un
// reloj falso en las pruebas): no hay setTimeout que queden vivos al salir.
//
// Regla de partida (plan §6.2): la META es el número de VICTORIAS que hay que
// conseguir ("Primero en ganar N"). Los empates y las rondas sin gesto válido
// no suman a nadie y no acercan a la meta.
// ============================================================

import { resolverRonda, elegirJugadaMichi } from "./reglas.js";
import { Estabilizador } from "./estabilizador.js";

export const E = Object.freeze({
    GAME_MENU: "GAME_MENU",
    ASK_READY: "ASK_READY",
    SELECT_TARGET_WINS: "SELECT_TARGET_WINS",
    CAMERA_PERMISSION: "CAMERA_PERMISSION",
    ROUND_PREPARE: "ROUND_PREPARE",
    COUNTDOWN_3: "COUNTDOWN_3",
    COUNTDOWN_2: "COUNTDOWN_2",
    COUNTDOWN_1_REVEAL_CAT: "COUNTDOWN_1_REVEAL_CAT",
    CAPTURE_PLAYER_GESTURE: "CAPTURE_PLAYER_GESTURE",
    EVALUATE_ROUND: "EVALUATE_ROUND",
    ROUND_WIN_PLAYER: "ROUND_WIN_PLAYER",
    ROUND_WIN_CAT: "ROUND_WIN_CAT",
    ROUND_TIE: "ROUND_TIE",
    ROUND_INVALID_GESTURE: "ROUND_INVALID_GESTURE",
    WAIT_NEXT_ROUND: "WAIT_NEXT_ROUND",
    GAME_OVER_WIN: "GAME_OVER_WIN",
    GAME_OVER_LOSE: "GAME_OVER_LOSE",
    CAMERA_ERROR: "CAMERA_ERROR",
    PAUSED: "PAUSED",
    RETURN_TO_CONSOLE: "RETURN_TO_CONSOLE",
});

/** Metas que ofrece la interfaz. elegirMeta() acepta cualquier entero de 1 a META_MAXIMA. */
export const METAS = Object.freeze([1, 3, 5, 7]);
export const META_MAXIMA = 15;

/** Estados en los que la cámara está abierta (aunque no siempre puntúe). */
export const ESTADOS_CON_CAMARA = Object.freeze([
    E.CAMERA_PERMISSION, E.ROUND_PREPARE, E.COUNTDOWN_3, E.COUNTDOWN_2, E.COUNTDOWN_1_REVEAL_CAT,
    E.CAPTURE_PLAYER_GESTURE, E.EVALUATE_ROUND, E.ROUND_WIN_PLAYER, E.ROUND_WIN_CAT, E.ROUND_TIE,
    E.ROUND_INVALID_GESTURE, E.WAIT_NEXT_ROUND, E.PAUSED,
]);

/** Estados en los que los fotogramas CUENTAN para la jugada (ventana tras el "1"). */
export const ESTADOS_CAPTURA = Object.freeze([E.COUNTDOWN_1_REVEAL_CAT, E.CAPTURE_PLAYER_GESTURE]);

const RESULTADOS_RONDA = Object.freeze({
    gana: E.ROUND_WIN_PLAYER, pierde: E.ROUND_WIN_CAT, empate: E.ROUND_TIE, sin_jugada: E.ROUND_INVALID_GESTURE,
});
const ESTADOS_RESULTADO = Object.freeze(Object.values(RESULTADOS_RONDA));
const ESTADOS_PARTIDA = Object.freeze([
    E.ROUND_PREPARE, E.COUNTDOWN_3, E.COUNTDOWN_2, E.COUNTDOWN_1_REVEAL_CAT, E.CAPTURE_PLAYER_GESTURE,
    E.EVALUATE_ROUND, ...ESTADOS_RESULTADO, E.WAIT_NEXT_ROUND,
]);

export class Partida {
    /**
     * @param {object} config  ver config.js
     * @param {{aleatorio?: () => number, alCambiar?: (nuevo:string, anterior:string, p:Partida) => void}} [opciones]
     */
    constructor(config, opciones = {}) {
        this.c = config;
        this.aleatorio = opciones.aleatorio;
        this.alCambiar = opciones.alCambiar || (() => {});
        this.estado = E.GAME_MENU;
        this.desde = 0;
        this.meta = config.META_POR_DEFECTO ?? 3;
        this.marcador = { jugador: 0, michi: 0 };
        this.ronda = 0;
        this.historial = [];
        this.error = null;
        this.pausa = null;              // { estado, desde, en } mientras está en PAUSED
        this._limpiarRonda();
    }

    // ------------------------------------------------------------ utilidades
    _limpiarRonda() {
        this.jugadaMichi = null;
        this.jugadaJugador = null;
        this.motivoCaptura = null;
        this.resultado = null;
        this.puntuada = false;
        this.ultimaDecision = null;
        this.estabilizador = new Estabilizador({ fotogramasEstables: this.c.FOTOGRAMAS_ESTABLES });
    }

    _ir(nuevo, t) {
        const anterior = this.estado;
        this.estado = nuevo;
        this.desde = t;
        this.alCambiar(nuevo, anterior, this);
    }

    /** Milisegundos transcurridos en el estado actual. */
    transcurrido(t) {
        return t - this.desde;
    }

    get pausada() {
        return this.estado === E.PAUSED;
    }

    /** ¿Debe estar la cámara encendida en este estado? */
    necesitaCamara() {
        return ESTADOS_CON_CAMARA.includes(this.estado);
    }

    /** ¿Está abierta la ventana de captura? El bucle de detección lo consulta. */
    capturando() {
        return ESTADOS_CAPTURA.includes(this.estado);
    }

    /** ¿La partida está en curso (para pausar, abandonar…)? */
    enPartida() {
        return ESTADOS_PARTIDA.includes(this.estado);
    }

    /** Fracción 0..1 consumida de la ventana de captura (que empieza en el "1"). */
    progresoCaptura(t) {
        if (this.estado === E.COUNTDOWN_1_REVEAL_CAT) return Math.min(1, this.transcurrido(t) / this.c.VENTANA_CAPTURA);
        if (this.estado === E.CAPTURE_PLAYER_GESTURE) {
            return Math.min(1, (this.c.DURACION_UNO + this.transcurrido(t)) / this.c.VENTANA_CAPTURA);
        }
        return 0;
    }

    /** Número visible de la cuenta regresiva o null. */
    numeroCuenta() {
        return { [E.COUNTDOWN_3]: 3, [E.COUNTDOWN_2]: 2, [E.COUNTDOWN_1_REVEAL_CAT]: 1 }[this.estado] ?? null;
    }

    // ------------------------------------------------------------ acciones del jugador
    // Cada acción comprueba el estado: si no corresponde, se ignora y devuelve false.

    /** Botón JUGAR del menú de Michikembo. */
    jugar(t) {
        if (this.estado !== E.GAME_MENU) return false;
        this._ir(E.ASK_READY, t);
        return true;
    }

    /** «¿Estás listo?» → SÍ. */
    listoSi(t) {
        if (this.estado !== E.ASK_READY) return false;
        this._ir(E.SELECT_TARGET_WINS, t);
        return true;
    }

    /** «¿Estás listo?» → NO: vuelve al menú sin empezar nada. */
    listoNo(t) {
        if (this.estado !== E.ASK_READY) return false;
        this._ir(E.GAME_MENU, t);
        return true;
    }

    /** Elige la meta ("primero en ganar N") y pasa a preparar la cámara. */
    elegirMeta(n, t) {
        if (this.estado !== E.SELECT_TARGET_WINS) return false;
        if (!Number.isInteger(n) || n < 1 || n > META_MAXIMA) return false;
        this.meta = n;
        this._ir(E.CAMERA_PERMISSION, t);
        return true;
    }

    /** Volver atrás desde la elección de meta. */
    volverDeMeta(t) {
        if (this.estado !== E.SELECT_TARGET_WINS) return false;
        this._ir(E.ASK_READY, t);
        return true;
    }

    /**
     * La interfaz confirma que cámara y detector están listos y el jugador
     * pulsó EMPEZAR. Reinicia el marcador y arranca la primera ronda.
     */
    empezarPartida(t) {
        if (this.estado !== E.CAMERA_PERMISSION) return false;
        this.marcador = { jugador: 0, michi: 0 };
        this.ronda = 0;
        this.historial = [];
        this.error = null;
        this._iniciarRonda(t);
        return true;
    }

    /** Fallo de cámara o de modelo (permiso denegado, cámara ocupada, modelo corrupto…). */
    fallar(mensaje, t, tipo = "camara") {
        if (this.estado === E.RETURN_TO_CONSOLE) return false;
        this.error = { mensaje, tipo };
        this.pausa = null;
        this._ir(E.CAMERA_ERROR, t);
        return true;
    }

    /** Desde el error: reintentar abrir la cámara conservando la meta. */
    reintentarCamara(t) {
        if (this.estado !== E.CAMERA_ERROR) return false;
        this.error = null;
        this._ir(E.CAMERA_PERMISSION, t);
        return true;
    }

    /** Saltar la pausa de resultado o de "siguiente ronda" (opción accesible). */
    continuar(t) {
        if (ESTADOS_RESULTADO.includes(this.estado)) { this._trasResultado(t); return true; }
        if (this.estado === E.WAIT_NEXT_ROUND) { this._iniciarRonda(t); return true; }
        return false;
    }

    /** Fin de partida → VOLVER A JUGAR con la misma meta. */
    revancha(t) {
        if (![E.GAME_OVER_WIN, E.GAME_OVER_LOSE].includes(this.estado)) return false;
        this._ir(E.CAMERA_PERMISSION, t);
        return true;
    }

    /** Fin de partida → CAMBIAR META. */
    cambiarMeta(t) {
        if (![E.GAME_OVER_WIN, E.GAME_OVER_LOSE].includes(this.estado)) return false;
        this._ir(E.SELECT_TARGET_WINS, t);
        return true;
    }

    /** Pausa: congela el reloj del estado actual. */
    pausar(t) {
        if (!this.enPartida()) return false;
        this.pausa = { estado: this.estado, desde: this.desde, en: t };
        this._ir(E.PAUSED, t);
        return true;
    }

    /** Reanuda en el mismo estado, desplazando su inicio lo que duró la pausa. */
    reanudar(t) {
        if (!this.pausada || !this.pausa) return false;
        const { estado, desde, en } = this.pausa;
        this.pausa = null;
        const anterior = this.estado;
        this.estado = estado;
        this.desde = desde + (t - en);
        this.alCambiar(estado, anterior, this);
        return true;
    }

    /** Abandonar la partida y volver al menú de Michikembo (marcador a cero). */
    volverAlMenu(t) {
        if (this.estado === E.RETURN_TO_CONSOLE) return false;
        this.pausa = null;
        this.error = null;
        this.marcador = { jugador: 0, michi: 0 };
        this.ronda = 0;
        this._limpiarRonda();
        this._ir(E.GAME_MENU, t);
        return true;
    }

    /** Salir a la consola: estado final, la interfaz libera cámara, audio y bucles. */
    salirAConsola(t) {
        this.pausa = null;
        this._ir(E.RETURN_TO_CONSOLE, t);
        return true;
    }

    // ------------------------------------------------------------ captura
    /**
     * Registra la decisión de un fotograma. Solo se acepta si pertenece a la
     * ronda actual y la ventana de captura está abierta. Así una inferencia
     * lenta de la ronda anterior nunca puede puntuar en la siguiente, y un
     * gesto posterior al cierre no cambia la ronda ya resuelta.
     */
    registrarDecision(ronda, decision) {
        if (ronda !== this.ronda || !this.capturando()) return false;
        this.ultimaDecision = decision;
        return this.estabilizador.agregar(decision);
    }

    // ------------------------------------------------------------ reloj
    _iniciarRonda(t) {
        this.ronda += 1;
        this._limpiarRonda();
        // Michi elige y BLOQUEA su jugada ANTES de observar cualquier gesto del jugador.
        this.jugadaMichi = elegirJugadaMichi(this.aleatorio);
        this._ir(E.ROUND_PREPARE, t);
    }

    _trasResultado(t) {
        const m = this.meta;
        if (this.marcador.jugador >= m) this._ir(E.GAME_OVER_WIN, t);
        else if (this.marcador.michi >= m) this._ir(E.GAME_OVER_LOSE, t);
        else this._ir(E.WAIT_NEXT_ROUND, t);
    }

    /** Avanza la máquina. Llamar en cada fotograma de animación. */
    actualizar(t) {
        const dt = this.transcurrido(t);
        const c = this.c;
        switch (this.estado) {
            case E.ROUND_PREPARE:
                if (dt >= (this.ronda === 1 ? c.DURACION_PREPARAR_PRIMERA : c.DURACION_PREPARAR)) this._ir(E.COUNTDOWN_3, t);
                break;
            case E.COUNTDOWN_3:
                if (dt >= c.DURACION_NUMERO) this._ir(E.COUNTDOWN_2, t);
                break;
            case E.COUNTDOWN_2:
                if (dt >= c.DURACION_NUMERO) this._ir(E.COUNTDOWN_1_REVEAL_CAT, t);
                break;
            case E.COUNTDOWN_1_REVEAL_CAT:
                if (dt >= c.DURACION_UNO) this._ir(E.CAPTURE_PLAYER_GESTURE, t);
                break;
            case E.CAPTURE_PLAYER_GESTURE:
                if (c.DURACION_UNO + dt >= c.VENTANA_CAPTURA) {
                    const cierre = this.estabilizador.cerrar(c.MINIMO_FOTOGRAMAS);
                    this.jugadaJugador = cierre.jugada;
                    this.motivoCaptura = cierre.motivo;
                    this._ir(E.EVALUATE_ROUND, t);
                }
                break;
            case E.EVALUATE_ROUND:
                if (dt >= c.DURACION_EVALUAR) {
                    this._puntuar();
                    this._ir(RESULTADOS_RONDA[this.resultado], t);
                }
                break;
            case E.ROUND_WIN_PLAYER:
            case E.ROUND_WIN_CAT:
            case E.ROUND_TIE:
            case E.ROUND_INVALID_GESTURE:
                if (dt >= c.DURACION_RESULTADO) this._trasResultado(t);
                break;
            case E.WAIT_NEXT_ROUND:
                if (dt >= c.DURACION_ESPERA) this._iniciarRonda(t);
                break;
            default:
                break; // los demás estados esperan una acción del jugador
        }
    }

    /** Actualiza el marcador UNA sola vez por ronda. */
    _puntuar() {
        if (this.puntuada) return;
        this.puntuada = true;
        this.resultado = resolverRonda(this.jugadaJugador, this.jugadaMichi);
        if (this.resultado === "gana") this.marcador.jugador += 1;
        if (this.resultado === "pierde") this.marcador.michi += 1;
        this.historial.push({
            ronda: this.ronda,
            jugador: this.jugadaJugador,
            michi: this.jugadaMichi,
            resultado: this.resultado,
            motivo: this.motivoCaptura,
            marcador: { ...this.marcador },
        });
    }
}

/**
 * Animación lógica de Michi para cada momento de la partida.
 * Animaciones disponibles (assets/michi/animations.json): idle, piedra, papel, tijera, feliz y triste.
 */
export function animacionMichi(p) {
    const estado = p.pausada ? p.pausa?.estado : p.estado;
    switch (estado) {
        case E.COUNTDOWN_1_REVEAL_CAT:
        case E.CAPTURE_PLAYER_GESTURE:
        case E.EVALUATE_ROUND:
        case E.ROUND_TIE:
            return p.jugadaMichi || "idle";                    // Michi muestra su jugada desde el "1"
        case E.ROUND_WIN_PLAYER:
        case E.GAME_OVER_WIN:
            return "triste";                                    // ganó el jugador → Michi triste
        case E.ROUND_WIN_CAT:
        case E.GAME_OVER_LOSE:
            return "feliz";                                     // ganó Michi
        default:
            return "idle";                                      // menús, cuenta 3-2, sin gesto, errores
    }
}
