#!/usr/bin/env bash
# Publication npm des paquets partagés de Placard (@placard/core,
# @placard/detectors, @placard/analysis, @placard/ritual).
#
# Ce script se lance À LA MAIN, sur une machine où un compte npm est
# configuré (`npm whoami` doit répondre). Aucun autre script ni job CI ne
# l'appelle : le workflow de release (.github/workflows/release.yml) rejoue
# les étapes explicitement, sous le contrôle du secret NODE_AUTH_TOKEN.
#
# Le script refuse de publier si :
#   - l'arbre de travail est sale (le paquet publié doit correspondre à un
#     commit) ;
#   - la version demandée existe déjà sur le registre ;
#   - le build est incomplet ou le paquet préparé n'est pas publiable.
#
# Usage :
#   tools/publish.sh                    # les quatre paquets cœur
#   tools/publish.sh detectors core     # un sous-ensemble
#   tools/publish.sh --dry-run          # vérifie tout, ne publie rien
#   tools/publish.sh --tag next         # publie sous une étiquette précise
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"

PAQUETS_DISPO=(core detectors analysis ritual)
PAQUETS=()
ETIQUETTE='latest'
MODE_PUBLICATION=1

die() {
  echo "publish: $*" >&2
  exit 1
}

info() {
  echo "publish: $*"
}

usage() {
  sed -n '2,21p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

# --- Arguments -------------------------------------------------------------
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      MODE_PUBLICATION=0
      shift
      ;;
    --tag)
      ETIQUETTE="${2:?--tag attend une étiquette}"
      shift 2
      ;;
    --tag=*)
      ETIQUETTE="${1#--tag=}"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      PAQUETS+=("$1")
      shift
      ;;
  esac
done

if [ "${#PAQUETS[@]}" -eq 0 ]; then
  PAQUETS=("${PAQUETS_DISPO[@]}")
fi
for paquet in "${PAQUETS[@]}"; do
  connu=0
  for disponible in "${PAQUETS_DISPO[@]}"; do
    [ "$paquet" = "$disponible" ] && connu=1
  done
  [ "$connu" -eq 1 ] || die "paquet non publiable : $paquet"
done

# --- Garde-fous ------------------------------------------------------------
command -v node >/dev/null || die "node absent du PATH"
command -v npm >/dev/null || die "npm absent du PATH"
command -v pnpm >/dev/null || die "pnpm absent du PATH"

if [ -n "$(git status --porcelain)" ]; then
  die "arbre de travail sale : commitez avant de publier"
fi

if [ "$MODE_PUBLICATION" -eq 1 ]; then
  npm whoami >/dev/null 2>&1 || die "aucun compte npm configuré (npm whoami échoue)"
fi

# --- Construction ----------------------------------------------------------
info "construction des paquets..."
pnpm build:paquets >/dev/null

info "préparation des paquets..."
node tools/prepare-publish.mjs "${PAQUETS[@]}"

# --- Vérification ----------------------------------------------------------
for paquet in "${PAQUETS[@]}"; do
  dossier=".publish/${paquet}"
  [ -d "$dossier" ] || die "paquet non préparé : $dossier"
  (cd "$dossier" && node ../../tools/check-publishable.mjs)
  nom="$(node -e "console.log(require('./$dossier/package.json').name)")"
  version="$(node -e "console.log(require('./$dossier/package.json').version)")"
  if npm view "$nom@$version" version >/dev/null 2>&1; then
    die "version déjà publiée sur le registre : $nom@$version"
  fi
  info "contenu de $nom@$version :"
  (cd "$dossier" && npm pack --dry-run 2>&1 | sed 's/^/  /')
done

# --- Publication -----------------------------------------------------------
if [ "$MODE_PUBLICATION" -eq 0 ]; then
  info "simulation terminée (--dry-run) : rien n'a été publié"
  exit 0
fi

for paquet in "${PAQUETS[@]}"; do
  dossier=".publish/${paquet}"
  info "publication de $dossier..."
  (cd "$dossier" && npm publish --access public --tag "$ETIQUETTE")
done
info "publication terminée"
