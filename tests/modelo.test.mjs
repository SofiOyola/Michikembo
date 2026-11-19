// Pruebas del modelo reemplazable (Fase 2).
// Ejecutar desde la raíz:  npm test   (o  node --test tests/)
//
// 1. Sin modelo: validan manifest.json, decodificación YOLOv8 y NMS con datos sintéticos.
// 2. Con modelo instalado en assets/models/michikembo/current/:
//    sha256 y tamaño, forma de entrada/salida, "Nada" en imagen vacía, latencia,
//    y equivalencia JS vs Python (Ultralytics ONNX) con tests/fixtures/modelo/.
//    Si el modelo o las fixtures no están (p. ej. recién clonado de GitHub), esas pruebas se OMITEN y lo dicen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { validarManifiesto, jugadaDeClase, remapearClases, urlModelo } from "../games/michikembo/js/vision/manifiesto.js";
import { parametrosLetterbox, rgbaANchw, decodificarSalida, nms, iou, posprocesar } from "../games/michikembo/js/vision/yolo.js";
import { leerPng, letterboxSinEscala } from "./util/png.mjs";

const raiz = (r) => fileURLToPath(new URL(`../${r}`, import.meta.url));
const DIR = raiz("assets/models/michikembo/current/");
const MANIFIESTO = DIR + "manifest.json";
const FIXTURES = raiz("tests/fixtures/modelo/");

const BASE = {
    modelName: "x", version: "v", file: "model.onnx", inputSize: 640,
    classNames: ["Paper", "Rock", "Scissors"], confidenceThreshold: 0.2, iouThreshold: 0.45, revision: 1,
};

// ---------------------------------------------------------------- sin modelo
test("manifiesto: uno correcto se acepta y traduce clases por nombre", () => {
    const m = validarManifiesto(BASE);
    assert.deepEqual(m.mapaClases, [0, 1, 2]);
    assert.equal(m.nc, 3);
});

test("manifiesto: otro orden de clases se remapea sin tocar el juego", () => {
    const m = validarManifiesto({ ...BASE, classNames: ["Rock", "Scissors", "Paper"] });
    assert.deepEqual(m.mapaClases, [1, 2, 0]);
    const d = remapearClases([{ clase: 0, confianza: 0.9 }, { clase: 2, confianza: 0.8 }], m.mapaClases);
    assert.deepEqual(d.map((x) => x.clase), [1, 0]); // Rock→piedra(1), Paper→papel(0)
    assert.equal(jugadaDeClase("SCISSORS"), "tijera");
});

test("manifiesto: errores legibles (clase faltante, umbral, inputSize, sha256)", () => {
    assert.throws(() => validarManifiesto({ ...BASE, classNames: ["Paper", "Rock"] }), /tijera/);
    assert.throws(() => validarManifiesto({ ...BASE, confidenceThreshold: 1.5 }), /confidenceThreshold/);
    assert.throws(() => validarManifiesto({ ...BASE, inputSize: 600 }), /inputSize/);
    assert.throws(() => validarManifiesto({ ...BASE, sha256: "abc" }), /sha256/);
    assert.throws(() => validarManifiesto({ ...BASE, file: "best.pt" }), /onnx/);
});

test("manifiesto: la URL del modelo lleva ?rev= para invalidar la caché", () => {
    const u = urlModelo("http://localhost:8000/assets/models/michikembo/current/manifest.json", validarManifiesto({ ...BASE, revision: 7 }));
    assert.equal(u, "http://localhost:8000/assets/models/michikembo/current/model.onnx?rev=7");
});

test("letterbox: 640x480 → relleno de 80 px arriba y abajo, escala 1", () => {
    assert.deepEqual(parametrosLetterbox(640, 480, 640), { escala: 1, nuevoAncho: 640, nuevoAlto: 480, padX: 0, padY: 80, lado: 640 });
    const lb = parametrosLetterbox(1280, 720, 640);
    assert.equal(lb.escala, 0.5); assert.equal(lb.nuevoAlto, 360); assert.equal(lb.padY, 140);
});

