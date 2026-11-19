// ============================================================
// DINO CORREDOR — MOTOR DEL JUEGO (dino.js)
// Corredor infinito ORIGINAL para la consola Michikembo.
// Inspirado en la mecánica conocida (correr, saltar, agacharse),
// pero con código, sprites, colores y sonidos propios:
//   * Dinosaurio menta con bufanda coral (pixel art dibujado aquí).
//   * Escenario de desierto nocturno.
//   * Obstáculos: cactus y meteoritos.
// El mismo motor sirve para el juego (modo normal) y para la
// preview de la consola (modo demo con piloto automático,
// sin teclado, sin audio y sin guardar récord).
// ============================================================

// ---------- Mundo lógico (se escala al tamaño real del canvas) ----------
const W = 1280;
const H = 720;
const GROUND_Y = 590;          // línea del suelo (pies del dinosaurio)
const PX = 6;                  // tamaño de cada "pixel" del sprite

// ---------- Física y dificultad ----------
const GRAVITY = 3600;          // px/s²
const JUMP_V = -1180;          // velocidad inicial de salto
const HOLD_GRAVITY = 0.55;     // gravedad reducida mientras se mantiene el salto (salto variable)
const FAST_FALL = 2.4;         // multiplicador al pulsar abajo en el aire
const SPEED_START = 540;       // px/s
const SPEED_MAX = 1350;
const SPEED_GAIN = 11;         // px/s ganados por segundo
const METEOR_FROM_SCORE = 250; // los meteoritos aparecen a partir de este puntaje

// ---------- Paleta propia ----------
const C = {
  skyTop: "#1d1630",
  skyBottom: "#3b2a4f",
  moon: "#f6e7c8",
  star: "#cbbbe6",
  dune: "#2c2140",
  ground: "#e9c99a",
  groundDot: "#a8875f",
  dino: "#7fd1b9",
  dinoDark: "#3f8f79",
  scarf: "#ef6f5e",
  eye: "#1d1630",
  cactus: "#5fae6e",
  cactusDark: "#3d7a4a",
  meteor: "#c98b5a",
  meteorHot: "#ffb067",
  text: "#fff3e6",
  textDim: "#bfa9d9"
};

// ---------- Sprites (cada cadena es una fila; '.' = transparente) ----------
// # cuerpo, d sombra, s bufanda, e ojo
const DINO_RUN = [
  "..........######..",
  ".........##e#####.",
  ".........########.",
  ".........########.",
  ".........####.....",
  ".........######...",
  "#.......sssss.....",
  "#......#ssss#.....",
  "##....#######d....",
  "###..########.d...",
  "############d.....",
  ".##########d......",
  "..#########.......",
  "...#######........"
];
const LEGS_A = ["....##...#........", "....#....##......."];
const LEGS_B = ["....#....##.......", "....##............"];
const LEGS_AIR = ["....#....#........", "....##...##......."];

const DINO_DUCK = [
  "................######.",
  "#..............##e#####",
  "##.....sss....#########",
  "############ss#####....",
  "#################d.....",
  ".###############d......",
  "..#############........"
];
const DUCK_LEGS_A = ["....##....#............", "....#.....##..........."];
const DUCK_LEGS_B = ["....#.....##...........", "....##.................."];

const COLOR_OF = { "#": C.dino, d: C.dinoDark, s: C.scarf, e: C.eye };

/** Dibuja un sprite de cadenas con su esquina superior izquierda en (x, y). */
function drawSprite(ctx, rows, x, y) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === ".") continue;
      ctx.fillStyle = COLOR_OF[ch] || C.dino;
      ctx.fillRect(Math.round(x + c * PX), Math.round(y + r * PX), PX, PX);
    }
  }
}

