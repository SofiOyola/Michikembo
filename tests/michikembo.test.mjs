// Pruebas unitarias de la lógica de Michikembo (sin navegador).
// Ejecutar desde la raíz del repositorio:  npm test
// Incluyen los casos obligatorios del plan (§13) que no necesitan cámara.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverRonda, elegirJugadaMichi, JUGADAS } from "../games/michikembo/js/reglas.js";
import { decidirFotograma, Estabilizador } from "../games/michikembo/js/estabilizador.js";
import { Partida, E, METAS, animacionMichi } from "../games/michikembo/js/maquina.js";
import { CONFIG } from "../games/michikembo/js/config.js";
import animations from "../assets/michi/animations.json" with { type: "json" };

// ---------------------------------------------------------------- utilidades
const f = (j) => ({ jugada: j, motivo: j ? "ok" : "sin_mano" });
const amb = { jugada: null, motivo: "ambigua" };
const K = CONFIG.FOTOGRAMAS_ESTABLES;

/** Reloj falso + partida lista en CAMERA_PERMISSION con la meta indicada. */
function nuevaPartida(meta = 3, aleatorio) {
    const reloj = { t: 0 };
    const cambios = [];
    const p = new Partida(CONFIG, { aleatorio, alCambiar: (n) => cambios.push(n) });
    p.jugar(reloj.t); p.listoSi(reloj.t); p.elegirMeta(meta, reloj.t);
    return { p, reloj, cambios };
}

/** Avanza el reloj en pasos de 50 ms hasta que se cumpla la condición. */
function avanzarHasta(p, reloj, cond, max = 20000) {
    for (let i = 0; i < max / 50; i++) {
        if (cond()) return;
        reloj.t += 50;
        p.actualizar(reloj.t);
    }
    assert.fail(`no se llegó a la condición; estado=${p.estado}`);
}

/**
 * Juega una ronda completa: espera la ventana de captura, envía `fotogramas`
 * (decisiones) y devuelve el estado de resultado.
 */
function jugarRonda(p, reloj, fotogramas) {
    avanzarHasta(p, reloj, () => p.estado === E.COUNTDOWN_1_REVEAL_CAT);
    for (const d of fotogramas) p.registrarDecision(p.ronda, d);
    avanzarHasta(p, reloj, () => [E.ROUND_WIN_PLAYER, E.ROUND_WIN_CAT, E.ROUND_TIE, E.ROUND_INVALID_GESTURE].includes(p.estado));
    return p.estado;
}

/** Jugada que gana / pierde contra otra. */
const GANA_A = { piedra: "papel", papel: "tijera", tijera: "piedra" };
const PIERDE_A = { piedra: "tijera", papel: "piedra", tijera: "papel" };
const estable = (j) => Array(K + 1).fill(f(j));

// ---------------------------------------------------------------- arte
test("arte: las seis animaciones de Michi tienen una ruta GIF configurada", () => {
    const esperados = ["idle", "piedra", "papel", "tijera", "feliz", "triste"];
    assert.deepEqual(Object.keys(animations.estados), esperados);
    for (const estado of esperados) {
        assert.equal(animations.estados[estado].tipo, "gif");
        assert.match(animations.estados[estado].archivo, /^sprites\/.+\.gif$/);
    }
});

// ---------------------------------------------------------------- reglas (§13)
test("reglas: Rock>Scissors, Paper>Rock, Scissors>Paper, mismo gesto = empate, sin mano = sin jugada", () => {
    assert.equal(resolverRonda("piedra", "tijera"), "gana");
    assert.equal(resolverRonda("papel", "piedra"), "gana");
    assert.equal(resolverRonda("tijera", "papel"), "gana");
    assert.equal(resolverRonda("tijera", "piedra"), "pierde");
    assert.equal(resolverRonda("piedra", "papel"), "pierde");
    assert.equal(resolverRonda("papel", "tijera"), "pierde");
    for (const j of JUGADAS) assert.equal(resolverRonda(j, j), "empate");
    assert.equal(resolverRonda(null, "papel"), "sin_jugada");
});

test("Michi elige las tres opciones con frecuencia parecida", () => {
    const n = { piedra: 0, papel: 0, tijera: 0 };
    for (let i = 0; i < 30000; i++) n[elegirJugadaMichi()] += 1;
    for (const j of JUGADAS) assert.ok(Math.abs(n[j] / 30000 - 1 / 3) < 0.02, `${j}: ${n[j]}`);
});

