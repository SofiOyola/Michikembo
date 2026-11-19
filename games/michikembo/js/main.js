// ============================================================
// MICHIKEMBO — Arranque, bucle principal e interfaz
//
// Une la máquina de estados (maquina.js), el detector (ONNX o simulado),
// la cámara, Michi y el sonido. Todo se mueve desde un único
// requestAnimationFrame: no hay temporizadores sueltos.
//
// La máquina decide; este archivo solo REACCIONA a cada estado
// (pantallas, sonidos, cámara) y traduce clics/teclas en acciones.
//
// Parámetros de URL:
//   ?preview=1  → demostración para la consola: sin cámara, sin sonido, juega sola.
//   ?dev=1      → abre con el modo desarrollo visible.
// Mensajes con la consola (postMessage):
//   recibe {tipo:"pausar"|"reanudar"|"detener"}   envía {origen:"michikembo", tipo:"salir"|"listo"}
// ============================================================

import { CONFIG } from "./config.js";
import { ETIQUETAS, CLASES_MODELO } from "./reglas.js";
import { decidirFotograma } from "./estabilizador.js";
import { Partida, E, METAS, animacionMichi } from "./maquina.js";
import { crearDetector } from "./detector/index.js";
import { Camara } from "./camara.js";
import { Michi } from "./michi.js";
import { crearAudio, musicaDeEstado, EFECTO_RESULTADO } from "./sonido.js";

// ---------- Referencias del DOM ----------
const $ = (id) => document.getElementById(id);
const body = document.body;
const ui = {
    puntosJugador: $("puntosJugador"), puntosMichi: $("puntosMichi"),
    pipsJugador: $("pipsJugador"), pipsMichi: $("pipsMichi"),
    chipMeta: $("chipMeta"), pie: $("pie"),
    aviso: $("aviso"), subaviso: $("subaviso"), cuenta: $("cuenta"), reloj: $("reloj").firstElementChild,
    cartaJugador: $("cartaJugador"), cartaMichi: $("cartaMichi"), bocadillo: $("bocadillo"),
    lecturaJugada: $("lecturaJugada"), barra: $("barraEstable"),
    manoSimulada: $("manoSimulada"), textoSinCamara: $("textoSinCamara"), etiquetaDetector: $("etiquetaDetector"),
    capa: $("capa"), video: $("video"),
    pantallas: {
        menu: $("pantallaMenu"), listo: $("pantallaListo"), meta: $("pantallaMeta"), camara: $("pantallaCamara"),
        fin: $("pantallaFin"), pausa: $("pantallaPausa"), error: $("pantallaError"),
        ajustes: $("pantallaAjustes"), adios: $("pantallaAdios"),
    },
};
const ctxCapa = ui.capa.getContext("2d");

// ---------- Modo de ejecución ----------
const params = new URLSearchParams(location.search);
const PREVIEW = params.get("preview") === "1";
const INCRUSTADO = window.parent !== window;
if (PREVIEW) body.classList.add("preview");

// ---------- Ajustes persistentes (localStorage con try/catch) ----------
const CLAVE_AJUSTES = "michikembo.ajustes.v2";
const CLAVE_CAMARA_EXPLICADA = "michikembo.camaraExplicada";
function leerAjustes() {
    const base = { detector: CONFIG.DETECTOR_POR_DEFECTO, camara: true, espejo: true, dev: false, meta: CONFIG.META_POR_DEFECTO };
    try { return { ...base, ...JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || "{}") }; } catch { return base; }
}
function guardarAjustes() {
    if (PREVIEW) return;
    try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes)); } catch { /* almacenamiento bloqueado */ }
}
function leerBandera(clave) { try { return localStorage.getItem(clave) === "1"; } catch { return false; } }
function ponerBandera(clave) { try { localStorage.setItem(clave, "1"); } catch { /* sin almacenamiento */ } }

const ajustes = PREVIEW
    ? { detector: "simulado-aleatorio", camara: false, espejo: true, dev: false, meta: 3 }
    : leerAjustes();
if (params.get("dev") === "1") ajustes.dev = true;

// ---------- Objetos del juego ----------
// Audio: en la vista previa de la consola no se crea (la preview es muda).
// Volúmenes y silencio se guardan aparte (mk.audio.v1), compartidos con la consola.
const audio = PREVIEW ? null : crearAudio();
if (audio && ajustes.sonido === false && !leerBandera("michikembo.audioMigrado")) audio.ajustar({ silencio: true }); // ajuste antiguo
if (audio) ponerBandera("michikembo.audioMigrado");
delete ajustes.sonido;
const efecto = (id) => audio?.efecto(id);
window.michikemboAudio = () => audio?.estado() ?? null;   // diagnóstico y pruebas automáticas
const camara = new Camara(ui.video);
const michi = new Michi($("michi"), "../../assets/michi/");
let detector = null;
let detectorListo = null;          // promesa de iniciar() del detector actual
let estadoDetector = "pendiente";  // pendiente | cargando | listo | error
let errorDetector = "";
let inferenciaOcupada = false;
let ultimaInferencia = 0;
let ultimasDetecciones = [];
let ultimaDecision = null;
let manoManual = null;
let camaraPedida = false;          // el jugador pulsó ACTIVAR CÁMARA en esta visita
let preparando = false;            // evita abrir la cámara dos veces a la vez

