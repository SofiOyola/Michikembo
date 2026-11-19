// ============================================================
// CONSOLA MICHIKEMBO — AUDIO DE LA CONSOLA (sfx.js)
// Usa el gestor de audio compartido (compartido/audio/) con la música
// y los efectos ORIGINALES de la consola. Un único AudioContext que se
// suspende mientras un juego está abierto, para no duplicar audio.
// Tus propios archivos van en assets/audio/console/ (ver docs/AUDIO.md).
// ============================================================

import { GestorAudio } from "../../compartido/audio/gestor_audio.js";
import { MUSICA_CONSOLA, EFECTOS_CONSOLA } from "../../compartido/audio/composiciones.js";

const audio = new GestorAudio({
  musica: MUSICA_CONSOLA,
  efectos: EFECTOS_CONSOLA,
  urlPistas: new URL("../../assets/audio/console/pistas.json", import.meta.url).href
});
audio.precargar();
let suspendTimer = 0;

/** Crea o reanuda el audio. Debe llamarse dentro de un gesto del usuario. */
export function unlockAudio() {
  clearTimeout(suspendTimer);
  audio.desbloquear();
  audio.reanudar();
}

/** Al entrar a un juego: fundido corto de la música y audio de la consola en pausa. */
export function suspendAudio() {
  audio.musica(null, { fundido: 0.15 });
  clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => audio.suspender(), 250);
}

export function isMuted() { return audio.preferencias.silencio; }
export function toggleMute() { return audio.alternarSilencio(); }

/** Música de la consola: solo suena en el selector de juegos. */
export const music = {
  start: () => audio.musica("bienvenida"),
  stop: () => audio.musica(null)
};

// Catálogo de efectos de la interfaz (los nombres cortos los usa main.js)
export const sfx = {
  move:   () => audio.efecto("navegar"),
  select: () => audio.efecto("abrir_juego"),
  back:   () => audio.efecto("volver"),
  boot:   () => audio.efecto("encender"),
  meow:   () => audio.efecto("maullido"),
  off:    () => audio.efecto("apagar")
};

// Para pruebas automatizadas y depuración
export const audioConsola = audio;