// ---------------------------------------------------------------- fotograma y filtro
test("fotograma: clases 0=Paper 1=Rock 2=Scissors, umbral y manos en conflicto", () => {
    assert.equal(decidirFotograma([{ clase: 0, confianza: 0.9 }], 0.6).jugada, "papel");
    assert.equal(decidirFotograma([{ clase: 1, confianza: 0.9 }], 0.6).jugada, "piedra");
    assert.equal(decidirFotograma([{ clase: 2, confianza: 0.9 }], 0.6).jugada, "tijera");
    assert.equal(decidirFotograma([{ clase: 2, confianza: 0.5 }], 0.6).motivo, "sin_mano");
    assert.equal(decidirFotograma([{ clase: 0, confianza: 0.9 }, { clase: 1, confianza: 0.8 }], 0.6).motivo, "ambigua");
    assert.equal(decidirFotograma([{ clase: 1, confianza: 0.9 }, { clase: 1, confianza: 0.7 }], 0.6).jugada, "piedra");
});

test("filtro: una detección aislada (Nada → Tijera 1 fotograma) NO confirma jugada", () => {
    const est = new Estabilizador({ fotogramasEstables: 4 });
    [null, null, "tijera", null, null, null].forEach((j) => est.agregar(f(j)));
    assert.deepEqual(est.cerrar(), { jugada: null, motivo: "inestable" });
});

test("filtro: Nada es un estado real y rompe la racha", () => {
    const est = new Estabilizador({ fotogramasEstables: 4 });
    ["piedra", "piedra", "piedra", null, "piedra", "piedra", "piedra"].forEach((j) => est.agregar(f(j)));
    assert.equal(est.cerrar().jugada, null);  // nunca hubo 4 seguidos
});

test("filtro: se confirma el ÚLTIMO gesto estable de la ventana", () => {
    const est = new Estabilizador({ fotogramasEstables: 3 });
    ["piedra", "piedra", "piedra", "papel", "papel", "papel", "papel", "tijera"].forEach((j) => est.agregar(f(j)));
    assert.deepEqual(est.cerrar(), { jugada: "papel", motivo: "estable" });
});

test("filtro: sin mano, ambigua, inestable e insuficiente se distinguen", () => {
    const a = new Estabilizador({ fotogramasEstables: 3 });
    Array(10).fill(f(null)).forEach((d) => a.agregar(d));
    assert.equal(a.cerrar().motivo, "sin_mano");
    const b = new Estabilizador({ fotogramasEstables: 3 });
    ["piedra", "papel", "tijera", "piedra", "papel"].forEach((j) => b.agregar(f(j)));
    assert.equal(b.cerrar().motivo, "inestable");
    const c = new Estabilizador({ fotogramasEstables: 3 });
    [amb, amb, amb, amb].forEach((d) => c.agregar(d));
    assert.equal(c.cerrar().motivo, "ambigua");
    const d = new Estabilizador({ fotogramasEstables: 3 });
    d.agregar(f("piedra"));
    assert.equal(d.cerrar(5).motivo, "insuficiente");
});

test("filtro: tras cerrar, el resultado queda bloqueado aunque cambie el gesto", () => {
    const est = new Estabilizador({ fotogramasEstables: 2 });
    est.agregar(f("piedra")); est.agregar(f("piedra"));
    const r = est.cerrar();
    for (let i = 0; i < 10; i++) assert.equal(est.agregar(f("papel")), false);
    assert.equal(est.cerrar(), r);
    assert.equal(r.jugada, "piedra");
});

// ---------------------------------------------------------------- flujo de menús (§13)
test("«¿Estás listo?» → NO vuelve al menú sin iniciar ronda", () => {
    const p = new Partida(CONFIG);
    assert.equal(p.jugar(0), true);
    assert.equal(p.estado, E.ASK_READY);
    p.listoNo(0);
    assert.equal(p.estado, E.GAME_MENU);
    assert.equal(p.ronda, 0);
    assert.equal(p.jugadaMichi, null);
});

