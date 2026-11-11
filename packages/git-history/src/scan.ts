import type { CommitEvent, DiffLineEvent, HistoryEvent } from '@placard/core';

import { BlobSizeOracle } from './blob-sizes.js';
import { DiffParser, type DiffParserSink } from './diff-parser.js';
import type { PathFilter } from './ignore-paths.js';
import type { RawCommit } from './log-stream.js';
import { sanitizeText } from './sanitize.js';

/**
 * État d'un parcours : applique la politique du lecteur (chemins ignorés,
 * fichiers trop gros, binaires) et émet les événements du contrat.
 *
 * Une seule section de fichier est en cours à la fois : la mémoire nécessaire
 * ne dépend pas de la taille du diff (PLA-N-04).
 */

/** Traitement réservé à la section de fichier en cours. */
type SectionMode = 'pending' | 'text' | 'ignored' | 'binary' | 'too_large';

export interface ScanOptions {
  repoDir: string;
  maxFileBytes: number;
  ignore: PathFilter;
  emit: (event: HistoryEvent) => void;
}

export interface ScanCounts {
  commits: number;
  lines: number;
  binary: number;
  tooLarge: number;
}

/** Date ISO 8601 (UTC) d'un horodatage Unix, sans jamais lever d'exception. */
export function isoDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '1970-01-01T00:00:00.000Z';
  const date = new Date(timestamp * 1000);
  return Number.isNaN(date.getTime()) ? '1970-01-01T00:00:00.000Z' : date.toISOString();
}

export class HistoryScan implements DiffParserSink {
  private readonly options: ScanOptions;
  private readonly parser = new DiffParser(this);
  private readonly counts: ScanCounts = { commits: 0, lines: 0, binary: 0, tooLarge: 0 };
  private oracle: BlobSizeOracle | undefined;
  private oracleOpened = false;
  private commit = '';
  private currentPath = '';
  private currentSha: string | undefined;
  private skipCurrent = false;
  private pathDecided = false;
  private mode: SectionMode = 'pending';

  constructor(options: ScanOptions) {
    this.options = options;
  }

  /** Ouvre un commit : remet le parseur à zéro et émet ses métadonnées. */
  beginCommit(record: RawCommit, index: number): void {
    this.parser.reset();
    this.commit = record.commit;
    this.currentPath = '';
    this.currentSha = undefined;
    this.mode = 'pending';
    this.counts.commits += 1;
    const date = isoDate(record.timestamp);
    const event: CommitEvent = {
      commit: record.commit,
      shortCommit: record.shortCommit,
      date,
      year: Number(date.slice(0, 4)),
      author: sanitizeText(record.author),
      subject: sanitizeText(record.subject),
      index,
    };
    this.options.emit({ kind: 'commit', commit: event });
  }

  /** Transmet une ligne de diff au parseur. */
  async diffLine(line: string): Promise<void> {
    await this.parser.push(line);
  }

  /** Émet un événement de progression (PLA-F-12). */
  emitProgress(scanned: number, total: number): void {
    this.options.emit({ kind: 'progress', scanned, total });
  }

  /** Émet l'événement de fin de parcours. */
  emitEnd(): void {
    this.options.emit({ kind: 'end', commits: this.counts.commits, lines: this.counts.lines });
  }

  get tally(): ScanCounts {
    return this.counts;
  }

  close(): void {
    this.oracle?.close();
  }

  // --- DiffParserSink -----------------------------------------------------

  file(tentativePath?: string): void {
    this.currentPath = tentativePath ?? '';
    this.currentSha = undefined;
    this.pathDecided = tentativePath !== undefined;
    this.skipCurrent = tentativePath !== undefined && this.options.ignore(tentativePath);
    this.mode = this.skipCurrent ? 'ignored' : 'pending';
  }

  path(path: string, sha?: string): void {
    this.currentPath = path;
    if (sha !== undefined) this.currentSha = sha;
    if (this.pathDecided) return;
    this.pathDecided = true;
    this.skipCurrent = this.options.ignore(path);
    this.mode = this.skipCurrent ? 'ignored' : 'pending';
    if (!this.skipCurrent) {
      // Émis pour CHAQUE fichier du commit, y compris sans ligne de diff :
      // c'est ce qui permet aux règles « par nom de fichier » de voir un
      // `.env` vide (PLA-F-04).
      this.options.emit({ kind: 'file', file: { commit: this.commit, path } });
    }
  }

  async binary(path: string, sha?: string): Promise<void> {
    this.path(path, sha);
    if (this.mode === 'ignored') return;
    const bytes = await this.blobSize();
    if (bytes !== undefined && bytes > this.options.maxFileBytes) {
      this.markSkipped('too_large', bytes);
      return;
    }
    this.markSkipped('binary', bytes);
  }

  async hunk(): Promise<void> {
    if (this.mode !== 'pending') return;
    const bytes = await this.blobSize();
    if (bytes !== undefined && bytes > this.options.maxFileBytes) {
      this.markSkipped('too_large', bytes);
      return;
    }
    this.mode = 'text';
  }

  line(side: 'added' | 'removed', lineNumber: number, text: string): void {
    if (this.mode === 'ignored' || this.mode === 'binary' || this.mode === 'too_large') return;
    this.counts.lines += 1;
    const event: DiffLineEvent = {
      commit: this.commit,
      path: this.currentPath,
      line: lineNumber,
      text: sanitizeText(text),
      side,
    };
    this.options.emit({ kind: 'line', line: event });
  }

  // --- politique ----------------------------------------------------------

  private markSkipped(reason: 'binary' | 'too_large', bytes: number | undefined): void {
    this.mode = reason === 'binary' ? 'binary' : 'too_large';
    if (reason === 'binary') this.counts.binary += 1;
    else this.counts.tooLarge += 1;
    const skipped: { commit: string; path: string; reason: 'binary' | 'too_large'; bytes?: number } = {
      commit: this.commit,
      path: this.currentPath,
      reason,
    };
    if (bytes !== undefined) skipped.bytes = bytes;
    this.options.emit({ kind: 'skipped', skipped });
  }

  private async blobSize(): Promise<number | undefined> {
    const sha = this.currentSha;
    if (sha === undefined) return undefined;
    const oracle = this.openOracle();
    if (oracle === undefined) return undefined;
    try {
      const sizes = await oracle.lookup([sha]);
      return sizes.get(sha);
    } catch {
      return undefined;
    }
  }

  private openOracle(): BlobSizeOracle | undefined {
    if (!this.oracleOpened) {
      this.oracleOpened = true;
      try {
        this.oracle = BlobSizeOracle.open(this.options.repoDir);
      } catch {
        this.oracle = undefined;
      }
    }
    return this.oracle;
  }
}
