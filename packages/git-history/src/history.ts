import type {
  HistoryReader,
  ReadHistoryOptions,
  ReadHistoryResult,
  RepoSnapshot,
} from '@placard/core';

import { compileIgnorePatterns } from './ignore-paths';
import { walkLog } from './log-stream';
import { countCommits, readRepoSnapshot } from './repo-info';
import { HistoryScan } from './scan';
import { walkStaged } from './staged';

/**
 * Lecture en flux de l'historique Git (`@placard/git-history`).
 *
 * Le parcours émet un événement `repo`, puis, pour chaque commit, un événement
 * `commit` suivi de ses lignes ajoutées et retirées (PLA-F-01), des fichiers
 * ignorés (`skipped`), d'une progression régulière (PLA-F-12) et d'un
 * événement `end`. Rien n'est jamais chargé en entier en mémoire (PLA-N-04).
 */

/** Taille maximale d'un fichier analysé, en octets (1 Mio). */
export const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;

/** Paramètres normalisés d'un parcours. */
export interface ResolvedOptions {
  repoDir: string;
  refs?: string[];
  maxCommits: number;
  maxFileBytes: number;
  stagedOnly: boolean;
  onEvent: ReadHistoryOptions['onEvent'];
  signal?: AbortSignal;
}

/** Signal transmis à la lecture des métadonnées (aucun si l'annulation est déjà levée). */
function snapshotSignal(signal: AbortSignal | undefined): AbortSignal | undefined {
  return signal?.aborted === true ? undefined : signal;
}

function positiveOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Valide et complète les options du contrat (aucune valeur surprenante acceptée). */
export function resolveOptions(options: ReadHistoryOptions): ResolvedOptions {
  if (typeof options.repoDir !== 'string' || options.repoDir.trim() === '') {
    throw new Error('readHistory: repoDir is required');
  }
  if (typeof options.onEvent !== 'function') {
    throw new Error('readHistory: onEvent is required');
  }
  const resolved: ResolvedOptions = {
    repoDir: options.repoDir,
    maxCommits: positiveOr(options.maxCommits, 0),
    maxFileBytes: positiveOr(options.maxFileBytes, DEFAULT_MAX_FILE_BYTES),
    stagedOnly: options.stagedOnly === true,
    onEvent: options.onEvent,
  };
  if (options.refs !== undefined) resolved.refs = options.refs;
  if (options.signal !== undefined) resolved.signal = options.signal;
  return resolved;
}

/** Nombre de commits annoncé à la progression, borné par `maxCommits`. */
export function progressTotal(total: number, maxCommits: number): number {
  return maxCommits > 0 ? Math.min(total, maxCommits) : total;
}

/** Total annoncé : celui des références demandées, sinon celui du dépôt entier. */
async function announcedTotal(
  settings: ResolvedOptions,
  repo: RepoSnapshot,
): Promise<number> {
  const refs = settings.refs;
  const total =
    refs !== undefined && refs.length > 0
      ? await countCommits(settings.repoDir, refs, settings.signal)
      : repo.totalCommits;
  return progressTotal(total, settings.maxCommits);
}

/**
 * Lit l'historique du dépôt et émet les événements du contrat.
 * Déterministe à dépôt inchangé (PLA-P-05), sans exception sur contenu hostile
 * (PLA-P-10), sans requête réseau (PLA-N-01).
 */
export async function readHistory(options: ReadHistoryOptions): Promise<ReadHistoryResult> {
  const settings = resolveOptions(options);
  // La photographie du dépôt est locale et bornée : elle reste lisible même si
  // l'annulation est déjà demandée, pour que l'appelant reçoive un `repo` utile.
  const repo = await readRepoSnapshot(settings.repoDir, snapshotSignal(settings.signal));
  settings.onEvent({ kind: 'repo', repo });
  if (settings.signal?.aborted === true) {
    settings.onEvent({ kind: 'end', commits: 0, lines: 0 });
    return { repo, commits: 0, lines: 0, skipped: { binary: 0, tooLarge: 0 }, aborted: true };
  }
  const scan = new HistoryScan({
    repoDir: settings.repoDir,
    maxFileBytes: settings.maxFileBytes,
    ignore: compileIgnorePatterns(options.ignorePaths),
    emit: settings.onEvent,
  });
  let aborted = false;
  try {
    aborted = settings.stagedOnly
      ? await walkStaged({
          repoDir: settings.repoDir,
          scan,
          maxFileBytes: settings.maxFileBytes,
          signal: settings.signal,
        })
      : await walkLog({
          repoDir: settings.repoDir,
          scan,
          maxFileBytes: settings.maxFileBytes,
          maxCommits: settings.maxCommits,
          refs: settings.refs,
          total: await announcedTotal(settings, repo),
          signal: settings.signal,
        });
  } finally {
    scan.close();
  }
  const tally = scan.tally;
  scan.emitEnd();
  return {
    repo,
    commits: tally.commits,
    lines: tally.lines,
    skipped: { binary: tally.binary, tooLarge: tally.tooLarge },
    aborted,
  };
}

/** Fabrique un lecteur d'historique réutilisable (interface `HistoryReader`). */
export function createHistoryReader(): HistoryReader {
  return { read: readHistory };
}
