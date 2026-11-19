// ============================================================
// MICHIKEMBO — Cámara web: abrir, traducir errores y liberar SIEMPRE
// ============================================================

export class Camara {
    constructor(video) {
        this.video = video;
        this.stream = null;
    }

    get activa() {
        return !!this.stream;
    }

    /**
     * Abre la cámara frontal. Lanza un Error con un mensaje en español
     * que la interfaz puede mostrar tal cual.
     */
    async abrir() {
        if (this.stream) return;
        if (!window.isSecureContext) {
            throw new Error("La cámara solo funciona en https o en http://localhost. Abre el juego con un servidor local.");
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Este navegador no permite usar la cámara.");
        }
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
                audio: false,
            });
        } catch (e) {
            const mensajes = {
                NotAllowedError: "Permiso de cámara denegado. Actívalo en el candado de la barra de direcciones.",
                SecurityError: "Permiso de cámara denegado por el navegador.",
                NotFoundError: "No se encontró ninguna cámara conectada.",
                NotReadableError: "La cámara está ocupada por otra aplicación o pestaña.",
                OverconstrainedError: "La cámara no admite la resolución pedida.",
                AbortError: "La cámara se interrumpió al iniciar.",
            };
            throw new Error(mensajes[e.name] || `No se pudo abrir la cámara (${e.name || e.message}).`);
        }
        this.video.srcObject = this.stream;
        this.video.muted = true;
        this.video.playsInline = true;
        await this.video.play().catch(() => {});
        // Si el usuario desconecta la cámara a mitad de partida, se avisa
        for (const pista of this.stream.getVideoTracks()) {
            pista.addEventListener("ended", () => this.alTerminar?.());
        }
    }

    /** Libera la cámara (apaga la luz del dispositivo). Seguro de llamar varias veces. */
    cerrar() {
        if (this.stream) {
            for (const pista of this.stream.getTracks()) pista.stop();
        }
        this.stream = null;
        if (this.video) this.video.srcObject = null;
    }
}
