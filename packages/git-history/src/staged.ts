import { runGit, streamGitLines } from './git-exec';
import { DIFF_ARGS } from './log-stream';
import type { RawCommit } from './log-stream';
import type { HistoryScan } from './scan';
import { sanitizeText } from './sanitize';

/**
 * Mode `--staged` (PLA-F-10) : analyse des seules modifications indexées.
 *
 * `git diff --cached` produit exactement la même forme de diff que `git log -p`,
 * il est donc traité par le même parseur. Tout est rattaché à un unique
 * « commit » virtuel, dont le SHA est celui de HEAD : les modifications
 * indexées s'appliquent par-dessus HEAD, et cette valeur reste déterministe
 * pour un dépôt inchangé (PLA-P-05).
 */

const EMPTY_TREE = '0'.repeat(40);

interface HeadInfo {
  sha: string;
  timestamp: number;
  author: string;
}

/** Identité du commit virtuel : celle de HEAD, ou un SHA nul sur un dépôt vide. */
export async function readHeadInfo(
  repoDir: string,
  signal?: AbortSignal,
): Promise<HeadInfo> {
  const result = await runGit(
    repoDir,
    { args: ['log', '-1', '--format=%H%x1f%at%x1f%an', 'HEAD'] },
    signal,
  );
  const line = result.stdout.split('\n')[0] ?? '';
  const parts = line.split('\u001f');
  const sha = parts[0] ?? '';
  const timestamp = Number(parts[1] ?? '0');
  return {
    sha: /^[0-9a-f]{40}$/.test(sha) ? sha : EMPTY_TREE,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    author: parts[2] !== undefined && parts[2] !== '' ? parts[2] : 'index',
  };
}

/** Commande `git diff --cached` du mode indexé. */
export function buildStagedCommand(maxFileBytes: number) {
  return {
    config: [`core.bigFileThreshold=${maxFileBytes}`],
    args: ['diff', '--cached', ...DIFF_ARGS],
  };
}

/** Parcourt l'index et alimente le scan ; renvoie vrai si annulé. */
export async function walkStaged(options: {
  repoDir: string;
  scan: HistoryScan;
  maxFileBytes: number;
  signal?: AbortSignal;
}): Promise<boolean> {
  const head = await readHeadInfo(options.repoDir, options.signal);
  const record: RawCommit = {
    commit: head.sha,
    shortCommit: head.sha === EMPTY_TREE ? 'staged' : head.sha.slice(0, 7),
    timestamp: head.timestamp,
    author: head.author,
    subject: 'Staged changes',
  };
  options.scan.emitProgress(0, 1);
  options.scan.beginCommit(record, 0);
  const stream = await streamGitLines(
    options.repoDir,
    buildStagedCommand(options.maxFileBytes),
    async (line: string) => {
      await options.scan.diffLine(line);
    },
    options.signal,
  );
  options.scan.emitProgress(1, 1);
  if (!stream.aborted && stream.code !== 0) {
    throw new Error(`git diff --cached failed: ${sanitizeText(stream.stderr).trim()}`);
  }
  return stream.aborted;
}
