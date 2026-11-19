// ============================================================
// MICHIKEMBO — Lectura y validación del manifest.json del modelo
// (módulo puro, sin DOM: se usa en el navegador y en las pruebas)
//
// El modelo activo vive SIEMPRE en la misma carpeta:
//   assets/models/michikembo/current/model.onnx
//   assets/models/michikembo/current/manifest.json
// Cambiar de modelo = reemplazar esos dos archivos (docs/COMO_CAMBIAR_MODELO.md).
// El juego no usa índices de clase fijos: traduce por NOMBRE, así un modelo
// nuevo con otro orden de clases funciona sin tocar las reglas.
// ============================================================

import { CLASES_MODELO } from "../reglas.js";

/** Ruta del manifiesto relativa a games/michikembo/index.html. */
export const RUTA_MANIFIESTO = "../../assets/models/michikembo/current/manifest.json";

/** Nombres aceptados para cada jugada (en minúsculas). */
const SINONIMOS = {
    papel: ["paper", "papel"],
    piedra: ["rock", "piedra"],
    tijera: ["scissors", "tijera", "tijeras"],
};

/** Traduce un nombre de clase del modelo a la jugada del juego, o null. */
export function jugadaDeClase(nombre) {
    const n = String(nombre).trim().toLowerCase();
    return Object.keys(SINONIMOS).find((j) => SINONIMOS[j].includes(n)) || null;
}

/**
 * Valida el manifiesto y devuelve una versión normalizada.
 * Lanza Error con un mensaje en español si falta algo.
 * @param {object} m  contenido de manifest.json
 */
export function validarManifiesto(m) {
    const fallos = [];
    if (!m || typeof m !== "object") throw new Error("manifest.json vacío o ilegible.");
    if (typeof m.file !== "string" || !m.file.endsWith(".onnx")) fallos.push("'file' debe apuntar a un .onnx");
    if (!Number.isInteger(m.inputSize) || m.inputSize < 32 || m.inputSize % 32) fallos.push("'inputSize' debe ser múltiplo de 32 (p. ej. 640)");
    if (!Array.isArray(m.classNames) || m.classNames.length === 0) fallos.push("'classNames' debe ser una lista");
    const umbral = m.confidenceThreshold, umbralIou = m.iouThreshold;
    if (!(umbral > 0 && umbral < 1)) fallos.push("'confidenceThreshold' debe estar entre 0 y 1");
    if (!(umbralIou > 0 && umbralIou < 1)) fallos.push("'iouThreshold' debe estar entre 0 y 1");
    if (!Number.isInteger(m.revision) || m.revision < 1) fallos.push("'revision' debe ser un entero ≥ 1");
    if (m.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(m.sha256)) fallos.push("'sha256' no tiene 64 caracteres hexadecimales");

    // Índice de clase del MODELO → índice de clase del JUEGO (0 papel, 1 piedra, 2 tijera)
    const mapa = (m.classNames || []).map((n) => {
        const j = jugadaDeClase(n);
        return j ? CLASES_MODELO.indexOf(j) : -1;
    });
    for (const j of CLASES_MODELO) {
        const veces = mapa.filter((i) => i === CLASES_MODELO.indexOf(j)).length;
        if (veces !== 1) fallos.push(`la jugada '${j}' debe aparecer exactamente una vez en classNames (aparece ${veces})`);
    }
    if (fallos.length) throw new Error(`manifest.json no válido: ${fallos.join("; ")}.`);

    return {
        nombre: m.modelName || m.version || "modelo sin nombre",
        version: m.version || "sin versión",
        revision: m.revision,
        estado: m.status || "desconocido",
        archivo: m.file,
        lado: m.inputSize,
        nc: m.classNames.length,
        clases: [...m.classNames],
        mapaClases: mapa,           // -1 = clase que el juego ignora
        umbral,
        umbralIou,
        sha256: m.sha256 || null,
        bytes: m.bytes || null,
    };
}

/**
 * URL del .onnx relativa al manifiesto, con ?rev= para que el navegador
 * no use una copia vieja de la caché tras cambiar de modelo.
 */
export function urlModelo(urlManifiesto, man) {
    const u = new URL(man.archivo, urlManifiesto);
    u.searchParams.set("rev", String(man.revision));
    return u.href;
}

/** Pasa las detecciones con índices del modelo a índices del juego (descarta las que no son jugada). */
export function remapearClases(detecciones, mapaClases) {
    return detecciones
        .map((d) => ({ ...d, clase: mapaClases[d.clase] ?? -1 }))
        .filter((d) => d.clase >= 0);
}