/** Intersección de dos rectángulos {x, y, w, h}. */
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ============================================================
// MOTOR
// ============================================================
export class DinoRun {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{demo?: boolean}} options  demo = piloto automático para la preview
   */
  constructor(canvas, { demo = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.demo = demo;
    this.audio = null;                  // AudioContext propio (solo modo normal)
    this.hiscore = demo ? 0 : this.#loadHiscore();
    this.keys = { jump: false, down: false };
    // Estrellas fijas generadas una vez
    this.stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * 380, s: Math.random() < 0.2 ? 4 : 2 }));
    this.reset();
    this.state = demo ? "running" : "ready";
  }

  /** Reinicia la partida (no cambia el estado). */
  reset() {
    this.dino = { x: 150, y: GROUND_Y, vy: 0, onGround: true, ducking: false };
    this.speed = SPEED_START;
    this.distance = 0;
    this.score = 0;
    this.obstacles = [];
    this.nextSpawn = 700;               // distancia hasta el próximo obstáculo
    this.time = 0;
    this.groundOffset = 0;
    this.duneOffset = 0;
    this.flash = 0;                     // parpadeo del marcador cada 100 puntos
    this.overAt = 0;
  }

  // ---------------- Entradas ----------------
  pressJump() {
    if (this.state === "ready") { this.state = "running"; this.#beep(660, 0.05); }
    else if (this.state === "over") {
      if (this.time - this.overAt < 0.45) return;     // evita reinicio accidental
      this.reset(); this.state = "running"; return;
    } else if (this.state === "paused") { this.state = "running"; return; }
    this.keys.jump = true;
    if (this.state === "running" && this.dino.onGround && !this.dino.ducking) {
      this.dino.vy = JUMP_V;
      this.dino.onGround = false;
      this.#beep(520, 0.07, 780);
    }
  }
  releaseJump() { this.keys.jump = false; }
  setDuck(on) { this.keys.down = on; }
  togglePause() {
    if (this.state === "running") this.state = "paused";
    else if (this.state === "paused") this.state = "running";
  }
  pause() { if (this.state === "running") this.state = "paused"; }

  // ---------------- Simulación ----------------
  update(dt) {
    this.time += dt;
    if (this.state !== "running") return;
    if (this.demo) this.#autopilot();

    // Velocidad y distancia
    this.speed = Math.min(SPEED_MAX, this.speed + SPEED_GAIN * dt);
    const dx = this.speed * dt;
    this.distance += dx;
    const newScore = Math.floor(this.distance / 12);
    if (Math.floor(newScore / 100) > Math.floor(this.score / 100)) { this.flash = 0.8; this.#beep(880, 0.06, 1175); }
    this.score = newScore;
    this.flash = Math.max(0, this.flash - dt);
    this.groundOffset = (this.groundOffset + dx) % 64;
    this.duneOffset = (this.duneOffset + dx * 0.25) % W;

    // Dinosaurio: salto variable, caída rápida y agacharse
    const d = this.dino;
    d.ducking = this.keys.down && d.onGround;
    if (!d.onGround) {
      let g = GRAVITY;
      if (this.keys.jump && d.vy < 0) g *= HOLD_GRAVITY;
      if (this.keys.down) g *= FAST_FALL;
      d.vy += g * dt;
      d.y += d.vy * dt;
      if (d.y >= GROUND_Y) { d.y = GROUND_Y; d.vy = 0; d.onGround = true; }
    }

    // Obstáculos: mover, eliminar los que salen y generar nuevos
    for (const o of this.obstacles) o.x -= dx * (o.kind === "meteor" ? 1.12 : 1);
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -50);
    this.nextSpawn -= dx;
    if (this.nextSpawn <= 0) this.#spawn();

    // Colisión
    const boxes = this.#dinoBoxes();
    for (const o of this.obstacles) {
      const ob = { x: o.x + 6, y: o.y + 6, w: o.w - 12, h: o.h - 8 };
      if (boxes.some((b) => hit(b, ob))) { this.#gameOver(); break; }
    }
  }

  #spawn() {
    const canMeteor = this.score >= METEOR_FROM_SCORE;
    if (canMeteor && Math.random() < 0.3) {
      // Meteorito a tres alturas (se indica el borde inferior):
      //   bajo  -> hay que saltar
      //   medio -> hay que agacharse (golpea la cabeza)
      //   alto  -> pasa por encima, pero castiga un salto a destiempo
      const bottom = [GROUND_Y - 12, GROUND_Y - 62, GROUND_Y - 120][Math.floor(Math.random() * 3)];
      this.obstacles.push({ kind: "meteor", x: W + 40, y: bottom - 44, w: 64, h: 44 });
    } else {
      // Grupo de 1 a 3 cactus de alturas variadas
      const count = 1 + Math.floor(Math.random() * (this.speed > 800 ? 3 : 2));
      const tall = Math.random() < 0.5;
      const w = count * 34 + (count - 1) * 6;
      const h = tall ? 96 : 66;
      this.obstacles.push({ kind: "cactus", x: W + 40, y: GROUND_Y - h, w, h, count, tall });
    }
    // Hueco proporcional a la velocidad: siempre alcanzable con un salto
    const minGap = this.speed * 0.62 + 160;
    this.nextSpawn = minGap + Math.random() * 520;
  }

  /** Cajas de colisión aproximadas del dinosaurio (algo menores que el sprite, para ser justas). */
  #dinoBoxes() {
    const d = this.dino;
    if (d.ducking) {
      const top = d.y - 9 * PX;
      return [{ x: d.x + 6, y: top + 6, w: 22 * PX - 12, h: 7 * PX - 6 }];
    }
    const top = d.y - 16 * PX;
    return [
      { x: d.x + 9 * PX + 4, y: top + 4, w: 8 * PX - 8, h: 5 * PX },     // cabeza
      { x: d.x + 3 * PX, y: top + 6 * PX, w: 11 * PX, h: 9 * PX }        // cuerpo y patas
    ];
  }

  #gameOver() {
    this.state = "over";
    this.overAt = this.time;
    this.#beep(300, 0.12, 120);
    if (!this.demo && this.score > this.hiscore) {
      this.hiscore = this.score;
      try { localStorage.setItem("mk.dino.hiscore", String(this.hiscore)); } catch { /* ignorar */ }
    }
  }

  /** Piloto automático para la preview: salta cactus y meteoritos bajos, se agacha con los altos. */
  #autopilot() {
    const d = this.dino;
    const next = this.obstacles.find((o) => o.x + o.w > d.x);
    this.keys.down = false;
    if (!next) { this.keys.jump = false; return; }
    const dist = next.x - (d.x + 16 * PX);
    const lead = this.speed * 0.2;
    const highMeteor = next.kind === "meteor" && next.y + next.h < GROUND_Y - 9 * PX;
    if (highMeteor) { if (dist < lead + 60) this.keys.down = true; return; }
    if (dist < lead && dist > -20 && d.onGround) this.pressJump();
    if (!d.onGround && d.vy > 0) this.keys.jump = false;
  }

  #loadHiscore() {
    try { return Number(localStorage.getItem("mk.dino.hiscore")) || 0; } catch { return 0; }
  }

  // ---------------- Audio propio (tonos sintetizados) ----------------
  enableAudio() {
    if (this.demo || this.audio) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) this.audio = new AC();
  }
  #beep(freq, dur, toFreq) {
    const a = this.audio;
    if (!a || a.state !== "running") return;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, a.currentTime);
    if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, a.currentTime + dur);
    gain.gain.setValueAtTime(0.05, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    osc.connect(gain).connect(a.destination);
    osc.start();
    osc.stop(a.currentTime + dur);
  }
  async closeAudio() {
    if (this.audio) { try { await this.audio.close(); } catch { /* ya cerrado */ } this.audio = null; }
  }

  // ---------------- Dibujo ----------------
  render() {
    const { ctx, canvas } = this;
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Cielo, luna y estrellas
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, C.skyTop);
    sky.addColorStop(1, C.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.star;
    for (const s of this.stars) ctx.fillRect(s.x, s.y, s.s, s.s);
    ctx.fillStyle = C.moon;
    ctx.beginPath(); ctx.arc(1060, 130, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.skyTop;
    ctx.beginPath(); ctx.arc(1082, 116, 40, 0, Math.PI * 2); ctx.fill();

    // Dunas lejanas (parallax lento)
    ctx.fillStyle = C.dune;
    for (let k = -1; k < 2; k++) {
      const ox = k * W - this.duneOffset;
      ctx.beginPath();
      ctx.moveTo(ox, GROUND_Y);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(ox + x, GROUND_Y - 60 - Math.sin(x / 140) * 35 - Math.sin(x / 57) * 10);
      ctx.lineTo(ox + W, GROUND_Y);
      ctx.fill();
    }

    // Suelo con marcas que se desplazan
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, GROUND_Y, W, 6);
    ctx.fillStyle = C.groundDot;
    for (let x = -this.groundOffset; x < W; x += 64) {
      ctx.fillRect(x, GROUND_Y + 22, 18, 4);
      ctx.fillRect(x + 36, GROUND_Y + 48, 8, 4);
    }

    // Obstáculos
    for (const o of this.obstacles) (o.kind === "cactus" ? this.#drawCactus(o) : this.#drawMeteor(o));

    // Dinosaurio
    this.#drawDino();

    // Marcador
    ctx.font = "28px 'Press Start 2P', monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = this.flash > 0 && Math.floor(this.flash * 8) % 2 ? "transparent" : C.text;
    ctx.fillText(String(this.score).padStart(5, "0"), W - 40, 60);
    if (!this.demo) {
      ctx.fillStyle = C.textDim;
      ctx.fillText(`HI ${String(this.hiscore).padStart(5, "0")}`, W - 240, 60);
    }

    // Mensajes de estado
    ctx.textAlign = "center";
    if (this.state === "ready") this.#banner("DINO CORREDOR", "ESPACIO / A / TOCAR PARA CORRER");
    if (this.state === "paused") this.#banner("PAUSA", "ESPACIO PARA SEGUIR · ESC CONSOLA");
    if (this.state === "over") this.#banner("¡AY!", this.demo ? "" : "ESPACIO PARA REINTENTAR · ESC CONSOLA");
  }

  #banner(title, sub) {
    const { ctx } = this;
    ctx.fillStyle = "rgba(20, 14, 32, 0.6)";
    ctx.fillRect(0, 230, W, 170);
    ctx.fillStyle = C.text;
    ctx.font = "44px 'Press Start 2P', monospace";
    ctx.fillText(title, W / 2, 300);
    if (sub) {
      ctx.fillStyle = C.textDim;
      ctx.font = "20px 'Press Start 2P', monospace";
      ctx.fillText(sub, W / 2, 360);
    }
  }

  #drawDino() {
    const { ctx, dino: d } = this;
    const step = Math.floor(this.time * 12) % 2;
    if (d.ducking) {
      const top = d.y - 9 * PX;
      drawSprite(ctx, DINO_DUCK, d.x, top);
      drawSprite(ctx, step ? DUCK_LEGS_A : DUCK_LEGS_B, d.x, top + 7 * PX);
    } else {
      const top = d.y - 16 * PX;
      drawSprite(ctx, DINO_RUN, d.x, top);
      const legs = !d.onGround ? LEGS_AIR : this.state === "running" ? (step ? LEGS_A : LEGS_B) : LEGS_A;
      drawSprite(ctx, legs, d.x, top + 14 * PX);
    }
  }

  #drawCactus(o) {
    const { ctx } = this;
    for (let i = 0; i < o.count; i++) {
      const x = o.x + i * 40;
      const h = o.h - (i % 2) * 14;
      const y = GROUND_Y - h;
      ctx.fillStyle = C.cactus;
      ctx.fillRect(x + 11, y, 12, h);                 // tronco
      ctx.fillRect(x, y + h * 0.35, 8, h * 0.3);      // brazo izquierdo
      ctx.fillRect(x, y + h * 0.6, 14, 6);
      ctx.fillRect(x + 26, y + h * 0.2, 8, h * 0.3);  // brazo derecho
      ctx.fillRect(x + 20, y + h * 0.45, 14, 6);
      ctx.fillStyle = C.cactusDark;
      ctx.fillRect(x + 19, y + 4, 4, h - 4);          // sombra del tronco
    }
  }

  #drawMeteor(o) {
    const { ctx } = this;
    // Estela
    ctx.fillStyle = C.meteorHot;
    for (let i = 1; i <= 4; i++) ctx.fillRect(o.x + o.w + i * 14, o.y + 14 + (i % 2) * 8, 10 - i, 10 - i);
    // Roca en bloques
    ctx.fillStyle = C.meteor;
    ctx.fillRect(o.x + 8, o.y, o.w - 16, o.h);
    ctx.fillRect(o.x, o.y + 8, o.w, o.h - 16);
    ctx.fillStyle = C.meteorHot;
    ctx.fillRect(o.x + o.w - 22, o.y + 8, 10, 10);
  }
}

export const DINO_SIZE = { W, H };
