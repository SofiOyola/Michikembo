// ============================================================
// MICHIKEMBO — ADAPTADOR PARA LA CONSOLA (adapter.js)
// ESTADO: JUGABLE CON EL MODELO E3c (ONNX, experimental) o con detector simulado.
// El juego completo vive en games/michikembo/index.html (lógica en
// js/reglas.js, estabilizador.js, maquina.js; detector en js/detector/).
// Este adaptador:
//   * dibuja una preview ilustrativa en el canvas de la consola
//     (sin cámara, sin modelo, sin audio);
//   * monta el juego real en un <iframe> de la misma procedencia;
//   * escucha su mensaje {origen:"michikembo", tipo:"salir"} para volver
//     a la consola y le envía "pausar" / "reanudar" / "detener".
// El modelo activo está en assets/models/michikembo/current/ (ver
// docs/COMO_CAMBIAR_MODELO.md). La preview nunca usa cámara ni modelo.
// ============================================================

import { stopDocumentMedia } from "../../console/js/media-guard.js";

const INDEX = new URL("./index.html", import.meta.url);

const GESTURES = ["PIEDRA", "PAPEL", "TIJERA"];
const ICON = { PIEDRA: "✊", PAPEL: "✋", TIJERA: "✌" };
// Reglas oficiales del plan: Piedra vence Tijera, Tijera vence Papel, Papel vence Piedra
const BEATS = { PIEDRA: "TIJERA", TIJERA: "PAPEL", PAPEL: "PIEDRA" };

export default {
  id: "michikembo",
  title: "MICHIKEMBO",
  description: "Piedra, papel o tijera con tu mano frente a la cámara contra Michi. Eliges la meta: primero en ganar 1, 3, 5 o 7.",
  status: "ready",
  badge: "MODELO E3c",
  usesCamera: true,

  /**
   * Preview ilustrativa: ronda simulada 3-2-1 con los GIF reales de Michi,
   * jugadas al azar y marcador "primero en ganar 3". SIN cámara, SIN modelo y SIN audio.
   */
  createPreview(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    // GIF de Michi (los dibuja el navegador animados al usar drawImage)
    const gif = {};
    for (const [k, f] of Object.entries({ idle: "idle", PIEDRA: "piedra", PAPEL: "papel", TIJERA: "tijera", feliz: "happy", triste: "sad" })) {
      const img = new Image();
      img.src = new URL(`../../assets/michi/sprites/${f}.gif`, import.meta.url).href;
      gif[k] = img;
    }
    let t = 0, cycle = -1, round = null;
    const score = { tu: 0, michi: 0 };
    const META = 3;

    function newRound() {
      // Michi elige ANTES de ver la jugada (igual que en el juego real)
      return { michi: GESTURES[Math.floor(Math.random() * 3)], tu: GESTURES[Math.floor(Math.random() * 3)], scored: false, msg: "" };
    }
    const txt = (s, x, y, size, color, align = "center") => {
      ctx.font = `${size}px 'Press Start 2P', monospace`;
      ctx.textAlign = align;
      ctx.fillStyle = color;
      ctx.fillText(s, x, y);
    };
    const box = (x, y, w, h, fill) => {
      ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#b79cff"; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    };

    return {
      frame(dt) {
        t += dt;
        // Ciclo de 5 s: 0-3 cuenta 3-2-1, 3-5 revelado y resultado
        const c = Math.floor(t / 5), phase = t % 5;
        if (c !== cycle) {
          cycle = c;
          if (score.tu >= META || score.michi >= META) { score.tu = 0; score.michi = 0; }
          round = newRound();
        }
        ctx.fillStyle = "#2a1452"; ctx.fillRect(0, 0, W, H);
        // Marcadores encima de cada casilla: Michi a la izquierda, jugador a la derecha
        txt(`MICHI ${score.michi}`, 105, 26, 11, "#d7c4ff");
        txt(`TÚ ${score.tu}`, W - 105, 26, 11, "#ff8fb0");
        box(30, 38, 150, 150, "#3b1f74");
        box(W - 180, 38, 150, 150, "#3b1f74");
        // Michi: idle durante la cuenta, su jugada desde el "1"
        let michiImg = gif.idle;
        if (phase >= 2) michiImg = gif[round.michi];
        if (phase >= 3.4 && round.msg === "GANA MICHI") michiImg = gif.feliz;
        if (phase >= 3.4 && round.msg === "¡GANAS!") michiImg = gif.triste;
        if (michiImg.complete && michiImg.naturalWidth) {
          ctx.imageSmoothingEnabled = false;
          const s = michiImg.naturalHeight; // recorte cuadrado centrado del GIF 480x270
          ctx.drawImage(michiImg, (michiImg.naturalWidth - s) / 2, 0, s, s, 33, 41, 144, 144);
        } else txt("=^.^=", 105, 120, 14, "#efe6ff");
        // Jugador (simulado, sin cámara)
        ctx.font = "56px serif"; ctx.textAlign = "center"; ctx.fillStyle = "#fff";
        if (phase >= 3) ctx.fillText(ICON[round.tu], W - 105, 134);
        else txt("?", W - 105, 122, 24, "#b79cff");
        // Centro: cuenta o resultado
        if (phase < 3) {
          txt(String(3 - Math.floor(phase)), W / 2, 128, 40, "#ff6b9a");
        } else {
          if (!round.scored) {
            round.msg = "EMPATE";
            if (BEATS[round.tu] === round.michi) { round.msg = "¡GANAS!"; score.tu++; }
            else if (BEATS[round.michi] === round.tu) { round.msg = "GANA MICHI"; score.michi++; }
            round.scored = true;
          }
          txt("VS", W / 2, 118, 10, "#b79cff");
        }
        txt(phase >= 3 ? round.msg : "PRIMERO EN GANAR 3", W / 2, 216, phase >= 3 ? 14 : 9, phase >= 3 ? "#ffd166" : "#d7c4ff");
        txt("VISTA PREVIA · SIN CÁMARA", W / 2, H - 14, 8, "#8f78c8");
      },
      dispose() {}
    };
  },

  /** Monta el juego real en un iframe (la cámara solo se abre dentro de la partida). */
  async mount(host, api) {
    const frame = document.createElement("iframe");
    frame.title = "Michikembo";
    frame.allow = "camera; fullscreen; autoplay";
    let frameWin = null;

    // El juego avisa con postMessage cuando la persona elige "Salir" (o Esc en su menú)
    const onMessage = (ev) => {
      if (!frameWin || ev.source !== frameWin) return;
      if (ev.data?.origen === "michikembo" && ev.data.tipo === "salir") api.exit();
    };
    window.addEventListener("message", onMessage);

    await new Promise((resolve) => {
      frame.addEventListener("load", () => {
        frameWin = frame.contentWindow;
        try { api.guardWindow?.(frameWin); } catch { /* otra procedencia */ }
        resolve();
      }, { once: true });
      frame.src = INDEX.href;
      host.appendChild(frame);
    });

    const send = (tipo) => { try { frameWin?.postMessage({ tipo }, "*"); } catch { /* cerrado */ } };

    return {
      start() { frame.focus(); frameWin?.focus(); },
      pause() { send("pausar"); },
      resume() { send("reanudar"); frame.focus(); },
      async destroy() {
        window.removeEventListener("message", onMessage);
        send("detener");                               // el juego libera cámara, detector y audio
        try { stopDocumentMedia(frame.contentDocument); } catch { /* ignorar */ }
        frame.src = "about:blank";                     // descarga el documento y su bucle
        frame.remove();
        frameWin = null;
      }
    };
  }
};
