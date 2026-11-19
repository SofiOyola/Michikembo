// ============================================================
// AUDIO COMPARTIDO — Gestor de audio (mezclador + reproductor)
//
// Lo usan la consola y Michikembo. Ofrece:
//   · volumen maestro, de música y de efectos, y silencio (persistentes)
//   · UNA sola música a la vez: pedir otra hace un fundido de salida
//     y después entra la nueva (nunca suenan dos músicas juntas)
//   · pedir la misma música que ya suena NO la reinicia
//   · efectos cortos independientes de la música
//   · música/efectos ORIGINALES sintetizados (composiciones.js) o, si tú
//     los pones, tus archivos .ogg/.mp3/.wav declarados en pistas.json
//   · precarga de archivos y liberación completa de recursos
//
// Política de reproducción automática: el AudioContext solo se crea
// en desbloquear(), que se llama tras un clic/tecla del jugador
// (o al abrir el juego desde la consola, que ya fue un clic).
// Las peticiones de música anteriores se recuerdan y suenan al desbloquear.
// ============================================================

import { compilar } from "./notas.js";

export const CLAVE_PREFERENCIAS = "mk.audio.v1";
export const PREFERENCIAS_POR_DEFECTO = Object.freeze({ maestro: 0.8, musica: 0.6, efectos: 0.8, silencio: false });

const ADELANTO_S = 0.25;      // cuánto se programa por delante (s)
const FUNDIDO_S = 0.4;        // fundido por defecto entre músicas (s)

const limitar = (v, defecto) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : defecto);

/** Corrige valores fuera de rango o ausentes. */
export function normalizarPreferencias(p = {}) {
    const d = PREFERENCIAS_POR_DEFECTO;
    return { maestro: limitar(p.maestro, d.maestro), musica: limitar(p.musica, d.musica),
        efectos: limitar(p.efectos, d.efectos), silencio: !!p.silencio };
}

/** Lee las preferencias compartidas (consola + juegos). Migra el silencio antiguo de la consola. */
export function leerPreferencias(almacen = globalThis.localStorage) {
    try {
        const crudo = almacen?.getItem(CLAVE_PREFERENCIAS);
        if (crudo) return normalizarPreferencias(JSON.parse(crudo));
        if (almacen?.getItem("mk.console.muted") === "1") return normalizarPreferencias({ silencio: true });
    } catch { /* almacenamiento bloqueado o JSON roto: valores por defecto */ }
    return normalizarPreferencias();
}

export function guardarPreferencias(p, almacen = globalThis.localStorage) {
    try { almacen?.setItem(CLAVE_PREFERENCIAS, JSON.stringify(normalizarPreferencias(p))); } catch { /* ignorar */ }
}

/**
 * Valida un pistas.json. Cada clave es el id de una pieza; el valor puede ser
 *   null                      → usar la versión original sintetizada
 *   "archivo.ogg"             → usar ese archivo (ruta relativa a pistas.json)
 *   { archivo, volumen, bucle } → archivo con volumen (0..1) y bucle opcionales
 * Las claves que empiezan por "_" son comentarios.
 */
export function leerPistas(json) {
    const pistas = {};
    if (!json || typeof json !== "object") return pistas;
    for (const [id, v] of Object.entries(json)) {
        if (id.startsWith("_") || v == null || v === "") continue;
        const o = typeof v === "string" ? { archivo: v } : v;
        if (typeof o.archivo !== "string" || !o.archivo.trim()) continue;
        pistas[id] = { archivo: o.archivo.trim(), volumen: limitar(o.volumen, 1), bucle: o.bucle };
    }
    return pistas;
}

export class GestorAudio {
    /**
     * @param {object} op
     * @param {object} op.musica   composiciones de música { id: pieza }
     * @param {object} op.efectos  composiciones de efectos { id: pieza }
     * @param {string} [op.urlPistas]  URL de pistas.json (archivos opcionales del usuario)
     * @param {Storage} [op.almacen]   dónde guardar preferencias (localStorage)
     * @param {Function} [op.crearContexto] fábrica de AudioContext (pruebas)
     * @param {Function} [op.cargar]   fetch (pruebas)
     * @param {boolean} [op.temporizador=true] programar la música con setInterval
     */
    constructor({ musica = {}, efectos = {}, urlPistas = null, almacen = globalThis.localStorage,
        crearContexto = null, cargar = globalThis.fetch?.bind(globalThis), temporizador = true } = {}) {
        this.piezas = {};
        for (const [id, c] of Object.entries({ ...musica, ...efectos })) this.piezas[id] = compilar(c);
        this.idsMusica = new Set(Object.keys(musica));
        this.urlPistas = urlPistas;
        this.almacen = almacen;
        this.crearContexto = crearContexto || (() => new (globalThis.AudioContext || globalThis.webkitAudioContext)());
        this.cargar = cargar;
        this.usarTemporizador = temporizador;
        this.pref = leerPreferencias(almacen);
        this.ctx = null;
        this.nodos = null;            // { maestro, musica, efectos }
        this.pistas = {};             // pistas.json ya validado
        this.crudos = {};             // id → ArrayBuffer descargado (sin decodificar)
        this.buffers = {};            // id → AudioBuffer listo
        this.avisos = [];             // problemas no fatales (archivo que falta, etc.)
        this.actual = null;           // música sonando { id, fuente, ganancia, ... }
        this.deseada = null;          // última música pedida (aunque aún no se pueda sonar)
        this.timer = 0;
        this.liberado = false;
        this.preparado = false;       // true cuando ya se decodificaron los archivos
        this._carga = null;           // promesa de precargar()
        this.alCambiar = null;        // callback opcional para refrescar la interfaz
    }