const partida = new Partida({ ...CONFIG, META_POR_DEFECTO: ajustes.meta }, { alCambiar: alCambiarEstado });

const esSimulado = () => ajustes.detector !== "onnx";
const umbralDecision = () => (esSimulado() ? CONFIG.CONFIANZA_SIMULADO : detector?.umbral ?? 0.5);

// ============================================================
// Detector y cámara
// ============================================================
function prepararDetector() {
    detector?.liberar();
    detector = crearDetector(ajustes.detector);
    detector.mostrarMano?.(manoManual);
    estadoDetector = "cargando";
    errorDetector = "";
    const este = detector;
    detectorListo = detector.iniciar().then(() => {
        if (este === detector) estadoDetector = "listo";
        actualizarPantallaCamara();
    }, (e) => {
        if (este === detector) { estadoDetector = "error"; errorDetector = e.message; }
        actualizarPantallaCamara();
        throw e;
    });
    detectorListo.catch(() => {}); // el error se muestra al preparar la partida
    body.classList.toggle("modo-manual", ajustes.detector === "simulado-manual");
    ui.etiquetaDetector.textContent = {
        "simulado-manual": "simulado · manual",
        "simulado-aleatorio": "simulado · aleatorio",
        onnx: "modelo ONNX",
    }[ajustes.detector];
}

/** La cámara es obligatoria con el modelo real y opcional en modo simulado. */
const camaraObligatoria = () => !esSimulado();

async function encenderCamara() {
    if (PREVIEW || (!camaraObligatoria() && !ajustes.camara)) return;
    try {
        await camara.abrir();
        body.classList.add("camara-on");
    } catch (e) {
        body.classList.remove("camara-on");
        if (camaraObligatoria()) throw e;
        ui.textoSinCamara.textContent = `${e.message} El modo simulado sigue funcionando.`;
    }
}

function apagarCamara() {
    camara.cerrar();
    body.classList.remove("camara-on");
    ui.textoSinCamara.textContent = PREVIEW ? "Demostración automática"
        : esSimulado() && !ajustes.camara ? "Cámara apagada (modo simulado)" : "La cámara se enciende al jugar";
}

camara.alTerminar = () => {
    if (camaraObligatoria() && partida.necesitaCamara()) {
        partida.fallar("La cámara se desconectó o la tomó otra aplicación.", performance.now());
    } else apagarCamara();
};

/**
 * CAMERA_PERMISSION: carga el detector y abre la cámara tras una acción
 * consciente del jugador. Si algo falla, la máquina pasa a CAMERA_ERROR.
 */
async function prepararCamaraYModelo() {
    if (preparando || partida.estado !== E.CAMERA_PERMISSION) return;
    preparando = true;
    camaraPedida = true;
    ponerBandera(CLAVE_CAMARA_EXPLICADA);
    actualizarPantallaCamara();
    try {
        if (estadoDetector === "error") prepararDetector(); // reintento tras un fallo
        await detectorListo;
        if (partida.estado !== E.CAMERA_PERMISSION) return;
        await encenderCamara();
        if (partida.estado !== E.CAMERA_PERMISSION) { apagarCamara(); return; }
    } catch (e) {
        const tipo = estadoDetector === "error" ? "modelo" : "camara";
        partida.fallar(e.message, performance.now(), tipo);
        return;
    } finally {
        preparando = false;
        actualizarPantallaCamara();
    }
}

/** Texto y botones de la pantalla de cámara según lo que ya está listo. */
function actualizarPantallaCamara() {
    if (partida.estado !== E.CAMERA_PERMISSION) return;
    const explicada = leerBandera(CLAVE_CAMARA_EXPLICADA);
    const necesitaCam = camaraObligatoria() || ajustes.camara;
    const camOk = camara.activa || !necesitaCam;
    const listo = estadoDetector === "listo" && camOk && camaraPedida && !preparando;
    $("explicacionCamara").hidden = explicada && camaraPedida;
    $("pasoModelo").textContent = {
        pendiente: "Detector: esperando…", cargando: "Detector: cargando…",
        listo: `Detector: listo${esSimulado() ? " (simulado)" : ""}`, error: "Detector: error",
    }[estadoDetector];
    $("pasoModelo").className = estadoDetector === "listo" ? "ok" : estadoDetector === "error" ? "mal" : "";
    $("pasoCamara").textContent = !necesitaCam ? "Cámara: no se usa (modo simulado)"
        : camara.activa ? "Cámara: encendida" : preparando ? "Cámara: esperando permiso…" : "Cámara: apagada";
    $("pasoCamara").className = camara.activa || !necesitaCam ? "ok" : "";
    $("btnActivarCamara").hidden = camaraPedida;
    $("btnEmpezar").hidden = !camaraPedida;
    $("btnEmpezar").disabled = !listo;
    $("consejoCamara").hidden = !camaraPedida;
    (camaraPedida ? $("btnEmpezar") : $("btnActivarCamara")).focus?.();
}

