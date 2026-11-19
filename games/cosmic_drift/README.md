# Cosmic Drift dentro de la consola

El juego **no se copia aquí**: su código vive en <https://github.com/SofiOyola/Cosmic-Drift> (sin archivo LICENSE al 18/11/2026, así que no se redistribuye sin confirmar permiso).

## Instalar (una vez)

Desde la carpeta raíz del proyecto (la que contiene `console/` y `games/`), en la terminal de Windows o VS Code:

Windows (PowerShell, terminal de VS Code):

```text
powershell -ExecutionPolicy Bypass -File scripts\traer_cosmic_drift.ps1
```

Git Bash, Linux o macOS: `bash scripts/traer_cosmic_drift.sh`

El script clona el repositorio fijado al commit probado y copia solo la versión web en `games/cosmic_drift/fuente/` (carpeta ignorada por Git: su música pesa 54 MB y el repositorio original no tiene licencia).

Probado con el commit `4a8857983045e86b623e5d715ace600ed799a7e1`. Si el repositorio cambia de estructura (por ejemplo, mueve `js/camera.js` o `js/audio.js`), revisar `adapter.js`.

## Cómo se integra

- `adapter.js` monta `fuente/index.html` en un `<iframe>` de la misma procedencia, **sin modificar** el código fuente.
- **Escape**: si Cosmic Drift está jugando, su propio Escape lo lleva a su menú. Si ya está en su menú o en Game Over, Escape vuelve a la consola.
- **Al salir**: se llama a `cameraManager.stopCamera()` y se pausa la música del propio juego, se detienen los medios del documento y se descarga el iframe.
- Necesita internet: MediaPipe se descarga desde jsDelivr y Google Storage.

En la carpeta del proyecto (`/mnt/project-files/michikembo/`) ya está descargado en `fuente/`.
