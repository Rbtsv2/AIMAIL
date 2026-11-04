#!/usr/bin/env bash
# scripts/build-linux.sh — fabrique les paquets Linux : AppImage (universel), .deb (Debian/Ubuntu), .rpm (Fedora/openSUSE)
# Icônes : resources/icon.png (512×512 minimum) ; le script génère les tailles nécessaires dans resources/icons/.
# Options : --appimage | --deb | --rpm (une ou plusieurs ; par défaut les trois), --no-cache (réinstaller les dépendances),
#           --docker (construire dans electronuserland/builder, utile si rpmbuild/fakeroot manquent sur la machine).
set -euo pipefail
cd "$(dirname "$0")/.."

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

TARGETS=(); NOCACHE=0; DOCKER=0
for a in "$@"; do case "$a" in
  --appimage) TARGETS+=(AppImage) ;; --deb) TARGETS+=(deb) ;; --rpm) TARGETS+=(rpm) ;;
  --no-cache) NOCACHE=1 ;; --docker) DOCKER=1 ;;
  *) echo "option inconnue : $a" >&2; exit 2 ;;
esac; done
[ ${#TARGETS[@]} -gt 0 ] || TARGETS=(AppImage deb rpm)
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "?")

prepare_icons() {
  [ -f resources/icon.png ] || die "resources/icon.png manquant (PNG carré, 512×512 ou plus)"
  mkdir -p resources/icons
  if command -v convert >/dev/null; then
    for s in 16 32 48 64 128 256 512; do
      [ -f "resources/icons/${s}x${s}.png" ] || convert resources/icon.png -resize "${s}x${s}" "resources/icons/${s}x${s}.png"
    done
    say "Icônes Linux prêtes dans resources/icons/ (16 → 512 px)"
  else
    say "ImageMagick absent (sudo apt install imagemagick) : electron-builder redimensionnera lui-même resources/icon.png"
  fi
}

build_native() {
  say "Build Linux natif (version $VERSION) : ${TARGETS[*]}"
  command -v node >/dev/null || die "Node.js est requis"
  [ "$NOCACHE" = 1 ] && rm -rf node_modules
  [ -d node_modules ] || npm ci
  npm run typecheck
  local args=(); for t in "${TARGETS[@]}"; do args+=("--linux" "$t"); done
  npx electron-vite build
  npx electron-builder "${args[@]}"
}

build_docker() {
  say "Build Linux via Docker (version $VERSION) : ${TARGETS[*]}"
  command -v docker >/dev/null || die "Docker est requis"
  docker info >/dev/null 2>&1 || die "Le démon Docker ne répond pas"
  local UID_GID; UID_GID="$(id -u):$(id -g)"
  local VOL=aimail-linux-node_modules
  [ "$NOCACHE" = 1 ] && { docker volume rm "$VOL" >/dev/null 2>&1 || true; }
  if ! docker volume inspect "$VOL" >/dev/null 2>&1; then
    docker volume create "$VOL" >/dev/null
    docker run --rm -v "$VOL:/nm" alpine chown -R "$UID_GID" /nm
  fi
  local BHOME="$HOME/.cache/aimail-build-home"; mkdir -p "$BHOME/.cache/electron" "$BHOME/.cache/electron-builder"
  local tl=""; for t in "${TARGETS[@]}"; do tl+=" --linux $t"; done
  docker run --rm -t -u "$UID_GID" \
    -v "$PWD":/project -w /project -v "$VOL":/project/node_modules -v "$BHOME":/home/builder -e HOME=/home/builder \
    electronuserland/builder \
    bash -c "npm ci --no-audit --no-fund && npm run typecheck && npx electron-vite build && npx electron-builder $tl"
}

fix_cache_perms
prepare_icons
if [ "$DOCKER" = 1 ] || [ "$(uname -s)" != "Linux" ]; then build_docker; else
  # rpm et deb exigent des outils système ; sinon, bascule vers Docker
  for t in "${TARGETS[@]}"; do
    case "$t" in rpm) command -v rpmbuild >/dev/null || { say "rpmbuild absent → build via Docker"; DOCKER=1; } ;; deb) command -v fakeroot >/dev/null || { say "fakeroot absent → build via Docker"; DOCKER=1; } ;; esac
  done
  if [ "$DOCKER" = 1 ]; then build_docker; else build_native; fi
fi

say "Paquets prêts :"; ls -lh dist/*.AppImage dist/*.deb dist/*.rpm 2>/dev/null | awk '{print "   " $NF " (" $5 ")"}'
printf '\nInstallation :\n  AppImage : chmod +x dist/*.AppImage && ./dist/AIMAIL-%s.AppImage\n  Debian   : sudo apt install ./dist/aimail_%s_amd64.deb\n  Fedora   : sudo dnf install ./dist/aimail-%s.x86_64.rpm\n' "$VERSION" "$VERSION" "$VERSION"