// ============================================================
// Reacciones a cada cambio de estado (pantallas, sonidos, cámara)
// ============================================================
const PANTALLA_DE = {
    [E.GAME_MENU]: "menu", [E.ASK_READY]: "listo", [E.SELECT_TARGET_WINS]: "meta",
    [E.CAMERA_PERMISSION]: "camara", [E.GAME_OVER_WIN]: "fin", [E.GAME_OVER_LOSE]: "fin",
    [E.PAUSED]: "pausa", [E.CAMERA_ERROR]: "error", [E.RETURN_TO_CONSOLE]: "adios",
};

function alCambiarEstado(nuevo, anterior, p) {
    const t = performance.now();
    body.dataset.estado = nuevo;
    body.dataset.resultado = p.resultado || "";

    // Cámara: solo en los estados que la necesitan (y nunca en la preview)
    if (!p.necesitaCamara() && camara.activa) apagarCamara();
    if (nuevo !== E.PAUSED && anterior === E.PAUSED) ocultarPantallas();

    switch (nuevo) {
        case E.GAME_MENU:
            camaraPedida = false;
            limpiarCentro();
            break;
        case E.CAMERA_PERMISSION:
            camaraPedida = camara.activa;  // en VOLVER A JUGAR la cámara puede seguir abierta
            limpiarCentro();
            break;
        case E.ROUND_PREPARE:
            efecto("boton");
            ui.cuenta.textContent = "";
            ui.aviso.textContent = `RONDA ${p.ronda}`;
            ui.subaviso.textContent = p.ronda === 1
                ? (ajustes.detector === "simulado-manual" ? "Prepara tu jugada con 1, 2 o 3" : "Encuadra UNA mano frente a la cámara")
                : "¡Prepárate!";
            ui.cartaJugador.className = "carta"; ui.cartaJugador.textContent = "?";
            ui.cartaMichi.className = "carta"; ui.cartaMichi.textContent = "?";
            ultimasDetecciones = []; ultimaDecision = null;
            break;
        case E.COUNTDOWN_3:
        case E.COUNTDOWN_2:
            mostrarNumero(p.numeroCuenta());
            ui.aviso.textContent = "";
            ui.subaviso.textContent = "Michi ya eligió en secreto…";
            efecto(p.numeroCuenta() === 3 ? "cuenta_3" : "cuenta_2");
            break;
        case E.COUNTDOWN_1_REVEAL_CAT:
            mostrarNumero(1);
            ui.aviso.textContent = "¡MUESTRA TU MANO!";
            ui.subaviso.textContent = "Mantén el gesto quieto";
            ui.cartaMichi.textContent = ETIQUETAS[p.jugadaMichi].emoji;
            ui.cartaMichi.classList.add("voltear");
            efecto("reveal");   // el «1» y la revelación del gato suenan a la vez
            detector.nuevaRonda();
            break;
        case E.CAPTURE_PLAYER_GESTURE:
            ui.cuenta.textContent = "";
            break;
        case E.EVALUATE_ROUND:
            ui.aviso.textContent = "…";
            ui.subaviso.textContent = "";
            ui.cartaJugador.textContent = p.jugadaJugador ? ETIQUETAS[p.jugadaJugador].emoji : "∅";
            ui.cartaJugador.classList.add("voltear");
            break;
        case E.ROUND_WIN_PLAYER:
        case E.ROUND_WIN_CAT:
        case E.ROUND_TIE:
        case E.ROUND_INVALID_GESTURE:
            if (anterior === E.EVALUATE_ROUND) mostrarResultadoRonda(p);
            break;
        case E.WAIT_NEXT_ROUND:
            ui.aviso.textContent = "SIGUIENTE RONDA…";
            ui.subaviso.textContent = "";
            break;
        case E.GAME_OVER_WIN:
        case E.GAME_OVER_LOSE:
            mostrarFin(p, nuevo === E.GAME_OVER_WIN);
            break;
        case E.CAMERA_ERROR:
            apagarCamara();
            camaraPedida = false;
            $("mensajeError").textContent = p.error?.mensaje || "Error desconocido.";
            $("btnErrorSimulado").hidden = esSimulado();
            break;
        case E.RETURN_TO_CONSOLE:
            liberarTodo();
            break;
    }

    // Pantalla superpuesta que corresponde al estado (o ninguna durante la ronda)
    const pantalla = PANTALLA_DE[nuevo];
    if (PREVIEW && pantalla) ocultarPantallas();
    else if (pantalla) mostrar(pantalla);
    else if (!pantallaVisible()?.match(/ajustes/)) ocultarPantallas();
    if (nuevo === E.CAMERA_PERMISSION) actualizarPantallaCamara();

    // Música del estado (una sola a la vez; la misma no se reinicia)
    const tema = musicaDeEstado(nuevo);
    if (tema !== undefined && nuevo !== E.RETURN_TO_CONSOLE) audio?.musica(tema);

    actualizarMarcador(p, anterior === E.EVALUATE_ROUND);
    michi.poner(animacionMichi(p), t);
    ui.bocadillo.textContent = textoBocadillo(p);
}