    // ---------------- Preferencias ----------------
    get preferencias() { return { ...this.pref }; }

    ajustar(cambios) {
        this.pref = normalizarPreferencias({ ...this.pref, ...cambios });
        guardarPreferencias(this.pref, this.almacen);
        this._aplicarVolumenes();
        this.alCambiar?.(this.estado());
        return this.preferencias;
    }

    alternarSilencio() { return this.ajustar({ silencio: !this.pref.silencio }).silencio; }

    _aplicarVolumenes() {
        if (!this.nodos) return;
        const t = this.ctx.currentTime;
        const fijar = (nodo, v) => { nodo.gain.cancelScheduledValues?.(t); nodo.gain.setTargetAtTime(v, t, 0.03); };
        fijar(this.nodos.maestro, this.pref.silencio ? 0 : this.pref.maestro);
        fijar(this.nodos.musica, this.pref.musica);
        fijar(this.nodos.efectos, this.pref.efectos);
    }

    // ---------------- Carga ----------------
    /** Lee pistas.json y descarga los archivos que declare. Nunca lanza: anota avisos. */
    precargar() {
        this._carga ??= this._precargar();
        return this._carga;
    }

    async _precargar() {
        if (!this.urlPistas || !this.cargar) return;
        try {
            const r = await this.cargar(this.urlPistas, { cache: "no-store" });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            this.pistas = leerPistas(await r.json());
        } catch (e) {
            this.avisos.push(`No pude leer ${this.urlPistas}: ${e.message}. Se usa el audio original sintetizado.`);
            return;
        }
        await Promise.all(Object.entries(this.pistas).map(async ([id, p]) => {
            try {
                const r = await this.cargar(new URL(p.archivo, this.urlPistas).href);
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                this.crudos[id] = await r.arrayBuffer();
            } catch (e) {
                this.avisos.push(`No encontré ${p.archivo} (${id}): ${e.message}. Se usa la versión original.`);
            }
        }));
    }

    async _decodificar() {
        for (const [id, crudo] of Object.entries(this.crudos)) {
            delete this.crudos[id];
            try {
                // slice(0): decodeAudioData se queda con el buffer en algunos navegadores
                this.buffers[id] = await this.ctx.decodeAudioData(crudo.slice(0));
            } catch (e) {
                this.avisos.push(`El archivo de "${id}" no se pudo decodificar (${e.message}). Se usa la versión original.`);
            }
        }
    }

    // ---------------- Contexto ----------------
    /** Crea o reanuda el audio. Llamar dentro de un clic/tecla del jugador. */
    desbloquear() {
        if (this.liberado) return;
        if (!this.ctx) {
            try { this.ctx = this.crearContexto(); } catch { return; }
            if (!this.ctx) return;
            const g = () => this.ctx.createGain();
            this.nodos = { maestro: g(), musica: g(), efectos: g() };
            this.nodos.musica.connect(this.nodos.maestro);
            this.nodos.efectos.connect(this.nodos.maestro);
            this.nodos.maestro.connect(this.ctx.destination);
            this._aplicarVolumenes();
            if (this.usarTemporizador) this.timer = setInterval(() => this._programar(), 50);
            // Esperar a que terminen la precarga y la decodificación de tus archivos
            // antes de la primera música, para que suene tu archivo y no la versión sintetizada.
            this.preparado = false;
            Promise.resolve(this._carga).then(() => this._decodificar()).then(() => {
                this.preparado = true;
                if (this.ctx && this.deseada && !this.actual) this._iniciarMusica(this.deseada, FUNDIDO_S);
            });
        }
        if (this.ctx.state === "suspended") this.ctx.resume?.().catch(() => {});
        if (this.preparado && this.deseada && !this.actual) this._iniciarMusica(this.deseada, FUNDIDO_S);
    }

