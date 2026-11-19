// ============================================================
// CONSOLA MICHIKEMBO — CONTROLADOR PRINCIPAL (main.js)
// Máquina de estados de la consola:
//   off -> boot -> select -> launching -> playing -> closing -> select
// Reglas clave (plan §12):
//   * Solo existe UN juego montado a la vez (un solo bucle, una sola cámara).
//   * Las previews no abren cámara ni cargan modelos.
//   * Al salir se destruye el juego y se cierran cámara y audio.
// ============================================================

import { CATALOG } from "./catalog.js";
import { sfx, music, unlockAudio, suspendAudio, toggleMute, isMuted, audioConsola } from "./sfx.js";
import { guardWindow, stopAllStreams, liveTrackCount } from "./media-guard.js";

// ---------- Referencias del DOM ----------
const $ = (sel) => document.querySelector(sel);
const body = $("#consoleBody");
const screenEl = $("#screen");
const layers = [...document.querySelectorAll("[data-layer]")];
const previewCanvas = $("#previewCanvas");
const stage = $("#stage");
const stageHost = $("#stageHost");
const ui = {
  index: $("#selIndex"),
  badge: $("#selBadge"),
  sound: $("#selSound"),
  title: $("#selTitle"),
  desc: $("#selDesc"),
  dots: $("#selDots")
};

// ---------- Estado ----------
let state = "off";
let selected = loadSelected();   // índice del cartucho elegido (persistente)
let preview = null;              // preview activa { frame, dispose }
let previewRaf = 0;              // id de requestAnimationFrame de la preview
let instance = null;             // juego montado (solo uno)
let bootTimer = 0;

guardWindow(window);             // registrar cualquier cámara que se abra desde la consola

function loadSelected() {
  try {
    const v = Number(localStorage.getItem("mk.console.selected"));
    return Number.isInteger(v) && v >= 0 && v < CATALOG.length ? v : 0;
  } catch { return 0; }
}
function saveSelected() {
  try { localStorage.setItem("mk.console.selected", String(selected)); } catch { /* ignorar */ }
}

/** Muestra solo la capa de pantalla indicada. */
function showLayer(name) {
  for (const l of layers) l.hidden = l.dataset.layer !== name;
}

// ============================================================
// ENCENDIDO / APAGADO
// ============================================================
function powerOn() {
  if (state !== "off") return;
  unlockAudio();
  state = "boot";
  body.dataset.power = "on";
  showLayer("boot");
  sfx.boot();
  // El arranque dura ~1.8 s; cualquier tecla lo salta
  bootTimer = setTimeout(enterSelect, 1800);
}

function powerOff() {
  if (state === "playing" || state === "launching" || state === "closing") return;
  clearTimeout(bootTimer);
  stopPreview();
  music.stop();
  sfx.off();
  state = "off";
  body.dataset.power = "off";
  showLayer("off");
}

// ============================================================
// SELECCIÓN Y PREVIEWS
// ============================================================
function enterSelect() {
  clearTimeout(bootTimer);
  state = "select";
  showLayer("select");
  buildDots();
  renderSelection();
  sfx.meow();
  music.start();     // tema de bienvenida en bucle suave (solo tras pulsar POWER)
}

function buildDots() {
  ui.dots.innerHTML = "";
  CATALOG.forEach((game, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "dot";
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", game.title);
    dot.addEventListener("click", () => { if (state === "select") { selected = i; sfx.move(); renderSelection(); } });
    ui.dots.appendChild(dot);
  });
}

/** Actualiza textos, puntos y preview del cartucho elegido. */
function renderSelection() {
  const game = CATALOG[selected];
  saveSelected();
  ui.index.textContent = `${selected + 1}/${CATALOG.length}`;
  ui.badge.textContent = game.badge;
  ui.badge.classList.toggle("warn", game.status !== "ready");
  ui.title.textContent = game.title;
  ui.desc.textContent = game.description;
  ui.sound.textContent = isMuted() ? "♪ OFF" : "♪ ON";
  [...ui.dots.children].forEach((d, i) => d.setAttribute("aria-selected", String(i === selected)));
  // Reiniciar animación de entrada del canvas
  previewCanvas.classList.add("swap");
  void previewCanvas.offsetWidth;
  previewCanvas.classList.remove("swap");
  startPreview(game);
}