function limpiarCentro() {
    ui.cuenta.textContent = "";
    ui.aviso.textContent = "";
    ui.subaviso.textContent = "";
    ui.cartaJugador.className = "carta"; ui.cartaJugador.textContent = "?";
    ui.cartaMichi.className = "carta"; ui.cartaMichi.textContent = "?";
}

function mostrarNumero(n) {
    ui.cuenta.textContent = n ?? "";
    ui.cuenta.classList.remove("pulso");
    void ui.cuenta.offsetWidth;
    ui.cuenta.classList.add("pulso");
}

const TEXTOS_RESULTADO = {
    gana: ["¡GANASTE LA RONDA!", "+1 para ti"],
    pierde: ["MICHI GANA LA RONDA", "+1 para Michi"],
    empate: ["EMPATE", "Nadie suma. Se juega otra ronda."],
    sin_jugada: ["NO DETECTÉ TU GESTO", ""],
};
const MOTIVOS_SIN_JUGADA = {
    sin_mano: "No vi ninguna mano. Nadie suma: vuelve a intentarlo.",
    ambigua: "AMBIGUO: vi manos con gestos distintos. Muestra solo una. Nadie suma.",
    inestable: "Tu gesto cambió demasiado. Mantenlo quieto tras el 1. Nadie suma.",
    insuficiente: "La cámara o el modelo van lentos y no alcancé a verte. Nadie suma.",
};

function mostrarResultadoRonda(p) {
    const [titulo, sub] = TEXTOS_RESULTADO[p.resultado];
    ui.aviso.textContent = p.resultado === "sin_jugada" && p.motivoCaptura === "ambigua" ? "AMBIGUO" : titulo;
    ui.subaviso.textContent = p.resultado === "sin_jugada" ? MOTIVOS_SIN_JUGADA[p.motivoCaptura] : sub;
    if (p.resultado === "gana") { ui.cartaJugador.classList.add("ganadora"); ui.cartaMichi.classList.add("perdedora"); }
    if (p.resultado === "pierde") { ui.cartaMichi.classList.add("ganadora"); ui.cartaJugador.classList.add("perdedora"); }
    efecto(EFECTO_RESULTADO[p.resultado]);
}

function mostrarFin(p, gano) {
    const titulo = $("tituloFin");
    titulo.textContent = gano ? "YOU WIN" : "YOU LOSE";
    titulo.className = `titulo-fin ${gano ? "gana" : "pierde"}`;
    $("marcadorFin").textContent = `MICHI ${p.marcador.michi} – ${p.marcador.jugador} JUGADOR`;
    $("metaFin").textContent = `Primero en ganar ${p.meta}`;
    const src = michi.sprites?.[gano ? "triste" : "feliz"]?.src;
    $("finMichi").hidden = !src;
    if (src) { $("finMichi").src = src; $("finMichi").alt = gano ? "Michi triste" : "Michi feliz"; }
    const simbolo = (j) => (j ? ETIQUETAS[j].emoji : "∅");
    const texto = { gana: "ganaste", pierde: "ganó Michi", empate: "empate", sin_jugada: "sin gesto" };
    $("historialFin").innerHTML = "";
    for (const h of p.historial) {
        const li = document.createElement("li");
        li.textContent = `R${h.ronda}: Michi ${simbolo(h.michi)} · tú ${simbolo(h.jugador)} → ${texto[h.resultado]} (${h.marcador.michi}–${h.marcador.jugador})`;
        $("historialFin").appendChild(li);
    }
    ui.aviso.textContent = gano ? "YOU WIN" : "YOU LOSE";
    ui.subaviso.textContent = "";
    if (gano && !PREVIEW) confeti();   // la música final (final_win / final_lose) la pone alCambiarEstado
    apagarCamara(); // fin de partida: la cámara se apaga hasta VOLVER A JUGAR
}

function textoBocadillo(p) {
    const e = p.pausada ? p.pausa?.estado : p.estado;
    if (e === E.ROUND_PREPARE || e === E.COUNTDOWN_3 || e === E.COUNTDOWN_2) return "Ya elegí… 🤫";
    if (e === E.COUNTDOWN_1_REVEAL_CAT || e === E.CAPTURE_PLAYER_GESTURE) return michi.frase();
    if (e === E.ROUND_TIE) return "¡Pensamos igual!";
    if (e === E.ROUND_INVALID_GESTURE) return "¿Y tu mano? No la vi bien.";
    if (e === E.WAIT_NEXT_ROUND) return "Otra vez, otra vez.";
    if (e === E.CAMERA_ERROR) return "Algo no funciona…";
    if (e === E.GAME_OVER_LOSE) return "¡Gané la partida!";
    if (e === E.GAME_OVER_WIN) return "Me ganaste… bien jugado.";
    if (e === E.ROUND_WIN_PLAYER || e === E.ROUND_WIN_CAT) return michi.frase();
    return "Miau… ¿jugamos?";
}