    suspender() { if (this.ctx?.state === "running") this.ctx.suspend().catch(() => {}); }
    reanudar() { if (this.ctx?.state === "suspended" && !this.liberado) this.ctx.resume().catch(() => {}); }

    // ---------------- Música ----------------
    /**
     * Pide una música. null = silencio musical (fundido de salida).
     * Si ya suena esa misma, no hace nada (sin reinicios bruscos).
     */
    musica(id, { fundido = FUNDIDO_S } = {}) {
        if (id && !this.piezas[id] && !this.pistas[id]) throw new Error(`Música desconocida: ${id}`);
        this.deseada = id || null;
        if (this.actual?.id === this.deseada) return;
        let espera = 0;
        if (this.actual) { this._detener(this.actual, fundido); espera = fundido; this.actual = null; }
        if (this.deseada && this.ctx && this.preparado) this._iniciarMusica(this.deseada, fundido, espera);
        this.alCambiar?.(this.estado());
    }

    _iniciarMusica(id, fundido, espera = 0) {
        const ctx = this.ctx;
        const t0 = ctx.currentTime + espera + 0.02;
        const ganancia = ctx.createGain();
        ganancia.connect(this.nodos.musica);
        const pieza = this.piezas[id];
        const pista = this.pistas[id];
        const volumen = pista ? pista.volumen : 1;
        ganancia.gain.setValueAtTime(0.0001, ctx.currentTime);
        ganancia.gain.setValueAtTime(0.0001, t0);
        ganancia.gain.linearRampToValueAtTime(volumen, t0 + Math.max(0.02, fundido));
        const bucle = pista?.bucle ?? pieza?.bucle ?? true;
        const p = { id, ganancia, bucle, sonando: new Set(), parada: false };

        if (this.buffers[id]) {
            const src = ctx.createBufferSource();
            src.buffer = this.buffers[id];
            src.loop = bucle;
            src.connect(ganancia);
            src.start(t0);
            p.fuente = "archivo";
            p.sonando.add(src);
            src.onended = () => { p.sonando.delete(src); if (!bucle) this._terminarSiActual(p); };
        } else {
            p.fuente = "sintetizada";
            // Eventos de todas las voces, ordenados por paso
            p.eventos = pieza.voces.flatMap((v) => v.eventos.map((e) => ({ ...e, voz: v })))
                .sort((a, b) => a.paso - b.paso);
            p.pieza = pieza;
            p.inicio = t0;
            p.indice = 0;
            p.fin = bucle ? Infinity : t0 + pieza.duracion;
        }
        this.actual = p;
        this._programar();
    }

    /** Programa las notas de la música sintetizada que caen en los próximos ADELANTO_S segundos. */
    _programar() {
        const p = this.actual;
        if (!p || p.fuente !== "sintetizada" || !this.ctx) return;
        const ahora = this.ctx.currentTime;
        if (!p.bucle && ahora > p.fin + 0.1) { this._terminarSiActual(p); return; }
        const { pieza } = p;
        while (true) {
            if (p.indice >= p.eventos.length) {
                if (!p.bucle) break;
                p.indice = 0;
                p.inicio += pieza.duracion;      // siguiente vuelta del bucle
            }
            const ev = p.eventos[p.indice];
            const t = p.inicio + ev.paso * pieza.paso;
            if (t > ahora + ADELANTO_S) break;
            if (t >= ahora - 0.05) this._tocar(ev, t, pieza.paso, p.ganancia, p.sonando);
            p.indice++;
        }
    }

    _terminarSiActual(p) {
        if (this.actual !== p) return;
        this.actual = null;
        this.deseada = null;   // una pieza sin bucle no se vuelve a pedir sola
        p.ganancia.disconnect();
        this.alCambiar?.(this.estado());
    }

    _detener(p, fundido) {
        p.parada = true;
        const t = this.ctx.currentTime;
        p.ganancia.gain.cancelScheduledValues?.(t);
        p.ganancia.gain.setValueAtTime(p.ganancia.gain.value ?? 1, t);
        p.ganancia.gain.linearRampToValueAtTime(0.0001, t + Math.max(0.02, fundido));
        for (const n of p.sonando) { try { n.stop(t + fundido + 0.02); } catch { /* ya parado */ } }
        setTimeout(() => { try { p.ganancia.disconnect(); } catch { /* ignorar */ } }, (fundido + 0.2) * 1000);
    }

