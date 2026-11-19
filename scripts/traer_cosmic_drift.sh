#!/usr/bin/env bash
# ============================================================
# Descarga la versión web de Cosmic Drift en games/cosmic_drift/
# desde su repositorio original, fijada a un commit concreto.
# Dónde ejecutarlo: terminal (Git Bash, Linux o macOS) en la raíz del repositorio.
#   bash scripts/traer_cosmic_drift.sh
# No modifica el proyecto original: solo copia sus archivos web.
# ============================================================
set -euo pipefail
REPO="https://github.com/SofiOyola/Cosmic-Drift.git"
COMMIT="${1:-4a8857983045e86b623e5d715ace600ed799a7e1}"   # commit probado con la consola (18/11/2026)
DESTINO="games/cosmic_drift/fuente"
TMP="$(mktemp -d)"
git clone --quiet "$REPO" "$TMP/cd"
git -C "$TMP/cd" checkout --quiet "$COMMIT"
mkdir -p "$DESTINO"
# Solo la versión web (index.html, css, js, assets, data y su documentación)
for x in index.html css js assets data README.md MIGRACION_WEB.md; do
  rm -rf "$DESTINO/$x"
  cp -R "$TMP/cd/$x" "$DESTINO/$x"
done
echo "$COMMIT" > "$DESTINO/COMMIT_ORIGEN.txt"
rm -rf "$TMP"
echo "Cosmic Drift copiado en $DESTINO (commit $COMMIT)"