function actualizarMarcador(p, animar) {
    const meta = p.meta;
    const pips = (n) => Array.from({ length: Math.min(meta, 15) }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("");
    if (animar && ui.puntosJugador.textContent !== String(p.marcador.jugador)) rebotar(ui.puntosJugador.parentElement.parentElement);
    if (animar && ui.puntosMichi.textContent !== String(p.marcador.michi)) rebotar(ui.puntosMichi.parentElement.parentElement);
    ui.puntosJugador.textContent = p.marcador.jugador;
    ui.puntosMichi.textContent = p.marcador.michi;
    ui.pipsJugador.innerHTML = pips(p.marcador.jugador);
    ui.pipsMichi.innerHTML = pips(p.marcador.michi);
    const texto = `PRIMERO EN GANAR ${meta}`;
    ui.chipMeta.textContent = texto;
    ui.pie.textContent = p.ronda > 0 && p.enPartida() ? `${texto} · RONDA ${p.ronda}` : texto;
}

function rebotar(el) {
    el.classList.remove("salto");
    void el.offsetWidth;
    el.classList.add("salto");
}

function confeti() {
    const colores = ["#ff8fb0", "#7fd8ff", "#ffd166", "#b28cff", "#fff"];
    for (let i = 0; i < 60; i++) {
        const c = document.createElement("i");
        c.className = "confeti";
        c.style.left = `${Math.random() * 100}%`;
        c.style.background = colores[i % colores.length];
        c.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
        c.style.animationDelay = `${Math.random() * 0.5}s`;
        $("juego").appendChild(c);
        setTimeout(() => c.remove(), 4000);
    }
}

// ============================================================
// Pantallas
// ============================================================
function mostrar(nombre) {
    ocultarPantallas();
    ui.pantallas[nombre].classList.add("visible");
    ui.pantallas[nombre].querySelector("button.principal:not([hidden]):not([disabled]), button:not([hidden]), select")?.focus();
}
function ocultarPantallas() {
    Object.values(ui.pantallas).forEach((p) => p.classList.remove("visible"));
}
function pantallaVisible() {
    return Object.entries(ui.pantallas).find(([, p]) => p.classList.contains("visible"))?.[0] || null;
}

function construirMetas() {
    const cont = $("metas");
    cont.innerHTML = "";
    for (const n of METAS) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "boton meta";
        b.innerHTML = `<b>${n}</b><small>${n === 1 ? "victoria" : "victorias"}</small>`;
        b.setAttribute("aria-label", `Primero en ganar ${n}`);
        b.onclick = () => elegirMeta(n);
        cont.appendChild(b);
    }
}

function elegirMeta(n) {
    if (partida.elegirMeta(n, performance.now())) {
        efecto("boton");
        ajustes.meta = n;
        guardarAjustes();
        // Si ya se explicó la cámara en otra visita, se pide directamente.
        if (leerBandera(CLAVE_CAMARA_EXPLICADA) || PREVIEW) prepararCamaraYModelo();
    }
}

// ============================================================
// Mano simulada (modo manual)
// ============================================================
function ponerManoManual(jugada) {
    manoManual = jugada || null;
    detector?.mostrarMano?.(manoManual);
    ui.manoSimulada.textContent = manoManual ? ETIQUETAS[manoManual].emoji : "?";
    ui.manoSimulada.classList.remove("cambio");
    void ui.manoSimulada.offsetWidth;
    ui.manoSimulada.classList.add("cambio");
    document.querySelectorAll("#controlesSimulados button").forEach((b) => {
        b.classList.toggle("activo", (b.dataset.mano || null) === manoManual);
    });
}

// ============================================================
// Bucle principal: estado → inferencia → dibujo
// ============================================================
const ESTADOS_INFERENCIA = new Set([
    E.CAMERA_PERMISSION, E.ROUND_PREPARE, E.COUNTDOWN_3, E.COUNTDOWN_2, E.COUNTDOWN_1_REVEAL_CAT, E.CAPTURE_PLAYER_GESTURE,
]);