test("«¿Estás listo?» → SÍ abre la selección de meta; metas 1/3/5/7 y validación", () => {
    const p = new Partida(CONFIG);
    p.jugar(0); p.listoSi(0);
    assert.equal(p.estado, E.SELECT_TARGET_WINS);
    assert.deepEqual([...METAS], [1, 3, 5, 7]);
    assert.equal(p.elegirMeta(0, 0), false);
    assert.equal(p.elegirMeta(2.5, 0), false);
    assert.equal(p.elegirMeta(99, 0), false);
    assert.equal(p.estado, E.SELECT_TARGET_WINS);
    assert.equal(p.elegirMeta(5, 0), true);
    assert.equal(p.meta, 5);
    assert.equal(p.estado, E.CAMERA_PERMISSION);
});

test("acciones fuera de su estado se ignoran (no hay dobles clics peligrosos)", () => {
    const p = new Partida(CONFIG);
    assert.equal(p.listoSi(0), false);
    assert.equal(p.elegirMeta(3, 0), false);
    assert.equal(p.empezarPartida(0), false);
    assert.equal(p.continuar(0), false);
    assert.equal(p.revancha(0), false);
    assert.equal(p.estado, E.GAME_MENU);
});

// ---------------------------------------------------------------- ronda
test("ronda: Michi bloquea su jugada ANTES de la cuenta y la revela en el 1", () => {
    const { p, reloj, cambios } = nuevaPartida(3, () => 0.5); // 0.5 → papel
    p.empezarPartida(reloj.t);
    assert.equal(p.estado, E.ROUND_PREPARE);
    assert.equal(p.jugadaMichi, "papel");
    assert.equal(animacionMichi(p), "idle");
    avanzarHasta(p, reloj, () => p.estado === E.COUNTDOWN_1_REVEAL_CAT);
    assert.deepEqual(cambios.slice(-4), [E.ROUND_PREPARE, E.COUNTDOWN_3, E.COUNTDOWN_2, E.COUNTDOWN_1_REVEAL_CAT]);
    assert.equal(animacionMichi(p), "papel");
    assert.equal(p.jugadaMichi, "papel");
});

test("ronda: los gestos durante el 3 y el 2 NO cuentan; sí desde el 1", () => {
    const { p, reloj } = nuevaPartida(3, () => 0.5);
    p.empezarPartida(reloj.t);
    avanzarHasta(p, reloj, () => p.estado === E.COUNTDOWN_3);
    assert.equal(p.registrarDecision(p.ronda, f("tijera")), false);
    avanzarHasta(p, reloj, () => p.estado === E.COUNTDOWN_1_REVEAL_CAT);
    assert.equal(p.registrarDecision(p.ronda, f("tijera")), true);
    assert.equal(p.registrarDecision(p.ronda - 1, f("tijera")), false); // inferencia vieja
});

test("ronda: la ventana dura VENTANA_CAPTURA desde el 1 y se resuelve una sola vez", () => {
    const { p, reloj } = nuevaPartida(3, () => 0.5);
    p.empezarPartida(reloj.t);
    avanzarHasta(p, reloj, () => p.estado === E.COUNTDOWN_1_REVEAL_CAT);
    const inicio = reloj.t;
    estable("tijera").forEach((d) => p.registrarDecision(p.ronda, d));
    avanzarHasta(p, reloj, () => p.estado === E.EVALUATE_ROUND);
    assert.ok(Math.abs(reloj.t - inicio - CONFIG.VENTANA_CAPTURA) <= 50);
    avanzarHasta(p, reloj, () => p.estado === E.ROUND_WIN_PLAYER);
    assert.deepEqual(p.marcador, { jugador: 1, michi: 0 });
    // Cambio de gesto después de confirmar: no modifica la ronda resuelta
    assert.equal(p.registrarDecision(p.ronda, f("piedra")), false);
    p._puntuar();
    assert.deepEqual(p.marcador, { jugador: 1, michi: 0 });
    assert.equal(p.historial.length, 1);
});

test("ronda: mismo gesto → empate, ningún marcador cambia", () => {
    const { p, reloj } = nuevaPartida(3, () => 0.5);
    p.empezarPartida(reloj.t);
    assert.equal(jugarRonda(p, reloj, estable("papel")), E.ROUND_TIE);
    assert.deepEqual(p.marcador, { jugador: 0, michi: 0 });
});

test("ronda: sin mano → no suma victoria ni derrota (NO DETECTÉ TU GESTO)", () => {
    const { p, reloj } = nuevaPartida(3, () => 0.5);
    p.empezarPartida(reloj.t);
    assert.equal(jugarRonda(p, reloj, Array(12).fill(f(null))), E.ROUND_INVALID_GESTURE);
    assert.equal(p.motivoCaptura, "sin_mano");
    assert.deepEqual(p.marcador, { jugador: 0, michi: 0 });
});

