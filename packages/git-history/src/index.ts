/**
 * `@placard/git-history` — lecteur d'historique Git en flux.
 *
 * Le paquet implémente `HistoryReader` (contrat `@placard/core`) : il parcourt
 * les commits de toutes les références, lit les lignes ajoutées **et** retirées,
 * compte les fichiers binaires ou trop volumineux, neutralise le contenu
 * hostile et n'émet que des événements — jamais le dépôt entier en mémoire.
 */

export {
  DEFAULT_MAX_FILE_BYTES,
  createHistoryReader,
  progressTotal,
  readHistory,
  resolveOptions,
  type ResolvedOptions,
} from './history.js';
export { HistoryScan, isoDate, type ScanCounts, type ScanOptions } from './scan.js';
export {
  DIFF_ARGS,
  PROGRESS_STRIDE,
  RECORD_MARKER,
  buildLogCommand,
  logFormatArg,
  normalizeRefs,
  parseRecord,
  walkLog,
  type LogOptions,
  type RawCommit,
  type WalkLogOptions,
} from './log-stream.js';
export { buildStagedCommand, readHeadInfo, walkStaged } from './staged.js';
export {
  DiffParser,
  parseDiffPath,
  parseHeaderPath,
  unquoteGitPath,
  type DiffParserSink,
} from './diff-parser.js';
export {
  MAX_LINE_CHARS,
  MAX_PATH_CHARS,
  sanitizePath,
  sanitizeText,
  stripEscapes,
  truncateLine,
} from './sanitize.js';
export { compileIgnorePatterns, globToRegExp, type PathFilter } from './ignore-paths.js';
export { BlobSizeOracle, parseBatchCheckLine } from './blob-sizes.js';
export {
  assertGitRepo,
  countCommits,
  isPublicRemote,
  readRepoSnapshot,
  repoName,
} from './repo-info.js';
export type {
  CommitEvent,
  DiffLineEvent,
  HistoryEvent,
  HistoryReader,
  ReadHistoryOptions,
  ReadHistoryResult,
  RepoSnapshot,
  SkippedFileEvent,
} from '@placard/core';
