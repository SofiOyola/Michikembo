// ============================================================
// Pruebas del gestor de audio compartido (Fase 6)
// Se usa un AudioContext FALSO que solo registra lo que se crea,
// así las pruebas corren en Node sin altavoces.
// Ejecutar: node --test tests/*.test.mjs
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { frecuencia, parsearPatron, compilar } from "../compartido/audio/notas.js";
import { GestorAudio, leerPistas, normalizarPreferencias, leerPreferencias, CLAVE_PREFERENCIAS } from "../compartido/audio/gestor_audio.js";
import { MUSICA_CONSOLA, EFECTOS_CONSOLA, MUSICA_MICHIKEMBO, EFECTOS_MICHIKEMBO } from "../compartido/audio/composiciones.js";
import { readFileSync } from "node:fs";

// ---------- AudioContext falso ----------
class ParamFalso {
    constructor(v = 1) { this.value = v; this.eventos = []; }
    setValueAtTime(v, t) { this.eventos.push(["set", v, t]); this.value = v; }
    linearRampToValueAtTime(v, t) { this.eventos.push(["lin", v, t]); }
    exponentialRampToValueAtTime(v, t) { this.eventos.push(["exp", v, t]); }
    setTargetAtTime(v, t) { this.eventos.push(["target", v, t]); this.value = v; }
    cancelScheduledValues() {}
}
class NodoFalso {
    constructor(ctx, tipo) { this.ctx = ctx; this.tipo = tipo; this.gain = new ParamFalso(); this.frequency = new ParamFalso(); }
    connect(n) { return n; }
    disconnect() {}
    start(t) { this.inicio = t; this.ctx.iniciados.push(this); }
    stop(t) { this.fin = t; }
    setPeriodicWave() {}
}
class ContextoFalso {
    constructor() { this.state = "running"; this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; this.iniciados = []; this.cerrado = false; }
    createGain() { return new NodoFalso(this, "gain"); }
    createOscillator() { return new NodoFalso(this, "osc"); }
    createBufferSource() { return new NodoFalso(this, "buffer"); }
    createBiquadFilter() { return new NodoFalso(this, "filtro"); }
    createPeriodicWave() { return {}; }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    async decodeAudioData(b) { return { decodificado: b.byteLength }; }
    async resume() { this.state = "running"; }
    async suspend() { this.state = "suspended"; }
    async close() { this.cerrado = true; this.state = "closed"; }
}
class AlmacenFalso {
    constructor(d = {}) { this.d = { ...d }; }
    getItem(k) { return k in this.d ? this.d[k] : null; }
    setItem(k, v) { this.d[k] = String(v); }
}
const esperar = () => new Promise((r) => setTimeout(r, 5));

function nuevoGestor(extra = {}) {
    let ctx = null;
    const g = new GestorAudio({
        musica: MUSICA_MICHIKEMBO, efectos: EFECTOS_MICHIKEMBO, almacen: new AlmacenFalso(),
        crearContexto: () => (ctx = new ContextoFalso()), temporizador: false, cargar: null, ...extra,
    });
    return { g, ctx: () => ctx };
}

// ---------- Notación ----------
test("notas: A4 = 440 Hz, C5 ≈ 523.25 Hz, Bb3 = A#3", () => {
    assert.equal(frecuencia("A4"), 440);
    assert.ok(Math.abs(frecuencia("C5") - 523.25) < 0.01);
    assert.equal(frecuencia("Bb3"), frecuencia("A#3"));
    assert.throws(() => frecuencia("H2"));
});

test("notas: el patrón respeta silencios, percusión y barras de compás", () => {
    const { eventos, total } = parsearPatron("C5:2 . | k:3 E5");
    assert.equal(total, 7);
    assert.deepEqual(eventos.map((e) => [e.paso, e.pasos, e.tipo]), [[0, 2, "nota"], [3, 3, "percusion"], [6, 1, "nota"]]);
});