test("tensor: RGBA → NCHW normalizado", () => {
    const t = rgbaANchw(new Uint8Array([255, 0, 51, 255, 0, 255, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255]), 2);
    assert.deepEqual([...t].map((v) => Math.round(v * 100) / 100), [1, 0, 0, 1, 0, 1, 0, 1, 0.2, 0, 0, 1]);
});

/** Construye una salida YOLOv8 falsa [1, 4+nc, n] a partir de anclas legibles. */
function salidaFalsa(anclas, nc = 3) {
    const n = anclas.length, d = new Float32Array((4 + nc) * n);
    anclas.forEach(([cx, cy, w, h, ...s], i) => {
        [cx, cy, w, h].forEach((v, k) => (d[k * n + i] = v));
        s.forEach((v, c) => (d[(4 + c) * n + i] = v));
    });
    return { data: d, dims: [1, 4 + nc, n] };
}

test("decodificar + NMS: se queda con la mejor caja por clase y respeta el umbral", () => {
    const s = salidaFalsa([
        [100, 100, 50, 50, 0.9, 0.05, 0.0],   // papel fuerte
        [102, 101, 50, 50, 0.8, 0.0, 0.0],    // duplicado del anterior → NMS lo quita
        [400, 300, 60, 60, 0.0, 0.0, 0.7],    // tijera
        [500, 500, 40, 40, 0.0, 0.15, 0.0],   // bajo el umbral
    ]);
    const c = decodificarSalida(s.data, s.dims, 3, 0.2);
    assert.equal(c.length, 3);
    const r = nms(c, 0.45);
    assert.deepEqual(r.map((x) => x.clase), [0, 2]);
    assert.ok(iou([0, 0, 10, 10], [0, 0, 10, 10]) === 1 && iou([0, 0, 1, 1], [5, 5, 6, 6]) === 0);
});

test("NMS por clase: dos clases distintas superpuestas se conservan (luego el juego dice AMBIGUO)", () => {
    const s = salidaFalsa([[100, 100, 50, 50, 0.9, 0, 0], [100, 100, 50, 50, 0, 0.85, 0]]);
    assert.equal(nms(decodificarSalida(s.data, s.dims, 3, 0.2), 0.45).length, 2);
});

test("posprocesar: deshace el letterbox y normaliza a 0..1", () => {
    const lb = parametrosLetterbox(640, 480, 640); // padY = 80
    const s = salidaFalsa([[320, 320, 64, 48, 0, 0.9, 0]]);
    const [d] = posprocesar(s, { nc: 3, umbral: 0.2, umbralIou: 0.45, lb, srcW: 640, srcH: 480 });
    assert.equal(d.clase, 1);
    assert.ok(Math.abs(d.caja.x - 0.45) < 1e-6 && Math.abs(d.caja.y - 0.45) < 1e-6);
    assert.ok(Math.abs(d.caja.w - 0.1) < 1e-6 && Math.abs(d.caja.h - 0.1) < 1e-6);
});

test("decodificar: una salida con otra forma da un error claro", () => {
    assert.throws(() => decodificarSalida(new Float32Array(10), [1, 10, 1], 3, 0.2), /forma/);
});

// ---------------------------------------------------------------- con modelo
const hayModelo = existsSync(MANIFIESTO);
const omitirModelo = hayModelo ? false : "no hay modelo en assets/models/michikembo/current/ (ver docs/COMO_CAMBIAR_MODELO.md)";
let man = null, sesion = null, ort = null;

async function abrirSesion() {
    if (sesion) return sesion;
    man = validarManifiesto(JSON.parse(readFileSync(MANIFIESTO, "utf8")));
    ort = await import("../vendor/onnxruntime-web/ort.wasm.min.mjs");
    ort.env.wasm.numThreads = 1;
    sesion = await ort.InferenceSession.create(readFileSync(DIR + man.archivo));
    return sesion;
}