function bucle(t) {
    partida.actualizar(t);

    // Barra de la ventana de captura (empieza en el "1")
    const prog = partida.progresoCaptura(t);
    ui.reloj.style.transform = `scaleX(${partida.capturando() ? 1 - prog : 0})`;

    // Inferencia asíncrona sin bloquear la interfaz. Se ejecuta durante la
    // preparación para mostrar lo que "ve" el detector, pero solo PUNTÚA en
    // la ventana de captura (registrarDecision rechaza todo lo demás).
    const listo = estadoDetector === "listo" && detector;
    const quiereVer = ESTADOS_INFERENCIA.has(partida.estado) && (camara.activa || esSimulado());
    if (listo && quiereVer && !inferenciaOcupada && t - ultimaInferencia >= 1000 / CONFIG.FPS_DETECCION) {
        inferenciaOcupada = true;
        ultimaInferencia = t;
        const ronda = partida.ronda;
        const det = detector;
        det.detectar(ui.video).then((detecciones) => {
            if (det !== detector) return; // se cambió de detector mientras tanto
            ultimasDetecciones = detecciones;
            ultimaDecision = decidirFotograma(detecciones, umbralDecision());
            partida.registrarDecision(ronda, ultimaDecision);
            mostrarLectura(ultimaDecision);
        }).catch((e) => {
            partida.fallar(`Error del detector: ${e.message}`, performance.now(), "modelo");
        }).finally(() => {
            inferenciaOcupada = false;
        });
    }
    if (!quiereVer && ![E.EVALUATE_ROUND].includes(partida.estado) && ultimasDetecciones.length) {
        ultimasDetecciones = [];
    }

    ui.barra.style.width = `${partida.estabilizador.progreso() * 100}%`;
    body.classList.toggle("fijada", !!partida.estabilizador.candidata() && partida.capturando());
    dibujarCajas();
    if (ajustes.dev) actualizarDiagnostico(t);
    michi.dibujar(t);
    requestAnimationFrame(bucle);
}

function mostrarLectura(decision) {
    if (decision.jugada) ui.lecturaJugada.textContent = `${ETIQUETAS[decision.jugada].emoji} ${ETIQUETAS[decision.jugada].texto.toUpperCase()}`;
    else ui.lecturaJugada.textContent = decision.motivo === "ambigua" ? "AMBIGUO" : "NADA";
}

/** Cajas del detector sobre la cámara (solo en modo desarrollo). */
function dibujarCajas() {
    const { width: w, height: h } = ui.capa;
    ctxCapa.clearRect(0, 0, w, h);
    if (!ajustes.dev) return;
    const umbral = umbralDecision();
    for (const d of ultimasDetecciones) {
        const jugada = CLASES_MODELO[d.clase];
        const ok = d.confianza >= umbral;
        ctxCapa.strokeStyle = ok ? "#5fe0b0" : "#ff5d8c";
        ctxCapa.lineWidth = 4;
        ctxCapa.strokeRect(d.caja.x * w, d.caja.y * h, d.caja.w * w, d.caja.h * h);
        // Si el canvas está en espejo (CSS), el texto se dibuja invertido para leerse bien
        ctxCapa.save();
        ctxCapa.fillStyle = ok ? "#5fe0b0" : "#ff5d8c";
        ctxCapa.font = "16px 'Press Start 2P', monospace";
        const etiqueta = `${ETIQUETAS[jugada].texto} ${Math.round(d.confianza * 100)}%`;
        if (ajustes.espejo) { ctxCapa.scale(-1, 1); ctxCapa.fillText(etiqueta, -(d.caja.x + d.caja.w) * w + 4, d.caja.y * h - 8); }
        else ctxCapa.fillText(etiqueta, d.caja.x * w + 4, d.caja.y * h - 8);
        ctxCapa.restore();
    }
}

let ultimoDiag = 0;
function actualizarDiagnostico(t) {
    if (t - ultimoDiag < 150) return;
    ultimoDiag = t;
    const info = detector?.info?.();
    const s = detector?.stats;
    const est = partida.estabilizador;
    $("dModelo").textContent = esSimulado() ? `simulado (${ajustes.detector.split("-")[1]})`
        : info ? `${info.version} · rev ${info.revision} · ${info.estado}` : estadoDetector;
    $("dUmbral").textContent = esSimulado() ? `conf ${CONFIG.CONFIANZA_SIMULADO}` : info ? `conf ${info.umbral} · IoU ${info.umbralIou}` : "—";
    $("dBackend").textContent = s?.backend || (esSimulado() ? "sin modelo" : "—");
    $("dEstado").textContent = partida.estado;
    $("dInstante").textContent = ultimaDecision ? (ultimaDecision.jugada || ultimaDecision.motivo.toUpperCase()) : "—";
    $("dEstable").textContent = est.resultado ? `${est.resultado.jugada || "—"} (${est.resultado.motivo})` : est.candidata() || "—";
    $("dConf").textContent = ultimaDecision?.confianza ? ultimaDecision.confianza.toFixed(2) : "—";
    $("dCajas").textContent = s ? `${s.cajas}` : `${ultimasDetecciones.length}`;
    $("dFps").textContent = s ? `${s.fps.toFixed(1)} fps · ${s.latenciaMs.toFixed(0)} ms` : "—";
    const c = est.conteo;
    $("dVentana").textContent = `${est.total} fot. · K=${est.k} · nada ${c.nada} · amb ${c.ambigua}`;
    const a = audio?.estado();
    $("dAudio").textContent = a ? `${a.contexto} · ${a.musica || "sin música"}${a.fuente ? ` (${a.fuente})` : ""}${a.avisos.length ? " · ⚠" : ""}` : "sin audio";
}

