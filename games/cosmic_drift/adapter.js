// ============================================================
// COSMIC DRIFT — ADAPTADOR PARA LA CONSOLA (adapter.js)
// Integra el juego EXISTENTE de github.com/SofiOyola/Cosmic-Drift
// sin modificar su código (plan §12). El repositorio se coloca en
// games/cosmic_drift/fuente/ y se monta en un <iframe> de la misma
// procedencia, lo que permite a la consola:
//   * escuchar Escape dentro del juego para volver al menú;
//   * cerrar su cámara y su música al salir (llamando a sus propios
//     módulos camera.js y audio.js) y descargar el documento.
// ============================================================

import { stopDocumentMedia } from "../../console/js/media-guard.js";

// Ruta del juego relativa a este archivo
const SOURCE = new URL("./fuente/", import.meta.url);
const INDEX = new URL("index.html", SOURCE);

/** Comprueba si el código de Cosmic Drift está copiado en fuente/. */
async function isInstalled() {
  try {
    const r = await fetch(INDEX, { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch { return false; }
}

/** Carga una imagen; resuelve null si no existe (preview con dibujo de respaldo). */
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export default {
  id: "cosmic_drift",
  title: "COSMIC DRIFT",
  description: "Pilota una nave con gestos de la mano: recoge orbes, dispara y activa el escudo.",
  status: "ready",
  badge: "CÁMARA",
  usesCamera: true,

  /** Preview animada con los gráficos del juego si están instalados. Nunca abre la cámara. */
  createPreview(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    let bg = null, ship = null, alive = true, t = 0;
    loadImage(new URL("assets/backgrounds/fondo_cosmico.png", SOURCE)).then((i) => { if (alive) bg = i; });
    loadImage(new URL("assets/ship/nave.png", SOURCE)).then((i) => { if (alive) ship = i; });
    const stars = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 20 + Math.random() * 80 }));
    const orbs = Array.from({ length: 4 }, (_, i) => ({ x: W + i * 130, y: 40 + Math.random() * (H - 80) }));

    return {
      frame(dt) {
        t += dt;
        // Fondo: imagen real desplazándose o estrellas de respaldo
        if (bg) {
          const ox = (t * 30) % W;
          ctx.drawImage(bg, -ox, 0, W, H);
          ctx.drawImage(bg, W - ox, 0, W, H);
        } else {
          ctx.fillStyle = "#07060d";
          ctx.fillRect(0, 0, W, H);
        }
        ctx.fillStyle = "#d9ccff";
        for (const s of stars) {
          s.x -= s.v * dt;
          if (s.x < 0) { s.x = W; s.y = Math.random() * H; }
          ctx.fillRect(s.x, s.y, 2, 2);
        }
        // Orbes
        for (const o of orbs) {
          o.x -= 90 * dt;
          if (o.x < -20) { o.x = W + 20; o.y = 40 + Math.random() * (H - 80); }
          ctx.fillStyle = "rgba(127, 209, 255, 0.35)";
          ctx.beginPath(); ctx.arc(o.x, o.y, 10, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#9fe3ff";
          ctx.beginPath(); ctx.arc(o.x, o.y, 5, 0, Math.PI * 2); ctx.fill();
        }
        // Nave flotando (simula el seguimiento de la mano)
        const sx = 90 + Math.sin(t * 0.9) * 30;
        const sy = H / 2 + Math.sin(t * 1.7) * (H * 0.3);
        if (ship) ctx.drawImage(ship, sx - 28, sy - 28, 56, 56);
        else {
          ctx.fillStyle = "#ef6f5e";
          ctx.beginPath(); ctx.moveTo(sx + 26, sy); ctx.lineTo(sx - 18, sy - 16); ctx.lineTo(sx - 18, sy + 16); ctx.fill();
        }
        if (!bg) {
          ctx.fillStyle = "#ffd166";
          ctx.font = "8px 'Press Start 2P', monospace";
          ctx.textAlign = "center";
          ctx.fillText("CÓDIGO NO INSTALADO EN games/cosmic_drift/fuente", W / 2, H - 12);
        }
      },
      dispose() { alive = false; }
    };
  },

  /** Monta el juego real en un iframe. */
  async mount(host, api) {
    if (!(await isInstalled())) {
      const box = document.createElement("div");
      box.className = "notice";
      box.innerHTML = `
        <h2>Falta el código de Cosmic Drift</h2>
        <p>Desde la carpeta raíz del proyecto ejecuta:</p>
        <p>Windows: <code>powershell -ExecutionPolicy Bypass -File scripts\\traer_cosmic_drift.ps1</code></p>
        <p>Git Bash / Linux / macOS: <code>bash scripts/traer_cosmic_drift.sh</code></p>
        <p class="muted">Luego recarga la consola. Pulsa Esc o ◀ Consola para volver.</p>`;
      host.appendChild(box);
      return { start() {}, pause() {}, resume() {}, destroy() { box.remove(); } };
    }

    const frame = document.createElement("iframe");
    frame.title = "Cosmic Drift";
    // Permisos que necesita el juego: cámara (MediaPipe), pantalla completa y audio
    frame.allow = "camera; fullscreen; autoplay";
    let frameWin = null;

    // Escape dentro del juego: si Cosmic Drift ya está en su menú o en Game Over,
    // volvemos a la consola. Si está jugando, su propio Escape lo lleva a su menú.
    const onFrameKey = (e) => {
      if (e.key !== "Escape") return;
      const g = frameWin && frameWin.cosmicDriftGame;
      const s = g ? g.gameState : "menu";
      if (s === "menu" || s === "game_over") api.exit();
    };

    await new Promise((resolve) => {
      frame.addEventListener("load", () => {
        frameWin = frame.contentWindow;
        try {
          // Capturar en fase de captura, antes del listener del propio juego
          frameWin.addEventListener("keydown", onFrameKey, true);
          api.guardWindow?.(frameWin);
        } catch (err) { console.warn("[cosmic_drift] iframe sin acceso de misma procedencia", err); }
        resolve();
      }, { once: true });
      frame.src = INDEX.href;
      host.appendChild(frame);
    });

    /** Llama a los módulos del propio juego dentro del iframe para cerrar cámara y música. */
    async function releaseInsideFrame() {
      if (!frameWin) return;
      try {
        const importIn = new frameWin.Function("u", "return import(u)");
        const [{ cameraManager }, { audioManager }] = await Promise.all([
          importIn(new URL("js/camera.js", SOURCE).href),
          importIn(new URL("js/audio.js", SOURCE).href)
        ]);
        cameraManager?.stopCamera?.();
        audioManager?.music?.pause?.();
      } catch (err) { console.warn("[cosmic_drift] no se pudo llamar a sus módulos", err); }
      stopDocumentMedia(frame.contentDocument);
    }

    return {
      start() { frame.focus(); },
      pause() { /* el juego gestiona su propia pausa */ },
      resume() { frame.focus(); },
      async destroy() {
        try { frameWin?.removeEventListener("keydown", onFrameKey, true); } catch { /* ignorar */ }
        await releaseInsideFrame();
        // Descargar el documento: detiene su bucle requestAnimationFrame y cualquier audio restante
        frame.src = "about:blank";
        frame.remove();
        frameWin = null;
      }
    };
  }
};
