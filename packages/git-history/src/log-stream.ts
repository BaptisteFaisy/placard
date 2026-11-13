import type { GitCommand } from './git-exec';
import { streamGitLines } from './git-exec';
import type { HistoryScan } from './scan';
import { sanitizeText } from './sanitize';

/**
 * Parcours de `git log --all` en flux.
 *
 * Un enregistrement de commit est délimité par un marqueur de contrôle placé en
 * début de ligne par `--format`. Les lignes de diff, elles, commencent toujours
 * par `+`, `-`, ` `, `@@`, `diff --git`, `index` ou `Binary files` : un contenu
 * hostile ne peut donc pas se faire passer pour un enregistrement (PLA-N-03).
 */

/** Marqueur de début d'enregistrement, impossible à produire par du contenu de diff. */
export const RECORD_MARKER = '\u001eplacard\u001f';

const FIELD = '\u001f';
const COMMIT_SHA = /^[0-9a-f]{7,64}$/;
/** Émission d'une progression tous les N commits (déterministe, PLA-P-05). */
export const PROGRESS_STRIDE = 25;

export interface RawCommit {
  commit: string;
  shortCommit: string;
  timestamp: number;
  author: string;
  subject: string;
}

export interface LogOptions {
  refs?: readonly string[];
  maxCommits?: number;
  maxFileBytes: number;
}

export interface WalkLogOptions extends LogOptions {
  repoDir: string;
  scan: HistoryScan;
  /** Nombre total de commits attendu, pour la progression. */
  total: number;
  signal?: AbortSignal;
}

/** Chaîne de format d'un enregistrement de commit. */
export function logFormatArg(): string {
  return `--format=${RECORD_MARKER}%H${FIELD}%h${FIELD}%at${FIELD}%an${FIELD}%s`;
}

/** Lit un enregistrement de commit ; `undefined` pour toute autre ligne. */
export function parseRecord(line: string): RawCommit | undefined {
  if (!line.startsWith(RECORD_MARKER)) return undefined;
  const parts = line.slice(RECORD_MARKER.length).split(FIELD);
  const commit = parts[0] ?? '';
  if (!COMMIT_SHA.test(commit)) return undefined;
  const timestamp = Number(parts[2] ?? '0');
  return {
    commit,
    shortCommit: parts[1] !== undefined && parts[1] !== '' ? parts[1] : commit.slice(0, 7),
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    author: parts[3] ?? '',
    subject: parts.slice(4).join(FIELD),
  };
}

/** Refuse les références qui ressemblent à des options (injection d'arguments). */
export function normalizeRefs(refs: readonly string[] | undefined): string[] {
  const clean: string[] = [];
  for (const ref of refs ?? []) {
    const value = ref.trim();
    if (value === '') continue;
    if (value.startsWith('-')) throw new Error(`invalid git ref: ${value}`);
    clean.push(value);
  }
  return clean;
}

/** Options communes aux parcours de diff (identiques en mode historique et indexé). */
export const DIFF_ARGS: readonly string[] = [
  '--patch',
  '--unified=0',
  '--full-index',
  '--no-color',
  '--no-ext-diff',
  '--no-textconv',
  '--no-renames',
  '--src-prefix=a/',
  '--dst-prefix=b/',
  '--encoding=UTF-8',
];

/** Commande `git log` du parcours complet. */
export function buildLogCommand(options: LogOptions): GitCommand {
  const args = ['log', logFormatArg(), ...DIFF_ARGS, '--no-notes', '--no-decorate'];
  if (options.maxCommits !== undefined && options.maxCommits > 0) {
    args.push(`--max-count=${options.maxCommits}`);
  }
  const refs = normalizeRefs(options.refs);
  if (refs.length === 0) args.push('--all');
  else args.push(...refs);
  return { config: [`core.bigFileThreshold=${options.maxFileBytes}`], args };
}

/** Répartit chaque ligne de la sortie entre enregistrements de commit et diff. */
async function handleLine(
  line: string,
  scan: HistoryScan,
  onCommit: (record: RawCommit) => void,
): Promise<void> {
  const record = parseRecord(line);
  if (record !== undefined) {
    onCommit(record);
    return;
  }
  await scan.diffLine(line);
}

/** Parcourt l'historique et alimente le scan ; renvoie vrai si annulé. */
export async function walkLog(options: WalkLogOptions): Promise<boolean> {
  const scan = options.scan;
  let index = 0;
  scan.emitProgress(0, options.total);
  const stream = await streamGitLines(
    options.repoDir,
    buildLogCommand(options),
    async (line: string) => {
      await handleLine(line, scan, (record) => {
        scan.beginCommit(record, index);
        index += 1;
        if (index % PROGRESS_STRIDE === 0) scan.emitProgress(index, options.total);
      });
    },
    options.signal,
  );
  if (index % PROGRESS_STRIDE !== 0 || index === 0) scan.emitProgress(index, options.total);
  if (!stream.aborted && stream.code !== 0 && index === 0) {
    throw new Error(`git log failed: ${sanitizeText(stream.stderr).trim()}`);
  }
  return stream.aborted;
}
