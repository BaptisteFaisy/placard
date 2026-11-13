import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { baseEnv, git } from './commit';
import { generate, type GenerateOptions, type GenerateResult } from './index';

/**
 * Petits utilitaires partagés par les tests du générateur.
 *
 * Ils passent par de **vrais appels Git** : l'oracle n'est cru que s'il est
 * confirmé par le dépôt effectivement produit.
 */

/** Date de référence figée : sans elle, deux générations ne sont pas comparables. */
export const FIXED_HEAD_DATE = new Date('2026-10-31T00:00:00Z');

/**
 * Options rapides mais complètes, pour les tests qui n'ont pas besoin des 120
 * commits. Le nombre de commits est volontairement modeste : chaque commit
 * coûte deux processus Git, et la CI tourne sur un runner partagé.
 */
export const FAST_OPTIONS = {
  commits: 40,
  years: 2,
  headDate: FIXED_HEAD_DATE,
} as const;

/** Génère un dépôt dans un dossier temporaire dédié. */
export async function makeRepo(
  overrides: Partial<GenerateOptions> = {},
): Promise<GenerateResult> {
  const targetDir = await mkdtemp(join(tmpdir(), 'placard-demo-'));
  return generate({ seed: 'placard-demo', ...FAST_OPTIONS, ...overrides, targetDir });
}

/** Lance Git dans le dépôt généré. */
export function repoGit(dir: string, args: readonly string[]): Promise<string> {
  return git(dir, args, baseEnv());
}

/** Contenu d'un chemin à une révision, ou `undefined` si le chemin n'y existe pas. */
export async function showAt(
  dir: string,
  rev: string,
  path: string,
): Promise<string | undefined> {
  try {
    return await repoGit(dir, ['show', `${rev}:${path}`]);
  } catch {
    return undefined;
  }
}

/** Chemins de l'arbre d'une révision. */
export async function pathsAt(dir: string, rev: string): Promise<string[]> {
  const output = await repoGit(dir, ['ls-tree', '-r', '--name-only', rev]);
  return output.split('\n').filter((line) => line.length > 0);
}

/** Chemins de l'arbre d'une révision dont le contenu contient la valeur. */
export async function pathsContaining(
  dir: string,
  rev: string,
  value: string,
): Promise<string[]> {
  const paths = await pathsAt(dir, rev);
  const matches: string[] = [];
  for (const path of paths) {
    const content = await showAt(dir, rev, path);
    if (content !== undefined && content.includes(value)) matches.push(path);
  }
  return matches;
}

/** SHA de tous les commits, du plus ancien au plus récent. */
export async function allShas(dir: string): Promise<string[]> {
  const output = await repoGit(dir, ['rev-list', '--reverse', 'HEAD']);
  return output.split('\n').filter((line) => line.length > 0);
}
