#!/usr/bin/env bash
# scripts/build-mac.sh — fabrique les paquets macOS (dist/AIMAIL-<version>.dmg et .zip, Intel + Apple Silicon)
# Un .dmg ne peut être produit et signé que sur macOS. Sur une autre plateforme, le script déclenche le build
# sur GitHub Actions (workflow .github/workflows/build.yml) si la CLI `gh` est installée, puis récupère les fichiers.
# Signature/notarisation (facultatif, sur macOS) : exporter APPLE_ID, APPLE_APP_PASSWORD, APPLE_TEAM_ID
# et CSC_LINK / CSC_KEY_PASSWORD (certificat Developer ID exporté en .p12). Sans cela : paquet non signé.
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

NOCACHE=0
for a in "$@"; do case "$a" in --no-cache) NOCACHE=1 ;; *) echo "option inconnue : $a" >&2; exit 2 ;; esac; done

VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "?")

build_native() {
  say "Build macOS natif (version $VERSION)"
  command -v node >/dev/null || die "Node.js est requis (https://nodejs.org)"
  xcode-select -p >/dev/null 2>&1 || die "Outils en ligne de commande Xcode requis : xcode-select --install"
  [ "$NOCACHE" = 1 ] && rm -rf node_modules
  [ -d node_modules ] || npm ci
  npm run typecheck
  if [ -z "${CSC_LINK:-}" ]; then
    say "Aucun certificat (CSC_LINK) : paquet non signé — Gatekeeper demandera « Ouvrir quand même » au premier lancement"
    export CSC_IDENTITY_AUTO_DISCOVERY=false
  fi
  [ -n "${APPLE_ID:-}" ] && say "Notarisation activée (APPLE_ID=$APPLE_ID)"
  npx electron-vite build
  npx electron-builder --mac --x64 --arm64
  local OUT; OUT=$(ls -t dist/*.dmg 2>/dev/null | head -1 || true)
  [ -n "$OUT" ] || die "Aucun .dmg produit dans dist/"
  say "Paquets prêts :"; ls -lh dist/*.dmg dist/*.zip 2>/dev/null | awk '{print "   " $NF " (" $5 ")"}'
}

build_remote() {
  say "Pas sous macOS : build déporté sur GitHub Actions"
  command -v gh >/dev/null || die "Installez la CLI GitHub (https://cli.github.com) et faites 'gh auth login', ou lancez le workflow « Build » depuis l'onglet Actions du dépôt"
  gh auth status >/dev/null 2>&1 || die "Non connecté : gh auth login"
  local BRANCH; BRANCH=$(git rev-parse --abbrev-ref HEAD)
  say "Déclenchement du workflow Build sur la branche $BRANCH"
  gh workflow run build.yml --ref "$BRANCH"
  sleep 5
  local RUN; RUN=$(gh run list --workflow=build.yml --branch "$BRANCH" --limit 1 --json databaseId -q '.[0].databaseId')
  [ -n "$RUN" ] || die "Exécution introuvable"
  say "Suivi de l'exécution $RUN (quelques minutes)…"
  gh run watch "$RUN" --exit-status || die "Le build a échoué : gh run view $RUN --log"
  mkdir -p dist
  gh run download "$RUN" -n aimail-macos-latest -D dist
  say "Paquets téléchargés :"; ls -lh dist/*.dmg dist/*.zip 2>/dev/null | awk '{print "   " $NF " (" $5 ")"}'
}

fix_cache_perms
case "$(uname -s)" in
  Darwin) build_native ;;
  *) build_remote ;;
esac