    // ---------------- Efectos ----------------
    efecto(id) {
        if (!this.ctx || this.liberado || this.pref.silencio || this.pref.efectos === 0) return false;
        const t = this.ctx.currentTime + 0.01;
        if (this.buffers[id]) {
            const src = this.ctx.createBufferSource();
            src.buffer = this.buffers[id];
            const g = this.ctx.createGain();
            g.gain.value = this.pistas[id]?.volumen ?? 1;
            src.connect(g).connect(this.nodos.efectos);
            src.start(t);
            return true;
        }
        const pieza = this.piezas[id];
        if (!pieza) throw new Error(`Efecto desconocido: ${id}`);
        for (const v of pieza.voces) for (const ev of v.eventos) this._tocar({ ...ev, voz: v }, t + ev.paso * pieza.paso, pieza.paso, this.nodos.efectos, null);
        return true;
    }

    // ---------------- Síntesis ----------------
    _tocar(ev, t, paso, destino, coleccion) {
        const ctx = this.ctx;
        const vol = ev.voz.volumen ?? 0.1;
        const dur = ev.pasos * paso;
        const g = ctx.createGain();
        g.connect(destino);
        let fuente;
        if (ev.tipo === "percusion") {
            if (ev.valor === "k") {                       // bombo: seno que cae de tono
                fuente = ctx.createOscillator();
                fuente.type = "sine";
                fuente.frequency.setValueAtTime(150, t);
                fuente.frequency.exponentialRampToValueAtTime(45, t + 0.12);
                g.gain.setValueAtTime(vol * 4, t);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
                fuente.connect(g);
                fuente.start(t); fuente.stop(t + 0.15);
            } else {                                      // caja (s) o platillo (h): ruido filtrado
                const largo = ev.valor === "s" ? 0.12 : 0.04;
                fuente = ctx.createBufferSource();
                fuente.buffer = this._ruido();
                const filtro = ctx.createBiquadFilter();
                filtro.type = "highpass";
                filtro.frequency.value = ev.valor === "s" ? 1200 : 7000;
                g.gain.setValueAtTime(vol * (ev.valor === "s" ? 2.5 : 1.5), t);
                g.gain.exponentialRampToValueAtTime(0.0001, t + largo);
                fuente.connect(filtro).connect(g);
                fuente.start(t); fuente.stop(t + largo + 0.01);
            }
        } else {
            fuente = ctx.createOscillator();
            if (ev.voz.instrumento === "pulso25") fuente.setPeriodicWave(this._ondaEstrecha());
            else fuente.type = ev.voz.instrumento === "triangulo" ? "triangle" : "square";
            fuente.frequency.setValueAtTime(ev.valor, t);
            // Envolvente: ataque corto, leve caída y corte limpio antes de la siguiente nota
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(vol, t + 0.005);
            g.gain.linearRampToValueAtTime(vol * 0.6, t + Math.max(0.01, dur * 0.7));
            g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.02, dur * 0.97));
            fuente.connect(g);
            fuente.start(t); fuente.stop(t + dur);
        }
        if (coleccion) {
            coleccion.add(fuente);
            fuente.onended = () => { coleccion.delete(fuente); try { g.disconnect(); } catch { /* ignorar */ } };
        } else {
            fuente.onended = () => { try { g.disconnect(); } catch { /* ignorar */ } };
        }
    }

    /** Un segundo de ruido blanco (se crea una vez). */
    _ruido() {
        if (!this._bufRuido) {
            const n = this.ctx.sampleRate || 44100;
            this._bufRuido = this.ctx.createBuffer(1, n, n);
            const d = this._bufRuido.getChannelData(0);
            for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        }
        return this._bufRuido;
    }

    /** Onda de pulso al 25 % (sonido chiptune más fino que la cuadrada). */
    _ondaEstrecha() {
        if (!this._onda25) {
            const N = 32, real = new Float32Array(N), imag = new Float32Array(N);
            for (let n = 1; n < N; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
            this._onda25 = this.ctx.createPeriodicWave(real, imag);
        }
        return this._onda25;
    }

    // ---------------- Estado y cierre ----------------
    estado() {
        return {
            contexto: this.ctx?.state ?? "sin-crear",
            musica: this.actual?.id ?? null,
            deseada: this.deseada,
            fuente: this.actual?.fuente ?? null,
            archivos: Object.keys(this.buffers),
            preferencias: this.preferencias,
            avisos: [...this.avisos],
        };
    }

    /** Detiene todo y cierra el AudioContext. Tras esto el gestor ya no suena. */
    liberar() {
        this.liberado = true;
        clearInterval(this.timer);
        this.timer = 0;
        this.actual = null;
        this.deseada = null;
        this.buffers = {};
        this.crudos = {};
        const ctx = this.ctx;
        this.ctx = null;
        this.nodos = null;
        ctx?.close?.().catch?.(() => {});
    }
}