test("ronda: gesto ambiguo (dos manos distintas) → no suma y se repite", () => {
    const { p, reloj } = nuevaPartida(3, () => 0.5);
    p.empezarPartida(reloj.t);
    assert.equal(jugarRonda(p, reloj, Array(8).fill(amb)), E.ROUND_INVALID_GESTURE);
    assert.equal(p.motivoCaptura, "ambigua");
    assert.deepEqual(p.marcador, { jugador: 0, michi: 0 });
    avanzarHasta(p, reloj, () => p.estado === E.ROUND_PREPARE);
    assert.equal(p.ronda, 2);
});

test("ronda: detección incorrecta aislada no confirma jugada", () => {
    const { p, reloj } = nuevaPartida(3, () => 0.5);
    p.empezarPartida(reloj.t);
    const r = jugarRonda(p, reloj, [f(null), f(null), f("tijera"), f(null), f(null), f(null), f(null)]);
    assert.equal(r, E.ROUND_INVALID_GESTURE);
    assert.deepEqual(p.marcador, { jugador: 0, michi: 0 });
});

test("ronda: CONTINUAR salta la pausa del resultado", () => {
    const { p, reloj } = nuevaPartida(3, () => 0.5);
    p.empezarPartida(reloj.t);
    jugarRonda(p, reloj, estable("papel"));
    assert.equal(p.continuar(reloj.t), true);
    assert.equal(p.estado, E.WAIT_NEXT_ROUND);
    assert.equal(p.continuar(reloj.t), true);
    assert.equal(p.estado, E.ROUND_PREPARE);
});

// ---------------------------------------------------------------- finales (§13)
/** Juega hasta llevar el marcador al valor pedido (Michi siempre elige papel). */
function llevarMarcador(p, reloj, jugador, michi) {
    let g = 0, m = 0;
    while (g < jugador || m < michi) {
        avanzarHasta(p, reloj, () => p.estado === E.ROUND_PREPARE);
        const quiero = g < jugador ? GANA_A[p.jugadaMichi] : PIERDE_A[p.jugadaMichi];
        jugarRonda(p, reloj, estable(quiero));
        if (g < jugador) g++; else m++;
        // Un empate intermedio no cambia nada
        p.continuar(reloj.t);
    }
}

test("final: meta 3, marcador 2–1 a favor de Michi y gana Michi → 3–1, YOU LOSE", () => {
    const { p, reloj } = nuevaPartida(3, () => 0.5);
    p.empezarPartida(reloj.t);
    llevarMarcador(p, reloj, 1, 2);
    assert.deepEqual(p.marcador, { jugador: 1, michi: 2 });
    // Empate intermedio: no modifica el 2–1
    avanzarHasta(p, reloj, () => p.estado === E.ROUND_PREPARE);
    jugarRonda(p, reloj, estable(p.jugadaMichi));
    assert.deepEqual(p.marcador, { jugador: 1, michi: 2 });
    p.continuar(reloj.t);
    avanzarHasta(p, reloj, () => p.estado === E.ROUND_PREPARE);
    jugarRonda(p, reloj, estable(PIERDE_A[p.jugadaMichi]));
    assert.deepEqual(p.marcador, { jugador: 1, michi: 3 });
    avanzarHasta(p, reloj, () => p.estado === E.GAME_OVER_LOSE);
    assert.equal(animacionMichi(p), "feliz");
});

test("final: meta 3, marcador 2–2 y gana el jugador → 3–2, YOU WIN", () => {
    const { p, reloj } = nuevaPartida(3, () => 0.5);
    p.empezarPartida(reloj.t);
    llevarMarcador(p, reloj, 2, 2);
    avanzarHasta(p, reloj, () => p.estado === E.ROUND_PREPARE);
    jugarRonda(p, reloj, estable(GANA_A[p.jugadaMichi]));
    avanzarHasta(p, reloj, () => p.estado === E.GAME_OVER_WIN);
    assert.deepEqual(p.marcador, { jugador: 3, michi: 2 });
    assert.equal(animacionMichi(p), "triste");
});