async function inferir(rgbaCuadrado) {
    const t = new ort.Tensor("float32", rgbaANchw(rgbaCuadrado, man.lado), [1, 3, man.lado, man.lado]);
    const o = await sesion.run({ [sesion.inputNames[0]]: t });
    return o[sesion.outputNames[0]];
}

test("modelo instalado: el archivo coincide con sha256 y tamaño del manifiesto", { skip: omitirModelo }, () => {
    const crudo = JSON.parse(readFileSync(MANIFIESTO, "utf8"));
    const bytes = readFileSync(DIR + crudo.file);
    assert.equal(bytes.length, crudo.bytes, "tamaño distinto al del manifiesto");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), crudo.sha256, "sha256 distinto: ¿se cambió model.onnx sin actualizar manifest.json?");
});

test("modelo instalado: carga en ONNX Runtime Web y su salida es [1, 4+nc, N]", { skip: omitirModelo }, async () => {
    await abrirSesion();
    const gris = new Uint8Array(man.lado * man.lado * 4).fill(114);
    const o = await inferir(gris);
    assert.equal(o.dims.length, 3);
    assert.equal(o.dims[1], 4 + man.nc);
});

test("modelo instalado: imagen sin mano → ninguna detección (Nada)", { skip: omitirModelo }, async () => {
    await abrirSesion();
    for (const valor of [0, 114, 180, 255]) {
        const o = await inferir(new Uint8Array(man.lado * man.lado * 4).fill(valor));
        const lb = parametrosLetterbox(man.lado, man.lado, man.lado);
        assert.deepEqual(posprocesar(o, { nc: man.nc, umbral: man.umbral, umbralIou: man.umbralIou, lb, srcW: man.lado, srcH: man.lado }), [], `gris ${valor}`);
    }
});

const hayFixtures = existsSync(FIXTURES + "esperado.json");
test("modelo instalado: el pipeline JS reproduce a Ultralytics-ONNX en Python (clase, confianza y caja)",
    { skip: !hayModelo ? omitirModelo : !hayFixtures ? "faltan tests/fixtures/modelo/ (las crea scripts/preparar_modelo.py --imagenes)" : false },
    async () => {
        await abrirSesion();
        const esperado = JSON.parse(readFileSync(FIXTURES + "esperado.json", "utf8"));
        const shaActual = createHash("sha256").update(readFileSync(DIR + man.archivo)).digest("hex");
        assert.equal(esperado.modelo_sha256, shaActual, "las fixtures son de otro modelo: vuelve a ejecutar scripts/preparar_modelo.py");
        const tiempos = [];
        for (const m of esperado.marcos) {
            const img = leerPng(FIXTURES + m.archivo);
            const lb = parametrosLetterbox(img.ancho, img.alto, man.lado);
            const t0 = performance.now();
            const o = await inferir(letterboxSinEscala(img, lb));
            const js = posprocesar(o, { nc: man.nc, umbral: esperado.conf, umbralIou: esperado.iou, lb, srcW: img.ancho, srcH: img.alto });
            tiempos.push(performance.now() - t0);
            const py = m.onnx;
            assert.equal(js.length, py.length, `${m.archivo}: ${js.length} cajas en JS y ${py.length} en Python`);
            const ordenJs = [...js].sort((a, b) => b.confianza - a.confianza);
            ordenJs.forEach((d, i) => {
                const p = py[i];
                const xyxy = [d.caja.x * img.ancho, d.caja.y * img.alto, (d.caja.x + d.caja.w) * img.ancho, (d.caja.y + d.caja.h) * img.alto];
                assert.equal(d.clase, p.clase, `${m.archivo}: clase`);
                assert.ok(Math.abs(d.confianza - p.confianza) < 0.01, `${m.archivo}: confianza ${d.confianza} vs ${p.confianza}`);
                assert.ok(iou(xyxy, p.xyxy) > 0.98, `${m.archivo}: IoU ${iou(xyxy, p.xyxy)}`);
            });
        }
        const media = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
        console.log(`    equivalencia JS/Python: ${esperado.marcos.length} marcos OK · inferencia media en Node (1 hilo): ${media.toFixed(0)} ms`);
    });
