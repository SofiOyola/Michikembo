// Fábrica de detectores: el resto del juego no sabe cuál está usando.
import { DetectorSimulado } from "./simulado.js";
import { DetectorOnnx } from "./onnx.js";

/** @param {"simulado-manual"|"simulado-aleatorio"|"onnx"} tipo */
export function crearDetector(tipo) {
    if (tipo === "onnx") return new DetectorOnnx();
    return new DetectorSimulado(tipo === "simulado-aleatorio" ? "aleatorio" : "manual");
}
