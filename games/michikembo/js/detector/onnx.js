// ============================================================
// MICHIKEMBO — Detector ONNX (modelo YOLOv8 en el navegador)
//
// Carga el modelo ACTIVO descrito por
//   assets/models/michikembo/current/manifest.json
// con ONNX Runtime Web (copia local en vendor/onnxruntime-web/).
// Cumple el mismo contrato que el detector simulado:
//   await iniciar() · nuevaRonda() · await detectar(video) → [{clase, confianza, caja}]
// con clase en índices del JUEGO (0 papel, 1 piedra, 2 tijera) y caja 0..1
// respecto al fotograma SIN espejo (el espejo es solo visual, en CSS).
//
// Para cambiar de modelo no se edita este archivo: ver docs/COMO_CAMBIAR_MODELO.md
// ============================================================

import { validarManifiesto, urlModelo, remapearClases, RUTA_MANIFIESTO } from "../vision/manifiesto.js";
import { parametrosLetterbox, rgbaANchw, posprocesar, GRIS_LETTERBOX } from "../vision/yolo.js";

const RUTA_ORT = new URL("../../../../vendor/onnxruntime-web/", import.meta.url);

/** SHA-256 en hexadecimal con la API del navegador (solo https o localhost). */
async function sha256Hex(buffer) {
    if (!globalThis.crypto?.subtle) return null;
    const h = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class DetectorOnnx {
    constructor(rutaManifiesto = RUTA_MANIFIESTO) {
        this.nombre = "onnx";
        this.urlManifiesto = new URL(rutaManifiesto, document.baseURI).href;
        this.man = null;
        this.sesion = null;
        this.ort = null;
        this.lienzo = null;
        this.ctx = null;
        // Diagnóstico (modo desarrollo)
        this.stats = { latenciaMs: 0, fps: 0, cajas: 0, cajasCrudas: 0, backend: "" };
        this._ultimo = 0;
    }

    /** Umbral de confianza que usa el juego para decidir cada fotograma. */
    get umbral() {
        return this.man?.umbral ?? 0.5;
    }

    async iniciar() {
        // 1. Manifiesto (sin caché, para ver siempre el modelo instalado)
        let crudo;
        try {
            const r = await fetch(this.urlManifiesto, { cache: "no-store" });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            crudo = await r.json();
        } catch (e) {
            throw new Error(`No encontré el modelo: falta assets/models/michikembo/current/manifest.json (${e.message}). ` +
                "Usa el detector simulado o instala un modelo (docs/COMO_CAMBIAR_MODELO.md).");
        }
        this.man = validarManifiesto(crudo);

        // 2. Archivo .onnx (con ?rev= para invalidar la caché al cambiar de modelo)
        let bytes;
        try {
            const r = await fetch(urlModelo(this.urlManifiesto, this.man));
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            bytes = await r.arrayBuffer();
        } catch (e) {
            throw new Error(`El manifiesto existe pero no pude descargar ${this.man.archivo} (${e.message}).`);
        }
        if (this.man.sha256) {
            const h = await sha256Hex(bytes);
            if (h && h !== this.man.sha256) {
                throw new Error(`El archivo ${this.man.archivo} no coincide con el sha256 del manifiesto. ` +
                    "Puede estar incompleto o ser de otro modelo. Restaura el anterior o vuelve a ejecutar scripts/preparar_modelo.py.");
            }
        }

        // 3. ONNX Runtime Web (se importa solo cuando se usa el modelo)
        this.ort = await import(new URL("ort.wasm.min.mjs", RUTA_ORT).href);
        this.ort.env.wasm.wasmPaths = RUTA_ORT.href;
        // Varios hilos solo si la página está aislada (COOP/COEP). Si no, 1 hilo.
        this.ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
        try {
            this.sesion = await this.ort.InferenceSession.create(new Uint8Array(bytes), {
                executionProviders: ["wasm"], graphOptimizationLevel: "all",
            });
        } catch (e) {
            throw new Error(`El modelo no se pudo abrir (¿archivo corrupto o formato distinto?): ${e.message}`);
        }
        this.stats.backend = `wasm · ${this.ort.env.wasm.numThreads} hilo(s)`;

        // 4. Lienzo de preprocesamiento (letterbox) reutilizable
        const lado = this.man.lado;
        this.lienzo = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(lado, lado)
            : Object.assign(document.createElement("canvas"), { width: lado, height: lado });
        this.ctx = this.lienzo.getContext("2d", { willReadFrequently: true });

        // 5. Calentamiento: la primera inferencia siempre es más lenta
        await this._inferir(new Float32Array(3 * lado * lado));
        return true;
    }

    /** Información para el modo desarrollo. */
    info() {
        return this.man ? { version: this.man.version, revision: this.man.revision, estado: this.man.estado,
            nombre: this.man.nombre, umbral: this.man.umbral, umbralIou: this.man.umbralIou } : null;
    }

    nuevaRonda() {}

    async _inferir(tensorDatos) {
        const lado = this.man.lado;
        const entrada = new this.ort.Tensor("float32", tensorDatos, [1, 3, lado, lado]);
        const salida = await this.sesion.run({ [this.sesion.inputNames[0]]: entrada });
        return salida[this.sesion.outputNames[0]];
    }

    /** Detecta manos en el fotograma actual del vídeo. */
    async detectar(video) {
        if (!this.sesion) throw new Error("El detector ONNX no está iniciado.");
        const w = video?.videoWidth, h = video?.videoHeight;
        if (!w || !h || video.readyState < 2) return []; // la cámara aún no entrega imagen
        const t0 = performance.now();
        const lb = parametrosLetterbox(w, h, this.man.lado);
        this.ctx.fillStyle = `rgb(${GRIS_LETTERBOX},${GRIS_LETTERBOX},${GRIS_LETTERBOX})`;
        this.ctx.fillRect(0, 0, lb.lado, lb.lado);
        this.ctx.drawImage(video, lb.padX, lb.padY, lb.nuevoAncho, lb.nuevoAlto);
        const rgba = this.ctx.getImageData(0, 0, lb.lado, lb.lado).data;
        const salida = await this._inferir(rgbaANchw(rgba, lb.lado));
        const dets = posprocesar(salida, { nc: this.man.nc, umbral: this.man.umbral, umbralIou: this.man.umbralIou, lb, srcW: w, srcH: h });
        const t1 = performance.now();
        this.stats.latenciaMs = t1 - t0;
        this.stats.fps = this._ultimo ? 1000 / (t1 - this._ultimo) : 0;
        this._ultimo = t1;
        this.stats.cajasCrudas = dets.length;
        const juego = remapearClases(dets, this.man.mapaClases);
        this.stats.cajas = juego.length;
        return juego;
    }

    liberar() {
        this.sesion?.release?.();
        this.sesion = null;
    }
}
