/**
 * Gabarits du script de purge et du fichier de remplacements (PLA-F-24).
 *
 * Deux invariants :
 *  1. le fichier de remplacements est le SEUL endroit où une valeur est écrite ;
 *  2. le script, lui, n'en contient aucune — il ne cite que des chemins.
 */

/** Marqueur écrit à la place de la valeur dans l'historique réécrit. */
export const REPLACEMENT_MARKER = '***REMOVED***';

/** Échappe une valeur pour la syntaxe `literal:` de `git filter-repo`. */
export function buildReplacementLine(value: string): string {
  const escaped = value
    .replace(/\r\n?/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `literal:${escaped}==>${REPLACEMENT_MARKER}`;
}

/** Contenu du fichier de remplacements (contient les valeurs, hors dépôt, 0600). */
export function buildReplacementsFile(values: readonly string[], generatedAt: string): string {
  const header = [
    '# Placard replacements file',
    `# Generated: ${generatedAt}`,
    '# Format: git filter-repo --replace-text, one pattern per line',
    '# THIS FILE CONTAINS THE SECRET VALUES. It is written outside the repository',
    '# with mode 0600 and must be deleted once the purge is done.',
  ];
  const lines = values.map(buildReplacementLine);
  return `${[...header, ...lines].join('\n')}\n`;
}

/**
 * Corps du script de purge. Il ne touche jamais au dépôt en place : il prend en
 * argument le clone miroir à réécrire. Les marqueurs `__…__` sont substitués
 * par `buildPurgeScript`.
 */
const SCRIPT_BODY = `#!/bin/sh
# Placard purge script
# Generated: __GENERATED_AT__
# Tool: placard __TOOL_VERSION__
#
# Removes the leaked values from a Git history using git filter-repo, or
# git filter-branch when filter-repo is not installed.
#
# THIS SCRIPT CONTAINS NO SECRET VALUE: the values live in the replacements
# file below, which Placard wrote outside the repository with mode 0600.
#
# Usage:
#   git clone --mirror <your-repo> mirror.git
#   sh <this-script> mirror.git
#   cd mirror.git && git push --force --all && git push --force --tags
#
# Placard never runs this script against your repository.
set -eu

REPO="\${1:-}"
if [ -z "$REPO" ] || [ ! -d "$REPO" ]; then
  echo "usage: $0 <path-to-mirror-clone>" >&2
  exit 2
fi

REPLACEMENTS="\${PLACARD_REPLACEMENTS:-__REPLACEMENTS__}"
HELPER="\${PLACARD_HELPER:-__HELPER__}"

if [ ! -f "$REPLACEMENTS" ]; then
  echo "placard: replacements file not found: $REPLACEMENTS" >&2
  echo "placard: re-run 'placard ritual purge' to regenerate it" >&2
  exit 3
fi

if git -C "$REPO" filter-repo --version >/dev/null 2>&1; then
  git -C "$REPO" filter-repo --force --replace-text "$REPLACEMENTS"
  echo "placard: history rewritten with git filter-repo"
else
  echo "placard: git-filter-repo not found, falling back to git filter-branch" >&2
  if ! command -v python3 >/dev/null 2>&1; then
    echo "placard: python3 is required for the filter-branch fallback" >&2
    exit 4
  fi
  if [ ! -f "$HELPER" ]; then
    echo "placard: fallback helper not found: $HELPER" >&2
    exit 3
  fi
  PLACARD_REPLACEMENTS="$REPLACEMENTS" FILTER_BRANCH_SQUELCH_WARNING=1 \\
    git -C "$REPO" filter-branch --force --prune-empty \\
    --tree-filter "python3 $HELPER" -- --all
  # filter-branch keeps the old history reachable under refs/original: drop it,
  # otherwise 'git log --all' still shows the leaked value.
  git -C "$REPO" for-each-ref --format='%(refname)' refs/original/ |
    while IFS= read -r ref; do
      if [ -n "$ref" ]; then
        git -C "$REPO" update-ref -d "$ref"
      fi
    done
  git -C "$REPO" reflog expire --expire=now --all
  git -C "$REPO" gc --prune=now -q
  echo "placard: history rewritten with git filter-branch"
fi

echo "placard: done. Review 'git -C \\"$REPO\\" log --all -p' before pushing."
`;

export interface PurgeScriptInput {
  toolVersion: string;
  generatedAt: string;
  replacementsPath: string;
  helperPath: string;
}

/** Assemble le script de purge à partir du gabarit et des chemins absolus. */
export function buildPurgeScript(input: PurgeScriptInput): string {
  return SCRIPT_BODY.replace('__GENERATED_AT__', input.generatedAt)
    .replace('__TOOL_VERSION__', input.toolVersion)
    .replace('__REPLACEMENTS__', input.replacementsPath)
    .replace('__HELPER__', input.helperPath);
}

/**
 * Aide du repli `filter-branch` : remplace les littéraux dans chaque arbre.
 * Aucune valeur dedans — elle lit le fichier de remplacements à l'exécution.
 */
export const FALLBACK_HELPER = `#!/usr/bin/env python3
"""Placard helper: rewrite every file of a tree with the replacements file.

Used only by the git filter-branch fallback of the Placard purge script.
Reads PLACARD_REPLACEMENTS from the environment; contains no secret value.
"""
import os
import sys


def load_pairs(path):
    pairs = []
    with open(path, encoding="utf-8", errors="surrogateescape") as handle:
        for raw in handle:
            line = raw.rstrip("\\n")
            if not line or line.startswith("#") or not line.startswith("literal:"):
                continue
            body = line[len("literal:"):]
            if "==>" not in body:
                continue
            value, target = body.split("==>", 1)
            value = value.replace("\\\\\\\\", "\\x00").replace("\\\\n", "\\n")
            value = value.replace("\\\\t", "\\t").replace("\\x00", "\\\\")
            if value:
                pairs.append((value, target))
    return pairs


def rewrite(pairs):
    for root, dirs, files in os.walk("."):
        if ".git" in dirs:
            dirs.remove(".git")
        for name in files:
            path = os.path.join(root, name)
            try:
                with open(path, "rb") as handle:
                    data = handle.read()
            except OSError:
                continue
            if b"\\x00" in data:
                continue
            text = data.decode("utf-8", "surrogateescape")
            updated = text
            for value, target in pairs:
                updated = updated.replace(value, target)
            if updated != text:
                with open(path, "wb") as handle:
                    handle.write(updated.encode("utf-8", "surrogateescape"))


def main():
    path = os.environ.get("PLACARD_REPLACEMENTS")
    if not path:
        sys.exit("placard: PLACARD_REPLACEMENTS is not set")
    pairs = load_pairs(path)
    if pairs:
        rewrite(pairs)


if __name__ == "__main__":
    main()
`;

/** Rend le contenu de l'aide du repli (aucune valeur, jamais). */
export function buildFallbackHelper(): string {
  return FALLBACK_HELPER;
}
