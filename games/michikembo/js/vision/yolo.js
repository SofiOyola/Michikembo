// ============================================================
// MICHIKEMBO — Pre y posprocesamiento YOLOv8 (módulo puro, sin DOM)
//
// Reproduce lo que hace Ultralytics al predecir con un modelo exportado
// a ONNX, para que el navegador vea lo mismo que Python:
//   1. Letterbox: escalar la imagen manteniendo proporción y rellenar
//      con gris 114 hasta un cuadrado inputSize×inputSize (centrada).
//   2. RGB, valores /255, orden NCHW [1, 3, S, S].
//   3. Salida [1, 4 + nc, N]: por cada ancla cx, cy, w, h (en píxeles
//      del cuadrado) seguidas de nc puntuaciones de clase (ya en 0..1).
//   4. Umbral de confianza, NMS por clase (como Ultralytics por defecto)
//      y deshacer el letterbox para volver a coordenadas de la imagen.
//
// El resultado sigue el contrato de todos los detectores del juego:
//   [{ clase, confianza, caja: { x, y, w, h } }]  con la caja normalizada 0..1
// Este archivo NO conoce el juego ni las reglas: solo números.
// ============================================================

/** Valor de relleno que usa Ultralytics en el letterbox. */
export const GRIS_LETTERBOX = 114;

/**
 * Calcula cómo encajar una imagen srcW×srcH dentro de un cuadrado de lado `lado`.
 * Igual que Ultralytics: escala = min(lado/alto, lado/ancho), relleno centrado.
 * @returns {{escala:number, nuevoAncho:number, nuevoAlto:number, padX:number, padY:number, lado:number}}
 */
export function parametrosLetterbox(srcW, srcH, lado) {
    const escala = Math.min(lado / srcH, lado / srcW);
    const nuevoAncho = Math.round(srcW * escala);
    const nuevoAlto = Math.round(srcH * escala);
    // Ultralytics reparte el relleno entre ambos lados con round(d/2 ± 0.1)
    const padX = Math.max(0, Math.round((lado - nuevoAncho) / 2 - 0.1));
    const padY = Math.max(0, Math.round((lado - nuevoAlto) / 2 - 0.1));
    return { escala, nuevoAncho, nuevoAlto, padX, padY, lado };
}

/**
 * Convierte píxeles RGBA (ya en el cuadrado lado×lado) al tensor NCHW float32.
 * En el navegador los píxeles salen de un canvas con getImageData().
 * @param {Uint8ClampedArray|Uint8Array} rgba  lado*lado*4 valores
 * @param {number} lado
 * @returns {Float32Array} 3*lado*lado valores en 0..1
 */
export function rgbaANchw(rgba, lado) {
    const area = lado * lado;
    if (rgba.length !== area * 4) throw new Error(`Se esperaban ${area * 4} valores RGBA y llegaron ${rgba.length}`);
    const out = new Float32Array(3 * area);
    for (let i = 0, p = 0; i < area; i++, p += 4) {
        out[i] = rgba[p] / 255;                 // R
        out[area + i] = rgba[p + 1] / 255;      // G
        out[2 * area + i] = rgba[p + 2] / 255;  // B
    }
    return out;
}

/** Intersección sobre unión de dos cajas [x1, y1, x2, y2]. */
export function iou(a, b) {
    const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
    const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const inter = ix * iy;
    const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
    return union > 0 ? inter / union : 0;
}

/**
 * Lee la salida cruda del modelo y devuelve candidatos sobre el umbral.
 * @param {Float32Array} datos  salida plana de forma [1, 4 + nc, n]
 * @param {number[]} dims       forma real del tensor (se valida)
 * @param {number} nc           número de clases que declara el manifiesto
 * @param {number} umbral       confianza mínima
 * @returns {Array<{clase:number, confianza:number, xyxy:number[]}>} en píxeles del cuadrado
 */
export function decodificarSalida(datos, dims, nc, umbral) {
    if (dims.length !== 3 || dims[0] !== 1 || dims[1] !== 4 + nc) {
        throw new Error(`Salida del modelo con forma [${dims}] y se esperaba [1, ${4 + nc}, N]. ` +
            "¿Es un YOLOv8 de detección exportado con nms=False?");
    }
    const n = dims[2];
    const candidatos = [];
    for (let i = 0; i < n; i++) {
        let mejor = 0, clase = -1;
        for (let c = 0; c < nc; c++) {
            const s = datos[(4 + c) * n + i];
            if (s > mejor) { mejor = s; clase = c; }
        }
        if (mejor < umbral) continue;
        const cx = datos[i], cy = datos[n + i], w = datos[2 * n + i], h = datos[3 * n + i];
        candidatos.push({ clase, confianza: mejor, xyxy: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2] });
    }
    return candidatos;
}

/**
 * Supresión de no máximos POR CLASE (agnostic=False, como Ultralytics).
 * @param {Array<{clase:number, confianza:number, xyxy:number[]}>} candidatos
 * @param {number} umbralIou
 * @param {number} [maximo=300]
 */
export function nms(candidatos, umbralIou, maximo = 300) {
    const orden = [...candidatos].sort((a, b) => b.confianza - a.confianza);
    const elegidos = [];
    for (const c of orden) {
        if (elegidos.length >= maximo) break;
        if (elegidos.every((e) => e.clase !== c.clase || iou(e.xyxy, c.xyxy) <= umbralIou)) elegidos.push(c);
    }
    return elegidos;
}

/**
 * Deshace el letterbox y normaliza a 0..1 respecto a la imagen original.
 * @param {Array<{clase:number, confianza:number, xyxy:number[]}>} cajas
 * @param {ReturnType<typeof parametrosLetterbox>} lb
 * @param {number} srcW
 * @param {number} srcH
 */
export function aCoordenadasImagen(cajas, lb, srcW, srcH) {
    return cajas.map(({ clase, confianza, xyxy }) => {
        const lim = (v, max) => Math.min(max, Math.max(0, v));
        const x1 = lim((xyxy[0] - lb.padX) / lb.escala, srcW);
        const y1 = lim((xyxy[1] - lb.padY) / lb.escala, srcH);
        const x2 = lim((xyxy[2] - lb.padX) / lb.escala, srcW);
        const y2 = lim((xyxy[3] - lb.padY) / lb.escala, srcH);
        return { clase, confianza, caja: { x: x1 / srcW, y: y1 / srcH, w: (x2 - x1) / srcW, h: (y2 - y1) / srcH } };
    });
}

/**
 * Cadena completa de posprocesamiento: salida cruda → detecciones del juego.
 * @param {{data: Float32Array, dims: number[]}} salida
 * @param {{nc:number, umbral:number, umbralIou:number, lb:object, srcW:number, srcH:number}} o
 */
export function posprocesar(salida, o) {
    const candidatos = decodificarSalida(salida.data, salida.dims, o.nc, o.umbral);
    return aCoordenadasImagen(nms(candidatos, o.umbralIou), o.lb, o.srcW, o.srcH);
}