test("composiciones: todas compilan y sus voces miden lo mismo (bucles sin desfase)", () => {
    for (const grupo of [MUSICA_CONSOLA, EFECTOS_CONSOLA, MUSICA_MICHIKEMBO, EFECTOS_MICHIKEMBO]) {
        for (const [id, c] of Object.entries(grupo)) {
            const x = compilar(c);
            assert.ok(x.total > 0, id);
        }
    }
    // Las músicas en bucle son de 8 compases de 16 semicorcheas
    assert.equal(compilar(MUSICA_MICHIKEMBO.menu_theme).total, 128);
    assert.equal(compilar(MUSICA_CONSOLA.bienvenida).total, 128);
    // Los efectos son breves (menos de 1 s) para no tapar el juego
    for (const c of [...Object.values(EFECTOS_MICHIKEMBO), ...Object.values(EFECTOS_CONSOLA)]) assert.ok(compilar(c).duracion < 1, c.titulo);
});

test("pistas.json reales: válidos y con un id existente por clave", () => {
    for (const [ruta, piezas] of [["assets/audio/michikembo/pistas.json", { ...MUSICA_MICHIKEMBO, ...EFECTOS_MICHIKEMBO }],
        ["assets/audio/console/pistas.json", { ...MUSICA_CONSOLA, ...EFECTOS_CONSOLA }]]) {
        const json = JSON.parse(readFileSync(new URL(`../${ruta}`, import.meta.url)));
        for (const id of Object.keys(json).filter((k) => !k.startsWith("_"))) assert.ok(piezas[id], `${ruta}: ${id}`);
    }
});

test("leerPistas: null/vacío → sintetizado, texto u objeto → archivo", () => {
    const p = leerPistas({ _ayuda: "x", a: null, b: "", c: "c.ogg", d: { archivo: "d.mp3", volumen: 3, bucle: false } });
    assert.deepEqual(Object.keys(p), ["c", "d"]);
    assert.equal(p.d.volumen, 1);
    assert.equal(p.d.bucle, false);
});

// ---------- Preferencias ----------
test("preferencias: se limitan a 0..1 y se guardan/leen", () => {
    assert.deepEqual(normalizarPreferencias({ maestro: 5, musica: -1, efectos: "x", silencio: 1 }),
        { maestro: 1, musica: 0, efectos: 0.8, silencio: true });
    const { g } = nuevoGestor();
    g.ajustar({ musica: 0.25 });
    assert.equal(JSON.parse(g.almacen.getItem(CLAVE_PREFERENCIAS)).musica, 0.25);
    assert.equal(leerPreferencias(g.almacen).musica, 0.25);
    // El silencio antiguo de la consola se respeta
    assert.equal(leerPreferencias(new AlmacenFalso({ "mk.console.muted": "1" })).silencio, true);
});

// ---------- Reproducción ----------
test("no suena nada antes de desbloquear (política de reproducción automática)", async () => {
    const { g, ctx } = nuevoGestor();
    g.musica("menu_theme");
    assert.equal(ctx(), null, "no se crea AudioContext sin gesto");
    assert.equal(g.efecto("boton"), false);
    g.desbloquear();
    await esperar();
    assert.equal(g.estado().musica, "menu_theme", "la música pedida suena al desbloquear");
    assert.ok(ctx().iniciados.length > 0);
    g.liberar();
});

test("pedir la misma música no la reinicia, y nunca hay dos músicas a la vez", async () => {
    const { g } = nuevoGestor();
    g.desbloquear(); await esperar();
    g.musica("menu_theme");
    const primera = g.actual;
    g.musica("menu_theme");
    assert.equal(g.actual, primera, "misma pieza → mismo objeto, sin reinicio");
    g.musica("final_win");
    assert.equal(g.estado().musica, "final_win");
    assert.equal(primera.parada, true, "la anterior se detiene con fundido");
    assert.ok(g.actual.inicio >= 0.4, "la nueva entra tras el fundido de salida (sin solaparse)");
    g.musica(null);
    assert.equal(g.estado().musica, null);
    g.liberar();
});

