#!/usr/bin/env bash
# scripts/build-win.sh — fabrique l'installeur Windows (dist/AIMAIL-Setup-<version>.exe)
# Sous Windows (Git Bash / MSYS) : build natif. Ailleurs : via Docker (image electronuserland/builder:wine),
# sans toucher au node_modules local. Options : --native (forcer le build natif), --no-cache (réinstaller les dépendances).
set -euo pipefail
cd "$(dirname "$0")/.."

NATIVE=0; NOCACHE=0
for a in "$@"; do case "$a" in --native) NATIVE=1 ;; --no-cache) NOCACHE=1 ;; *) echo "option inconnue : $a" >&2; exit 2 ;; esac; done

say() { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# caches electron-builder laissés en root par un ancien build Docker : on les rend à l'utilisateur
fix_cache_perms() {
  local bad=()
  for d in "$HOME/.cache/electron" "$HOME/.cache/electron-builder" "$HOME/.cache/aimail-build-home" "$PWD/dist" "$PWD/node_modules"; do
    [ -e "$d" ] || continue
    if [ -n "$(find "$d" ! -user "$(id -un)" -print -quit 2>/dev/null)" ]; then bad+=("$d"); fi
  done
  [ ${#bad[@]} -eq 0 ] && return 0
  say "Fichiers appartenant à un autre utilisateur (root ?) dans : ${bad[*]} — correction (sudo)"
  sudo chown -R "$(id -u):$(id -g)" "${bad[@]}" || die "Impossible de corriger les droits ; lancez : sudo chown -R \$USER:\$USER ${bad[*]}"
}

VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "?")
[ -f resources/icon.ico ] || say "resources/icon.ico absent : l'icône Electron par défaut sera utilisée (convert resources/icon.png -define icon:auto-resize=256,128,64,48,32,16 resources/icon.ico)"

build_native() {
  say "Build natif Windows (version $VERSION)"
  command -v node >/dev/null || die "Node.js est requis (https://nodejs.org)"
  [ "$NOCACHE" = 1 ] && rm -rf node_modules
  [ -d node_modules ] || npm ci
  npm run typecheck
  npm run dist:win
}

build_docker() {
  say "Build Windows via Docker (version $VERSION)"
  command -v docker >/dev/null || die "Docker est requis sur cette plateforme (ou lancez ce script sous Windows avec --native)"
  docker info >/dev/null 2>&1 || die "Le démon Docker ne répond pas (service arrêté ? droits sur /var/run/docker.sock ?)"
  local UID_GID; UID_GID="$(id -u):$(id -g)"
  local VOL=aimail-win-node_modules
  if [ "$NOCACHE" = 1 ]; then docker volume rm "$VOL" >/dev/null 2>&1 || true; fi
  if ! docker volume inspect "$VOL" >/dev/null 2>&1; then
    say "Création du volume de dépendances $VOL"
    docker volume create "$VOL" >/dev/null
    docker run --rm -v "$VOL:/nm" alpine chown -R "$UID_GID" /nm
  fi
  # dossier personnel du conteneur (Wine exige un HOME appartenant à l'utilisateur) + caches Electron persistants
  local BHOME="$HOME/.cache/aimail-build-home"
  mkdir -p "$BHOME/.cache/electron" "$BHOME/.cache/electron-builder" "$BHOME/.wine"
  docker run --rm -t -u "$UID_GID" \
    -v "$PWD":/project -w /project \
    -v "$VOL":/project/node_modules \
    -v "$BHOME":/home/builder \
    -e HOME=/home/builder -e WINEPREFIX=/home/builder/.wine -e WINEDEBUG=-all \
    -e GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}" -e GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}" -e MS_CLIENT_ID="${MS_CLIENT_ID:-}" \
    electronuserland/builder:wine \
    bash -c "npm ci --no-audit --no-fund --ignore-scripts && npm run typecheck && (cd node_modules/better-sqlite3 && npx prebuild-install -r electron -t \$(node -p \"require('electron/package.json').version\") --platform win32 --arch x64 --verbose) && npm run dist:win"
}

[ "$(uname -s)" = "Darwin" ] || [ "$(uname -s)" = "Linux" ] && fix_cache_perms
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) build_native ;;
  *) if [ "$NATIVE" = 1 ]; then build_native; else build_docker; fi ;;
esac

# contrôle : le module SQLite embarqué doit être un binaire Windows (PE32+), pas Linux (ELF)
NODE_BIN=$(ls dist/win-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node 2>/dev/null || true)
if [ -n "$NODE_BIN" ]; then
  if head -c 2 "$NODE_BIN" | grep -q 'MZ'; then say "better_sqlite3.node : binaire Windows ✔"
  else die "better_sqlite3.node est un binaire Linux : l'application ne démarrera pas sous Windows (relancez avec --no-cache)"; fi
else say "better_sqlite3.node introuvable dans dist/win-unpacked (vérifiez asarUnpack)"; fi

EXE=$(ls -t dist/*.exe 2>/dev/null | grep -v uninstaller | head -1 || true)
[ -n "$EXE" ] || die "Aucun .exe produit dans dist/"
say "Installeur prêt : $EXE ($(du -h "$EXE" | cut -f1))"