/** Arranca la preview del juego (un único bucle de preview a la vez). */
function startPreview(game) {
  stopPreview();
  // El canvas es compartido: limpiar transformaciones que haya dejado la preview anterior
  // (p. ej. Dino escala con setTransform) para que la siguiente no se dibuje encogida.
  const pctx = previewCanvas.getContext("2d");
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.globalAlpha = 1;
  pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  preview = game.createPreview(previewCanvas);
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    preview.frame(dt);
    previewRaf = requestAnimationFrame(loop);
  };
  previewRaf = requestAnimationFrame(loop);
}

function stopPreview() {
  cancelAnimationFrame(previewRaf);
  previewRaf = 0;
  if (preview) { preview.dispose(); preview = null; }
}

function move(delta) {
  if (state !== "select") return;
  selected = (selected + delta + CATALOG.length) % CATALOG.length;
  sfx.move();
  renderSelection();
}

// ============================================================
// LANZAR Y CERRAR UN JUEGO (modo expandido)
// ============================================================
const EXPAND_MS = 470;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Coloca el escenario exactamente sobre la pantalla de la consola. */
function placeStageOnScreen() {
  const r = screenEl.getBoundingClientRect();
  Object.assign(stage.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
}

async function launch() {
  if (state !== "select") return;
  const game = CATALOG[selected];
  state = "launching";
  sfx.select();
  stopPreview();                 // la preview deja de dibujar: no hay dos bucles
  await wait(120);               // deja sonar el pitido antes de suspender el audio
  suspendAudio();

  // 1) Animación: la pantalla crece hasta ocupar la ventana
  placeStageOnScreen();
  stage.hidden = false;
  void stage.offsetWidth;        // forzar reflujo para que la transición arranque
  stage.classList.add("expanded");
  document.body.classList.add("is-playing");
  await wait(EXPAND_MS);

  // 2) Montar el juego (o su pantalla informativa si aún no es jugable)
  try {
    instance = await game.mount(stageHost, { exit: requestExit, guardWindow });
    if (state !== "launching") return;   // se pidió salir durante la carga
    instance.start();
    state = "playing";
    watchPointerInFrames();
    showBarForAWhile();
  } catch (err) {
    console.error("[consola] Error al montar", game.id, err);
    stageHost.innerHTML = `<div class="notice"><h2>No se pudo iniciar</h2><p>${String(err.message || err)}</p><p class="muted">Pulsa Esc o ◀ Consola para volver.</p></div>`;
    instance = null;
    state = "playing";
  }
}

/** Petición de volver a la consola (botón, Escape o el propio juego). */
async function requestExit() {
  if (state !== "playing" && state !== "launching") return;
  state = "closing";

  // 1) Destruir el juego: detiene su bucle, sus listeners y su audio
  if (instance) {
    try { await instance.destroy(); } catch (err) { console.warn("[consola] destroy falló", err); }
    instance = null;
  }
  stageHost.innerHTML = "";
  // 2) Red de seguridad: cerrar cualquier cámara que haya quedado abierta
  const leaked = stopAllStreams();
  if (leaked > 0) console.warn(`[consola] Se cerraron ${leaked} pistas de cámara que seguían abiertas.`);
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});

  // 3) Animación inversa hacia la pantalla de la consola
  stage.classList.remove("expanded");
  placeStageOnScreen();
  await wait(EXPAND_MS);
  stage.hidden = true;
  document.body.classList.remove("is-playing");
  clearTimeout(barTimer);
  stageBar.classList.remove("auto-hidden");

  unlockAudio();
  sfx.back();
  music.start();
  state = "select";
  renderSelection();
}

