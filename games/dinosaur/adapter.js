// ============================================================
// DINO CORREDOR — ADAPTADOR PARA LA CONSOLA (adapter.js)
// Conecta el motor dino.js con el contrato de cartuchos
// (ver console/js/catalog.js). No usa cámara ni modelo.
// ============================================================

import { DinoRun, DINO_SIZE } from "./dino.js";

export default {
  id: "dinosaur",
  title: "DINO CORREDOR",
  description: "Salta cactus y esquiva meteoritos en el desierto nocturno. Espacio salta, abajo agacha.",
  status: "ready",
  badge: "LISTO",
  usesCamera: false,

  /** Preview: el mismo motor en modo demo con piloto automático. */
  createPreview(canvas) {
    const game = new DinoRun(canvas, { demo: true });
    let crashedFor = 0;
    return {
      frame(dt) {
        game.update(dt);
        // En la demo, tras chocar se reinicia sola al cabo de 1 s
        if (game.state === "over") {
          crashedFor += dt;
          if (crashedFor > 1) { game.reset(); game.state = "running"; crashedFor = 0; }
        }
        game.render();
      },
      dispose() { /* sin recursos externos */ }
    };
  },

  /** Monta el juego en el escenario expandido. */
  async mount(host, api) {
    const canvas = document.createElement("canvas");
    canvas.width = DINO_SIZE.W;
    canvas.height = DINO_SIZE.H;
    canvas.setAttribute("aria-label", "Dino Corredor. Espacio para saltar, flecha abajo para agacharse, P para pausa.");
    canvas.tabIndex = 0;
    // Mantener 16:9 dentro de cualquier ventana
    Object.assign(canvas.style, {
      width: "min(100vw, calc(100vh * 16 / 9))",
      height: "auto",
      aspectRatio: "16 / 9",
      imageRendering: "pixelated",
      touchAction: "none",
      outline: "none"
    });
    host.appendChild(canvas);

    const game = new DinoRun(canvas);
    game.enableAudio();
    let raf = 0;
    let last = 0;

    // ---------- Controles: teclado, ratón y táctil ----------
    const JUMP = new Set([" ", "ArrowUp", "w", "W", "z", "Z", "Enter"]);
    const DUCK = new Set(["ArrowDown", "s", "S"]);
    const onKeyDown = (e) => {
      if (JUMP.has(e.key)) { e.preventDefault(); if (!e.repeat) game.pressJump(); }
      else if (DUCK.has(e.key)) { e.preventDefault(); game.setDuck(true); }
      else if (e.key === "p" || e.key === "P") game.togglePause();
      // Escape lo gestiona la consola (vuelve al menú)
    };
    const onKeyUp = (e) => {
      if (JUMP.has(e.key)) game.releaseJump();
      if (DUCK.has(e.key)) game.setDuck(false);
    };
    const onPointerDown = (e) => { e.preventDefault(); game.pressJump(); };
    const onPointerUp = () => game.releaseJump();

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      game.update(dt);
      game.render();
      raf = requestAnimationFrame(loop);
    };

    return {
      start() {
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        canvas.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointerup", onPointerUp);
        canvas.focus();
        last = performance.now();
        raf = requestAnimationFrame(loop);
      },
      pause() { game.pause(); },
      resume() { /* se reanuda con Espacio desde la pantalla de pausa */ },
      async destroy() {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        canvas.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
        await game.closeAudio();
        canvas.remove();
      }
    };
  }
};
