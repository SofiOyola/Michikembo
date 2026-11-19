// Decodificador PNG mínimo para las pruebas (solo Node, sin dependencias).
// Admite PNG de 8 bits RGB o RGBA sin entrelazar (lo que escribe OpenCV).
import { inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";

export function leerPng(ruta) {
    const buf = readFileSync(ruta);
    let pos = 8, ancho = 0, alto = 0, tipo = 0, profundidad = 0, entrelazado = 0;
    const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const nombre = buf.toString("ascii", pos + 4, pos + 8);
        const datos = buf.subarray(pos + 8, pos + 8 + len);
        if (nombre === "IHDR") {
            ancho = datos.readUInt32BE(0); alto = datos.readUInt32BE(4);
            profundidad = datos[8]; tipo = datos[9]; entrelazado = datos[12];
        } else if (nombre === "IDAT") idat.push(datos);
        else if (nombre === "IEND") break;
        pos += 12 + len;
    }
    if (profundidad !== 8 || ![2, 6].includes(tipo) || entrelazado) throw new Error(`PNG no admitido: ${ruta}`);
    const bpp = tipo === 6 ? 4 : 3;
    const crudo = inflateSync(Buffer.concat(idat));
    const fila = ancho * bpp;
    const px = new Uint8Array(alto * fila);
    for (let y = 0; y < alto; y++) {
        const f = crudo[y * (fila + 1)];
        const src = crudo.subarray(y * (fila + 1) + 1, (y + 1) * (fila + 1));
        const out = px.subarray(y * fila, (y + 1) * fila);
        const prev = y ? px.subarray((y - 1) * fila, y * fila) : new Uint8Array(fila);
        for (let x = 0; x < fila; x++) {
            const a = x >= bpp ? out[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
            let v = src[x];
            if (f === 1) v += a;
            else if (f === 2) v += b;
            else if (f === 3) v += (a + b) >> 1;
            else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
            out[x] = v & 255;
        }
    }
    // Siempre devuelve RGBA
    const rgba = new Uint8Array(ancho * alto * 4);
    for (let i = 0, j = 0; i < ancho * alto; i++, j += bpp) {
        rgba[i * 4] = px[j]; rgba[i * 4 + 1] = px[j + 1]; rgba[i * 4 + 2] = px[j + 2]; rgba[i * 4 + 3] = bpp === 4 ? px[j + 3] : 255;
    }
    return { ancho, alto, rgba };
}

/**
 * Letterbox en JS puro (lo que en el navegador hace el canvas).
 * Solo se usa sin cambio de escala (marcos 640x480 → cuadrado 640): rellena con gris.
 */
export function letterboxSinEscala(img, lb) {
    if (lb.nuevoAncho !== img.ancho || lb.nuevoAlto !== img.alto) throw new Error("Las pruebas usan marcos que no necesitan reescalado (640x480).");
    const out = new Uint8Array(lb.lado * lb.lado * 4).fill(114);
    for (let y = 0; y < img.alto; y++) {
        out.set(img.rgba.subarray(y * img.ancho * 4, (y + 1) * img.ancho * 4), ((y + lb.padY) * lb.lado + lb.padX) * 4);
    }
    return out;
}