// ============================================================
// Entradas: botones, teclado y mensajes de la consola
// ============================================================
const ahora = () => performance.now();

function salir() {
    efecto("boton");
    partida.salirAConsola(ahora());
    if (INCRUSTADO) window.parent.postMessage({ origen: "michikembo", tipo: "salir" }, "*");
}

function pausar() { if (partida.pausar(ahora())) efecto("boton"); }
function reanudar() { if (partida.reanudar(ahora())) efecto("boton"); }

function volverAlMenu() { efecto("boton"); partida.volverAlMenu(ahora()); }

function enlazarEntradas() {
    $("btnJugar").onclick = () => { efecto("boton"); partida.jugar(ahora()); };
    $("btnSi").onclick = () => { efecto("boton"); partida.listoSi(ahora()); };
    $("btnNo").onclick = () => { efecto("boton"); partida.listoNo(ahora()); };
    $("btnMetaVolver").onclick = () => { efecto("boton"); partida.volverDeMeta(ahora()); };
    $("btnActivarCamara").onclick = () => { efecto("boton"); prepararCamaraYModelo(); };
    $("btnEmpezar").onclick = () => { efecto("boton"); partida.empezarPartida(ahora()); };
    $("btnCamaraVolver").onclick = volverAlMenu;
    $("btnContinuar").onclick = () => partida.continuar(ahora());
    $("btnRevancha").onclick = () => { efecto("boton"); if (partida.revancha(ahora())) prepararCamaraYModelo(); };
    $("btnCambiarMeta").onclick = () => { efecto("boton"); partida.cambiarMeta(ahora()); };
    $("btnReintentar").onclick = () => { efecto("boton"); if (partida.reintentarCamara(ahora())) prepararCamaraYModelo(); };
    $("btnErrorSimulado").onclick = () => {
        ajustes.detector = "simulado-manual";
        guardarAjustes();
        sincronizarAjustesUI();
        prepararDetector();
        if (partida.reintentarCamara(ahora())) prepararCamaraYModelo();
    };
    $("btnErrorMenu").onclick = volverAlMenu;
    $("btnAjustes").onclick = () => { efecto("boton"); mostrar("ajustes"); };
    $("btnCerrarAjustes").onclick = () => { efecto("boton"); mostrar(PANTALLA_DE[partida.estado] || "menu"); };
    $("btnSalir").onclick = salir;
    $("btnSalirArriba").onclick = salir;
    $("btnFinSalir").onclick = salir;
    $("btnPausaSalir").onclick = salir;
    $("btnPausaMenu").onclick = volverAlMenu;
    $("btnSeguir").onclick = reanudar;
    $("btnVolverDeAdios").onclick = () => partida.volverAlMenu(ahora()) || location.reload();
    $("btnPausa").onclick = () => (partida.pausada ? reanudar() : pausar());
    $("btnSonido").onclick = alternarSonido;
    $("btnDiag").onclick = alternarDev;

    document.querySelectorAll("#controlesSimulados button").forEach((b) => {
        b.onclick = () => ponerManoManual(b.dataset.mano);
    });

    $("selDetector").onchange = (e) => { ajustes.detector = e.target.value; guardarAjustes(); prepararDetector(); apagarCamara(); };
    $("chkCamara").onchange = (e) => { ajustes.camara = e.target.checked; guardarAjustes(); if (!e.target.checked && esSimulado()) apagarCamara(); };
    $("chkEspejo").onchange = (e) => { ajustes.espejo = e.target.checked; guardarAjustes(); aplicarEspejo(); };
    // Volúmenes (0..100 en la interfaz, 0..1 en el gestor) y silencio
    $("chkSilencio").onchange = (e) => { audio?.ajustar({ silencio: e.target.checked }); actualizarIconoSonido(); };
    for (const [id, clave] of [["volMaestro", "maestro"], ["volMusica", "musica"], ["volEfectos", "efectos"]]) {
        $(id).oninput = (e) => { audio?.ajustar({ [clave]: Number(e.target.value) / 100 }); };
        $(id).onchange = () => efecto("boton");   // al soltar, un efecto de muestra
    }
    $("chkDev").onchange = (e) => { ajustes.dev = e.target.checked; guardarAjustes(); aplicarDev(); };

    window.addEventListener("keydown", alPulsarTecla);

    // La consola puede pausar, reanudar o detener el juego
    window.addEventListener("message", (ev) => {
        if (ev.source !== window.parent) return;
        const tipo = ev.data?.tipo;
        if (tipo === "pausar") pausar();
        if (tipo === "reanudar") reanudar();
        if (tipo === "detener") liberarTodo();
    });

    // Pestaña oculta → pausa automática y audio suspendido. Cerrar la página → liberar todo.
    document.addEventListener("visibilitychange", () => {
        if (PREVIEW) return;
        if (document.hidden) { pausar(); audio?.suspender(); } else audio?.reanudar();
    });
    // El audio solo arranca tras un clic o una tecla del jugador (política del navegador)
    for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, () => audio?.desbloquear(), true);
    window.addEventListener("pagehide", liberarTodo);
}

