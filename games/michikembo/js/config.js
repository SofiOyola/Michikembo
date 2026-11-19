// ============================================================
// MICHIKEMBO — Configuración central del JUEGO
// Todos los tiempos están en milisegundos.
// Los valores marcados "PROPUESTA" deben validarse con webcam y el modelo real.
//
// Lo que depende del MODELO (archivo, clases, umbral de confianza, IoU) NO
// está aquí: vive en assets/models/michikembo/current/manifest.json.
// ============================================================

export const CONFIG = Object.freeze({
    META_POR_DEFECTO: 3,              // "Primero en ganar 3" (opciones 1, 3, 5, 7)

    // Tiempos de la ronda
    DURACION_PREPARAR_PRIMERA: 2200,  // primera ronda: recordar cómo encuadrar la mano
    DURACION_PREPARAR: 900,           // rondas siguientes
    DURACION_NUMERO: 900,             // duración del 3 y del 2
    DURACION_UNO: 800,                // el "1": Michi revela su jugada y se abre la captura
    VENTANA_CAPTURA: 2000,            // PROPUESTA: captura total desde que aparece el "1" (1–2 s)
    DURACION_EVALUAR: 450,            // breve pausa antes de mostrar el resultado
    DURACION_RESULTADO: 2800,         // resultado de la ronda (se puede saltar con CONTINUAR)
    DURACION_ESPERA: 900,             // "Siguiente ronda…" (se puede saltar)

    // Filtro temporal (estabilizador.js)
    FPS_DETECCION: 15,                // inferencias por segundo como máximo
    FOTOGRAMAS_ESTABLES: 5,           // PROPUESTA: fotogramas SEGUIDOS con el mismo gesto para darlo por estable
    MINIMO_FOTOGRAMAS: 5,             // si en la ventana se analizan menos, la ronda no se puntúa ("insuficiente")

    // Umbral SOLO para el detector simulado (el real usa el del manifiesto)
    CONFIANZA_SIMULADO: 0.6,

    // Detector: "onnx" (modelo real) o "simulado-manual" / "simulado-aleatorio"
    DETECTOR_POR_DEFECTO: "onnx",
});
