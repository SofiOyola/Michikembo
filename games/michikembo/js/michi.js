// ============================================================
// MICHIKEMBO — Reproductor de animaciones de Michi
//
// Lee animations.json y admite GIF directos además de sprite sheets PNG.
// Mientras un estado no tenga un archivo disponible, se
// muestra un marcador de posición claramente rotulado (no es arte final).
// Formato esperado: ver assets/michi/README.md.
// ============================================================

/** Estados lógicos acordados en el plan, con su marcador provisional. */
export const ESTADOS_MICHI = Object.freeze({
    idle: { emoji: "🐱", frase: "Miau… ¿jugamos?" },
    piedra: { emoji: "🐱", gesto: "✊", frase: "¡Elegí piedra!" },
    papel: { emoji: "🐱", gesto: "✋", frase: "¡Elegí papel!" },
    tijera: { emoji: "🐱", gesto: "✌️", frase: "¡Elegí tijera!" },
    feliz: { emoji: "😸", frase: "¡Esta ronda es mía!" },
    triste: { emoji: "😿", frase: "Miau… bien jugado." },
});

export class Michi {
    /**
     * @param {HTMLElement} raiz  contenedor con un <canvas class="michi-sprite"> y un <div class="michi-provisional">
     * @param {string} baseAssets ruta a assets/michi/ (con barra final)
     */
    constructor(raiz, baseAssets) {
        this.raiz = raiz;
        this.base = baseAssets;
        this.canvas = raiz.querySelector(".michi-sprite");
        this.ctx = this.canvas.getContext("2d");
        this.gif = raiz.querySelector(".michi-gif");
        this.provisional = raiz.querySelector(".michi-provisional");
        this.sprites = {};          // estado → { img, fotogramas, fps, bucle }
        this.meta = { frameAncho: 32, frameAlto: 32 };
        this.estado = null;
        this.inicio = 0;
    }

    /** Carga animations.json si existe. Si no existe, todo queda provisional. */
    async cargar() {
        let datos = null;
        try {
            const r = await fetch(this.base + "animations.json", { cache: "no-cache" });
            if (r.ok) datos = await r.json();
        } catch {
            datos = null;
        }
        if (!datos?.estados) return;
        this.meta.frameAncho = datos.frameAncho || 32;
        this.meta.frameAlto = datos.frameAlto || 32;
        this.canvas.width = this.meta.frameAncho;
        this.canvas.height = this.meta.frameAlto;
        await Promise.all(Object.entries(datos.estados).map(([nombre, info]) => new Promise((ok) => {
            const img = new Image();
            img.onload = () => {
                const esGif = info.tipo === "gif" || /\.gif(?:[?#].*)?$/i.test(info.archivo);
                this.sprites[nombre] = {
                    tipo: esGif ? "gif" : "sprite",
                    img,
                    src: this.base + info.archivo,
                    fotogramas: info.fotogramas || Math.max(1, Math.floor(img.width / this.meta.frameAncho)),
                    fps: info.fps || 8,
                    bucle: info.bucle !== false,
                };
                ok();
            };
            img.onerror = () => ok(); // el archivo aún no existe → marcador provisional
            img.src = this.base + info.archivo;
        })));
    }

    /** Cambia de animación (solo reinicia si el estado es distinto). */
    poner(estado, t) {
        if (estado === this.estado) return;
        this.estado = estado;
        this.inicio = t;
        const info = ESTADOS_MICHI[estado] || ESTADOS_MICHI.idle;
        const recurso = this.sprites[estado];
        const tieneGif = recurso?.tipo === "gif";
        const tieneSprite = recurso?.tipo === "sprite";
        this.raiz.dataset.animacion = estado;
        this.raiz.classList.toggle("con-sprite", tieneSprite);
        this.raiz.classList.toggle("con-gif", tieneGif);
        if (tieneGif) {
            // Quitar y restaurar src reinicia el GIF cuando comienza el estado.
            this.gif.removeAttribute("src");
            void this.gif.offsetWidth;
            this.gif.src = recurso.src;
            this.gif.alt = `Michi: ${estado}`;
        } else {
            this.gif.removeAttribute("src");
        }
        if (!tieneSprite && !tieneGif) {
            this.provisional.querySelector(".cara").textContent = info.emoji;
            this.provisional.querySelector(".gesto").textContent = info.gesto || "";
            this.provisional.querySelector(".rotulo").textContent = `animación pendiente: ${estado}`;
        }
        // Reinicia la animación CSS de "rebote" del marcador provisional
        this.raiz.classList.remove("cambio");
        void this.raiz.offsetWidth;
        this.raiz.classList.add("cambio");
    }

    /** Frase del bocadillo para el estado actual. */
    frase() {
        return (ESTADOS_MICHI[this.estado] || ESTADOS_MICHI.idle).frase;
    }

    /** Dibuja el fotograma correspondiente (llamar en cada requestAnimationFrame). */
    dibujar(t) {
        const s = this.sprites[this.estado];
        if (!s || s.tipo !== "sprite") return;
        let n = Math.floor(((t - this.inicio) / 1000) * s.fps);
        n = s.bucle ? n % s.fotogramas : Math.min(n, s.fotogramas - 1);
        const { frameAncho: w, frameAlto: h } = this.meta;
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.drawImage(s.img, n * w, 0, w, h, 0, 0, w, h);
    }
}