function alPulsarTecla(e) {
    if (PREVIEW) return;
    const k = e.key;
    const est = partida.estado;
    if (pantallaVisible() === "ajustes") {
        if (k === "Escape") { e.preventDefault(); mostrar(PANTALLA_DE[est] || "menu"); }
        return;
    }
    if (est === E.SELECT_TARGET_WINS && ["1", "3", "5", "7"].includes(k)) { elegirMeta(Number(k)); return; }
    if (["1", "2", "3", "0"].includes(k) && ajustes.detector === "simulado-manual") {
        ponerManoManual({ 1: "piedra", 2: "papel", 3: "tijera", 0: null }[k]);
        return;
    }
    if (k === "m" || k === "M") { alternarSonido(); return; }
    if (k === "d" || k === "D") { alternarDev(); return; }
    if (k === "p" || k === "P") { partida.pausada ? reanudar() : pausar(); return; }
    if (k === "Escape") {
        e.preventDefault();
        if (est === E.ASK_READY) partida.listoNo(ahora());
        else if (est === E.SELECT_TARGET_WINS) partida.volverDeMeta(ahora());
        else if (est === E.PAUSED) reanudar();
        else if (partida.enPartida()) pausar();
        else if (est === E.GAME_MENU) salir();
        else if (est !== E.RETURN_TO_CONSOLE) volverAlMenu();
        return;
    }
    // Enter/Espacio sin un botón enfocado: acción principal del estado
    const enBoton = document.activeElement?.tagName === "BUTTON";
    if ((k === "Enter" || k === " ") && !enBoton) {
        e.preventDefault();
        if (est === E.GAME_MENU) partida.jugar(ahora());
        else if (est === E.ASK_READY) partida.listoSi(ahora());
        else partida.continuar(ahora());
    }
}

function alternarSonido() {
    if (!audio) return;
    audio.desbloquear();
    audio.alternarSilencio();
    actualizarIconoSonido();
    efecto("boton");
}
function actualizarIconoSonido() {
    const silencio = !audio || audio.preferencias.silencio;
    $("btnSonido").textContent = silencio ? "✕♪" : "♪";
    $("btnSonido").classList.toggle("apagado", silencio);
    $("chkSilencio").checked = silencio;
}
function alternarDev() {
    ajustes.dev = !ajustes.dev;
    $("chkDev").checked = ajustes.dev;
    guardarAjustes();
    aplicarDev();
}
function aplicarDev() { body.classList.toggle("dev", !!ajustes.dev); }
function aplicarEspejo() { body.classList.toggle("espejo", !!ajustes.espejo); }

function sincronizarAjustesUI() {
    $("selDetector").value = ajustes.detector;
    $("chkCamara").checked = ajustes.camara;
    $("chkEspejo").checked = ajustes.espejo;
    const pa = audio?.preferencias;
    if (pa) {
        $("volMaestro").value = Math.round(pa.maestro * 100);
        $("volMusica").value = Math.round(pa.musica * 100);
        $("volEfectos").value = Math.round(pa.efectos * 100);
    }
    $("chkDev").checked = ajustes.dev;
    actualizarIconoSonido();
    aplicarDev();
    aplicarEspejo();
}

/** Libera cámara, audio y detector. Se llama al salir o al cerrar la página. */
function liberarTodo() {
    apagarCamara();
    audio?.liberar();
}

// ============================================================
// Modo vista previa (consola): juega sola, en bucle, sin cámara ni sonido
// ============================================================
function arrancarPreview() {
    const t = ahora();
    partida.jugar(t); partida.listoSi(t); partida.elegirMeta(3, t);
    camaraPedida = true;
    detectorListo.then(() => partida.empezarPartida(ahora()));
    const original = partida.alCambiar;
    partida.alCambiar = (nuevo, anterior, p) => {
        original(nuevo, anterior, p);
        if (nuevo === E.GAME_OVER_WIN || nuevo === E.GAME_OVER_LOSE) {
            setTimeout(() => { partida.revancha(ahora()); partida.empezarPartida(ahora()); }, 3000);
        }
    };
}

// ============================================================
// Inicio
// ============================================================
async function iniciar() {
    construirMetas();
    sincronizarAjustesUI();
    enlazarEntradas();
    prepararDetector();      // el modelo se carga en segundo plano; la cámara NO se abre aquí
    ponerManoManual(null);
    apagarCamara();
    await michi.cargar();
    alCambiarEstado(E.GAME_MENU, null, partida);
    $("cargando").classList.add("oculto");
    requestAnimationFrame(bucle);
    if (PREVIEW) arrancarPreview();
    // Abierto desde la consola: el jugador ya pulsó un botón, así que la música del menú puede sonar.
    // Abierto suelto: se espera al primer clic o tecla.
    if (INCRUSTADO) audio?.desbloquear();
    if (INCRUSTADO) window.parent.postMessage({ origen: "michikembo", tipo: "listo" }, "*");
}

iniciar();