// ---------- Barra «◀ Consola» que se oculta sola (idea de MichiBox) ----------
const stageBar = document.querySelector(".stage-bar");
let barTimer = 0;
function showBarForAWhile() {
  stageBar.classList.remove("auto-hidden");
  clearTimeout(barTimer);
  barTimer = setTimeout(() => { if (state === "playing") stageBar.classList.add("auto-hidden"); }, 2500);
}
/** Los iframes de misma procedencia no propagan el ratón: se escucha dentro de ellos. */
function watchPointerInFrames() {
  for (const f of stageHost.querySelectorAll("iframe")) {
    try { f.contentWindow.addEventListener("pointermove", showBarForAWhile); } catch { /* otra procedencia */ }
  }
}
stage.addEventListener("pointermove", showBarForAWhile);

// Exponer para pruebas automatizadas y depuración
window.michikemboConsole = {
  get state() { return state; },
  get selected() { return selected; },
  audio: () => audioConsola.estado(),
  liveTrackCount
};

// ============================================================
// ENTRADA: teclado, botones en pantalla y visibilidad
// ============================================================

/** Traduce una entrada lógica (a, b, left, ...) a una acción según el estado. */
function handleInput(input) {
  unlockAudio();
  if (state === "off") { if (input === "power" || input) powerOn(); return; }
  if (state === "boot") { enterSelect(); return; }
  if (input === "power") { powerOff(); return; }
  if (state === "playing") { if (input === "b") requestExit(); return; }
  if (state !== "select") return;

  switch (input) {
    case "left":
    case "up":     move(-1); break;
    case "right":
    case "down":   move(+1); break;
    case "a":
    case "start":  launch(); break;
    case "b":      sfx.back(); break;
    case "select": toggleMute(); renderSelection(); if (!isMuted()) sfx.move(); break;
  }
}

const KEYMAP = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  a: "left", d: "right", w: "up", s: "down",
  Enter: "start", z: "a", " ": "a",
  Escape: "b", x: "b", Backspace: "b",
  Shift: "select", p: "power"
};

window.addEventListener("keydown", (e) => {
  // Durante el juego, la consola solo escucha Escape: el resto es del juego
  if (state === "playing" || state === "launching") {
    if (e.key === "Escape") { e.preventDefault(); requestExit(); }
    return;
  }
  const input = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase()];
  if (!input && state !== "off") return;
  if (e.repeat && (input === "a" || input === "start" || input === "power")) return;
  // Evitar que el espacio o las flechas desplacen la página
  if (input) e.preventDefault();
  pressFeedback(input);
  handleInput(input || "a");
});

// Botones clicables de la carcasa
for (const btn of document.querySelectorAll("[data-input]")) {
  btn.addEventListener("click", () => handleInput(btn.dataset.input));
}
$("#btnPower").addEventListener("click", () => (state === "off" ? powerOn() : handleInput("power")));
$("#btnExit").addEventListener("click", requestExit);
$("#btnFullscreen").addEventListener("click", () => {
  // Pantalla completa del sistema: opcional, nunca obligatoria
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else stage.requestFullscreen?.().catch(() => {});
});

/** Hunde visualmente el botón físico que corresponde a la tecla. */
function pressFeedback(input) {
  const el = document.querySelector(`.console [data-input="${input}"]:not(.arrow)`);
  if (!el) return;
  el.classList.add("pressed");
  setTimeout(() => el.classList.remove("pressed"), 120);
}

// Pausar el juego al cambiar de pestaña; la preview se detiene sola (rAF)
document.addEventListener("visibilitychange", () => {
  // Audio de la consola: se suspende con la pestaña oculta y vuelve solo en el selector
  if (document.hidden) audioConsola.suspender();
  else if (state === "select" || state === "boot") audioConsola.reanudar();
  if (state !== "playing" || !instance) return;
  if (document.hidden) instance.pause?.();
});

// Si la ventana cambia de tamaño durante una transición, recolocar el escenario
window.addEventListener("resize", () => { if (!stage.hidden && !stage.classList.contains("expanded")) placeStageOnScreen(); });

// Pintar el primer estado
showLayer("off");
