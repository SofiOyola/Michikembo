// ============================================================
// CONSOLA MICHIKEMBO — CATÁLOGO DE CARTUCHOS (catalog.js)
// Cada juego vive en games/<id>/adapter.js y exporta un objeto
// con este contrato (igual para los tres juegos):
//
//   {
//     id, title, description,
//     status: "ready" | "pending",       // pending = aún no jugable
//     badge: "LISTO" | "MODELO PENDIENTE" | ...,
//     usesCamera: boolean,
//     createPreview(canvas) -> { frame(dtSegundos), dispose() }
//         Vista previa SIN cámara, SIN modelo y SIN audio.
//     async mount(host, api) -> instancia de juego con
//         start(), pause(), resume(), destroy()
//         api.exit() pide a la consola volver al menú.
//   }
//
// Para añadir o reordenar juegos basta con editar esta lista.
// ============================================================

import michikembo from "../../games/michikembo/adapter.js";
import cosmicDrift from "../../games/cosmic_drift/adapter.js";
import dinosaur from "../../games/dinosaur/adapter.js";

export const CATALOG = [michikembo, cosmicDrift, dinosaur];
