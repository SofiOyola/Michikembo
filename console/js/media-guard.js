// ============================================================
// CONSOLA MICHIKEMBO — GUARDIÁN DE CÁMARA Y AUDIO (media-guard.js)
// Registra cada stream de getUserMedia abierto desde la consola
// y garantiza que se cierre al salir de un juego. Así nunca
// quedan cámaras abiertas ni dos juegos con la cámara a la vez.
// ============================================================

const openStreams = new Set();

/**
 * Envuelve getUserMedia de una ventana (la consola o un iframe de la
 * misma procedencia) para registrar los streams que se abran.
 */
export function guardWindow(win) {
  const md = win.navigator && win.navigator.mediaDevices;
  if (!md || !md.getUserMedia || md.__mkGuarded) return;
  const original = md.getUserMedia.bind(md);
  md.getUserMedia = async (constraints) => {
    const stream = await original(constraints);
    openStreams.add(stream);
    return stream;
  };
  md.__mkGuarded = true;
}

/** Detiene las pistas de un documento: <video>/<audio> con srcObject y medios en reproducción. */
export function stopDocumentMedia(doc) {
  if (!doc) return;
  for (const el of doc.querySelectorAll("video, audio")) {
    try {
      el.pause();
      const src = el.srcObject;
      if (src && src.getTracks) src.getTracks().forEach((t) => t.stop());
      el.srcObject = null;
    } catch { /* elemento ya liberado */ }
  }
}

/** Cierra todos los streams registrados. Devuelve cuántas pistas seguían vivas. */
export function stopAllStreams() {
  let live = 0;
  for (const stream of openStreams) {
    for (const track of stream.getTracks()) {
      if (track.readyState === "live") live++;
      track.stop();
    }
  }
  openStreams.clear();
  return live;
}

/** Número de pistas de cámara/micrófono aún activas (para pruebas y depuración). */
export function liveTrackCount() {
  let n = 0;
  for (const s of openStreams) n += s.getTracks().filter((t) => t.readyState === "live").length;
  return n;
}
