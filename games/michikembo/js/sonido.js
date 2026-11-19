// ============================================================
// MICHIKEMBO — Audio del juego (música + efectos)
//
// Crea el gestor de audio compartido (compartido/audio/) con la
// música y los efectos ORIGINALES de Michikembo. Si pones tus propios
// archivos en assets/audio/michikembo/ y los declaras en pistas.json,
// el gestor los usa en lugar de la versión sintetizada (docs/AUDIO.md).
//
// Qué música corresponde a cada estado del juego se decide aquí,
// en musicaDeEstado(), para tenerlo en un único sitio.
// ============================================================

import { GestorAudio } from "../../../compartido/audio/gestor_audio.js";
import { MUSICA_MICHIKEMBO, EFECTOS_MICHIKEMBO } from "../../../compartido/audio/composiciones.js";
import { E } from "./maquina.js";

export const URL_PISTAS = new URL("../../../assets/audio/michikembo/pistas.json", import.meta.url).href;

/** Crea el gestor de audio de Michikembo y empieza a precargar los archivos opcionales. */
export function crearAudio() {
    const audio = new GestorAudio({ musica: MUSICA_MICHIKEMBO, efectos: EFECTOS_MICHIKEMBO, urlPistas: URL_PISTAS });
    audio.precargar();
    return audio;
}

// Menús: el tema del menú sigue sonando sin reiniciarse entre estas pantallas.
const ESTADOS_MENU = new Set([E.GAME_MENU, E.ASK_READY, E.SELECT_TARGET_WINS, E.CAMERA_PERMISSION, E.CAMERA_ERROR]);

/**
 * Música que debe sonar en un estado.
 *   · menús → menu_theme (bucle suave)
 *   · durante las rondas → sin música, para oír bien la cuenta y los efectos
 *   · fin de partida → final_win / final_lose (no se repiten)
 *   · pausa → se mantiene lo que sonaba (undefined = no cambiar)
 */
export function musicaDeEstado(estado) {
    if (ESTADOS_MENU.has(estado)) return "menu_theme";
    if (estado === E.GAME_OVER_WIN) return "final_win";
    if (estado === E.GAME_OVER_LOSE) return "final_lose";
    if (estado === E.PAUSED) return undefined;
    return null;
}

/** Efecto de cada resultado de ronda. */
export const EFECTO_RESULTADO = { gana: "round_win", pierde: "round_lose", empate: "round_tie", sin_jugada: "no_gesture" };