test("final: meta 1 termina en la primera ronda decisiva; VOLVER A JUGAR conserva la meta", () => {
    const { p, reloj } = nuevaPartida(1, () => 0.1); // 0.1 → piedra
    p.empezarPartida(reloj.t);
    jugarRonda(p, reloj, estable("papel"));
    avanzarHasta(p, reloj, () => p.estado === E.GAME_OVER_WIN);
    assert.equal(p.revancha(reloj.t), true);
    assert.equal(p.estado, E.CAMERA_PERMISSION);
    assert.equal(p.meta, 1);
    p.empezarPartida(reloj.t);
    assert.deepEqual(p.marcador, { jugador: 0, michi: 0 });
});

test("final: CAMBIAR META vuelve a la selección", () => {
    const { p, reloj } = nuevaPartida(1, () => 0.1);
    p.empezarPartida(reloj.t);
    jugarRonda(p, reloj, estable("tijera"));
    avanzarHasta(p, reloj, () => p.estado === E.GAME_OVER_LOSE);
    assert.equal(p.cambiarMeta(reloj.t), true);
    assert.equal(p.estado, E.SELECT_TARGET_WINS);
});

// ---------------------------------------------------------------- pausa, errores y salida
test("pausa: congela el reloj y reanuda en el mismo estado", () => {
    const { p, reloj } = nuevaPartida(3, () => 0.5);
    p.empezarPartida(reloj.t);
    avanzarHasta(p, reloj, () => p.estado === E.COUNTDOWN_2);
    const antes = p.transcurrido(reloj.t);
    p.pausar(reloj.t);
    assert.equal(p.estado, E.PAUSED);
    reloj.t += 60000; p.actualizar(reloj.t);
    assert.equal(p.estado, E.PAUSED);
    assert.equal(p.registrarDecision(p.ronda, f("piedra")), false);
    p.reanudar(reloj.t);
    assert.equal(p.estado, E.COUNTDOWN_2);
    assert.equal(p.transcurrido(reloj.t), antes);
});

test("error de cámara o de modelo: CAMERA_ERROR legible y se puede reintentar sin perder la meta", () => {
    const { p, reloj } = nuevaPartida(5);
    p.fallar("Permiso de cámara denegado.", reloj.t);
    assert.equal(p.estado, E.CAMERA_ERROR);
    assert.equal(p.error.mensaje, "Permiso de cámara denegado.");
    assert.equal(p.necesitaCamara(), false);
    p.reintentarCamara(reloj.t);
    assert.equal(p.estado, E.CAMERA_PERMISSION);
    assert.equal(p.meta, 5);
});

test("salir: RETURN_TO_CONSOLE no necesita cámara ni acepta fotogramas", () => {
    const { p, reloj } = nuevaPartida(3);
    p.empezarPartida(reloj.t);
    avanzarHasta(p, reloj, () => p.estado === E.COUNTDOWN_1_REVEAL_CAT);
    p.salirAConsola(reloj.t);
    assert.equal(p.estado, E.RETURN_TO_CONSOLE);
    assert.equal(p.necesitaCamara(), false);
    assert.equal(p.registrarDecision(p.ronda, f("piedra")), false);
    reloj.t += 10000; p.actualizar(reloj.t);
    assert.equal(p.estado, E.RETURN_TO_CONSOLE);
});

test("partida simulada completa de principio a fin (decisiones aleatorias, sin webcam)", () => {
    for (let s = 0; s < 30; s++) {
        let semilla = s + 1;
        const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
        const { p, reloj } = nuevaPartida(METAS[s % 4], azar);
        p.empezarPartida(reloj.t);
        let rondas = 0;
        while (![E.GAME_OVER_WIN, E.GAME_OVER_LOSE].includes(p.estado)) {
            const r = azar();
            const frames = r < 0.15 ? Array(10).fill(f(null)) : estable(JUGADAS[Math.floor(azar() * 3)]);
            jugarRonda(p, reloj, frames);
            avanzarHasta(p, reloj, () => [E.ROUND_PREPARE, E.GAME_OVER_WIN, E.GAME_OVER_LOSE].includes(p.estado));
            assert.ok(++rondas < 200);
        }
        const { jugador, michi } = p.marcador;
        assert.equal(Math.max(jugador, michi), p.meta);
        assert.ok(Math.min(jugador, michi) < p.meta);
        assert.equal(p.estado === E.GAME_OVER_WIN, jugador === p.meta);
        // El historial suma exactamente el marcador
        assert.equal(p.historial.filter((h) => h.resultado === "gana").length, jugador);
        assert.equal(p.historial.filter((h) => h.resultado === "pierde").length, michi);
    }
});