test("la música en bucle vuelve a empezar y la final se termina sola", async () => {
    const { g, ctx } = nuevoGestor();
    g.desbloquear(); await esperar();
    g.musica("menu_theme");
    const inicio = g.actual.inicio, dur = g.actual.pieza.duracion;
    for (let t = 0; t < dur + 1; t += 0.05) { ctx().currentTime = t; g._programar(); }
    assert.ok(g.actual.inicio > inicio, "segunda vuelta programada");
    g.musica("final_win");
    const fin = ctx().currentTime + 10;
    for (let t = ctx().currentTime; t < fin; t += 0.05) { ctx().currentTime = t; g._programar(); }
    assert.equal(g.estado().musica, null, "la fanfarria no se repite");
    g.liberar();
});

test("silencio: los efectos no crean nodos y el maestro baja a 0", async () => {
    const { g, ctx } = nuevoGestor();
    g.desbloquear(); await esperar();
    g.ajustar({ silencio: true });
    const antes = ctx().iniciados.length;
    assert.equal(g.efecto("round_win"), false);
    assert.equal(ctx().iniciados.length, antes);
    assert.equal(g.nodos.maestro.gain.value, 0);
    g.alternarSilencio();
    assert.equal(g.nodos.maestro.gain.value, 0.8);
    assert.equal(g.efecto("round_win"), true);
    g.liberar();
});

test("archivos del usuario: si pistas.json declara uno, se usa en lugar del sintetizado", async () => {
    const respuestas = {
        "http://x/a/pistas.json": { ok: true, json: async () => ({ menu_theme: "mi_tema.ogg", reveal: "falta.wav" }) },
        "http://x/a/mi_tema.ogg": { ok: true, arrayBuffer: async () => new ArrayBuffer(16) },
        "http://x/a/falta.wav": { ok: false, status: 404 },
    };
    const { g } = nuevoGestor({ urlPistas: "http://x/a/pistas.json", cargar: async (u) => respuestas[u] });
    g.precargar();
    g.musica("menu_theme");
    g.desbloquear(); await esperar(); await esperar();
    assert.equal(g.estado().fuente, "archivo");
    assert.deepEqual(g.estado().archivos, ["menu_theme"]);
    assert.match(g.estado().avisos.join(" "), /falta\.wav/, "un archivo que falta solo deja un aviso");
    assert.equal(g.efecto("reveal"), true, "el efecto sin archivo usa la versión original");
    g.liberar();
});

test("liberar cierra el contexto y deja el gestor mudo", async () => {
    const { g, ctx } = nuevoGestor();
    g.desbloquear(); await esperar();
    g.musica("menu_theme");
    const c = ctx();
    g.liberar();
    assert.equal(c.cerrado, true);
    assert.equal(g.estado().musica, null);
    assert.equal(g.efecto("boton"), false);
    g.desbloquear();
    assert.equal(g.ctx, null, "no se vuelve a abrir tras liberar");
});

// ---------- Música por estado de Michikembo ----------
test("Michikembo: menús con el mismo tema, rondas sin música, final con su pieza, pausa sin cambios", async () => {
    const { musicaDeEstado, EFECTO_RESULTADO } = await import("../games/michikembo/js/sonido.js");
    const { E } = await import("../games/michikembo/js/maquina.js");
    for (const e of [E.GAME_MENU, E.ASK_READY, E.SELECT_TARGET_WINS, E.CAMERA_PERMISSION]) assert.equal(musicaDeEstado(e), "menu_theme", e);
    for (const e of [E.ROUND_PREPARE, E.COUNTDOWN_3, E.COUNTDOWN_1_REVEAL_CAT, E.CAPTURE_PLAYER_GESTURE, E.ROUND_WIN_PLAYER, E.WAIT_NEXT_ROUND]) assert.equal(musicaDeEstado(e), null, e);
    assert.equal(musicaDeEstado(E.GAME_OVER_WIN), "final_win");
    assert.equal(musicaDeEstado(E.GAME_OVER_LOSE), "final_lose");
    assert.equal(musicaDeEstado(E.PAUSED), undefined);
    for (const id of Object.values(EFECTO_RESULTADO)) assert.ok(EFECTOS_MICHIKEMBO[id], id);
});
