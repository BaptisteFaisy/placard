import path from 'node:path';

import type { RepoSnapshot } from '@placard/core';

import { runGit, streamGitLines, type GitResult } from './git-exec.js';
import { sanitizeText } from './sanitize.js';

/**
 * Photographie du dépôt avant le parcours (HEAD, références, nombre de commits,
 * distants). Tout est lu par des commandes Git locales : aucune requête réseau
 * (PLA-N-01), aucun contenu de fichier matérialisé (PLA-N-04).
 */

/** Options qui empêchent `git log` d'exécuter un programme externe ou de colorer. */
const SAFE_LOG_OPTIONS = ['--no-color', '--no-ext-diff', '--no-textconv'] as const;

/** Hôtes manifestement privés : un distant qui pointe dessus n'est pas public. */
const PRIVATE_HOST = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;
const PRIVATE_SUFFIX = /\.(local|internal|lan|localhost|home|corp)$/i;

/** Un distant est « public » s'il est joignable en http(s) sur un hôte non privé. */
export function isPublicRemote(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname;
  if (host === '' || PRIVATE_HOST.test(host) || PRIVATE_SUFFIX.test(host)) return false;
  return host.includes('.') || host.startsWith('[');
}

/** Exécute Git et renvoie la sortie, ou `undefined` en cas d'échec (dépôt vide, etc.). */
async function gitText(
  repoDir: string,
  args: readonly string[],
  signal?: AbortSignal,
): Promise<string | undefined> {
  const result: GitResult = await runGit(repoDir, { args }, signal);
  return result.code === 0 ? result.stdout.trim() : undefined;
}

/** Liste triée des références d'un espace de noms (`refs/heads`, `refs/tags`). */
async function gitRefs(
  repoDir: string,
  namespace: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const output = await gitText(
    repoDir,
    ['for-each-ref', '--format=%(refname:short)', namespace],
    signal,
  );
  if (output === undefined || output === '') return [];
  return output.split('\n').map((line) => sanitizeText(line.trim())).filter((line) => line !== '');
}

/** URLs uniques des distants, dans l'ordre stable de `git remote -v`. */
async function gitRemotes(repoDir: string, signal?: AbortSignal): Promise<string[]> {
  const output = await gitText(repoDir, ['remote', '-v'], signal);
  if (output === undefined || output === '') return [];
  const urls = new Set<string>();
  for (const line of output.split('\n')) {
    const parts = line.split(/\s+/);
    const url = parts[1];
    if (url !== undefined && url !== '' && !url.startsWith('(')) urls.add(sanitizeText(url));
  }
  return [...urls];
}

/**
 * Nombre de commits atteignables depuis `refs` (toutes les références quand la
 * liste est vide). Sert à la progression du parcours (PLA-F-12).
 */
export async function countCommits(
  repoDir: string,
  refs: readonly string[] = [],
  signal?: AbortSignal,
): Promise<number> {
  const args = ['rev-list', '--count', ...(refs.length === 0 ? ['--all'] : [...refs])];
  const output = await gitText(repoDir, args, signal);
  const count = Number(output ?? '0');
  return Number.isFinite(count) && count > 0 ? count : 0;
}

interface DateRange {
  first?: string;
  last?: string;
}

/**
 * Dates du plus ancien et du plus récent commit. Le flux est consommé en
 * entier mais seules deux valeurs sont conservées en mémoire (PLA-N-04).
 */
async function gitDateRange(repoDir: string, signal?: AbortSignal): Promise<DateRange> {
  let first: string | undefined;
  let last: string | undefined;
  await streamGitLines(
    repoDir,
    { args: ['log', '--all', '--format=%aI', ...SAFE_LOG_OPTIONS] },
    (line) => {
      const value = line.trim();
      if (value === '') return;
      if (last === undefined) last = value;
      first = value;
    },
    signal,
  );
  const range: DateRange = {};
  if (first !== undefined) range.first = first;
  if (last !== undefined) range.last = last;
  return range;
}

/** Nom lisible du dépôt (nom du dossier, sans le suffixe `.git`). */
export function repoName(repoDir: string): string {
  const resolved = path.basename(path.resolve(repoDir));
  return resolved.endsWith('.git') && resolved.length > 4 ? resolved.slice(0, -4) : resolved;
}

/** Vérifie que le dossier est bien un dépôt Git lisible. */
export async function assertGitRepo(repoDir: string, signal?: AbortSignal): Promise<void> {
  const result = await runGit(repoDir, { args: ['rev-parse', '--git-dir'] }, signal);
  if (result.code !== 0) {
    throw new Error(`not a git repository: ${repoDir}`);
  }
}

/** Lit la photographie complète du dépôt. */
export async function readRepoSnapshot(
  repoDir: string,
  signal?: AbortSignal,
): Promise<RepoSnapshot> {
  await assertGitRepo(repoDir, signal);
  const head = (await gitText(repoDir, ['rev-parse', 'HEAD'], signal)) ?? '';
  const [totalCommits, branches, tags, remotes, range] = await Promise.all([
    countCommits(repoDir, [], signal),
    gitRefs(repoDir, 'refs/heads', signal),
    gitRefs(repoDir, 'refs/tags', signal),
    gitRemotes(repoDir, signal),
    gitDateRange(repoDir, signal),
  ]);
  const snapshot: RepoSnapshot = {
    name: repoName(repoDir),
    head,
    shortHead: head.slice(0, 7),
    totalCommits,
    branches,
    tags,
    publicRemote: remotes.some((url) => isPublicRemote(url)),
    remotes,
  };
  if (range.first !== undefined) snapshot.firstCommitDate = range.first;
  if (range.last !== undefined) snapshot.lastCommitDate = range.last;
  return snapshot;
}
