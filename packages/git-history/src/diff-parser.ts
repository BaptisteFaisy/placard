import { sanitizePath } from './sanitize.js';

/**
 * Analyse incrémentale d'un diff unifié produit par `git` (`-p -U0 --full-index`).
 *
 * Le parseur ne retient rien : il pousse des événements à un récepteur au fil
 * des lignes. Un seul fichier est en cours à la fois, donc la mémoire utilisée
 * est celle d'une ligne, pas celle du diff (PLA-N-04). Il ne lève jamais
 * d'exception, quel que soit le contenu (PLA-P-10).
 */

/** Récepteur d'événements de diff, appelé dans l'ordre du flux. */
export interface DiffParserSink {
  /** Début d'un bloc `diff --git` ; chemin déduit quand il est non ambigu. */
  file(tentativePath?: string): void;
  /** Chemin définitif du fichier, lu sur la ligne `+++ b/…`, et SHA de son blob. */
  path(path: string, sha?: string): void;
  /** Fichier binaire (git n'a pas envoyé son contenu) ; `sha` du blob si connue. */
  binary(path: string, sha?: string): void | Promise<void>;
  /** Début d'un bloc de modifications. */
  hunk(): void | Promise<void>;
  /** Ligne ajoutée ou retirée, avec son numéro de ligne (1-based). */
  line(side: 'added' | 'removed', lineNumber: number, text: string): void;
}

const DEV_NULL = '/dev/null';
const GIT_HEADER = 'diff --git ';
const BINARY_LINE = /^Binary files (.+) and (.+) differ$/;
const HUNK_LINE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const INDEX_LINE = /^index ([0-9a-f]+)\.\.([0-9a-f]+)(?: .*)?$/;
const ZERO_SHA = /^0+$/;

const C_ESCAPES: Record<string, string> = {
  a: '\u0007',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
  '"': '"',
  '\\': '\\',
};

/**
 * Décode un chemin mis entre guillemets par Git. Git échappe les octets, pas les
 * caractères : `"caf\303\251.txt"` désigne les deux octets UTF-8 de `é`, qu'il
 * faut donc réassembler avant de décoder (sinon on obtient `cafÃ©.txt`).
 */
export function unquoteGitPath(raw: string): string {
  if (raw.length < 2 || !raw.startsWith('"') || !raw.endsWith('"')) return raw;
  const body = raw.slice(1, -1);
  const bytes: number[] = [];
  let index = 0;
  while (index < body.length) {
    if (body.charAt(index) === '\\') {
      const octal = /^[0-7]{1,3}/.exec(body.slice(index + 1));
      if (octal !== null) {
        bytes.push(Number.parseInt(octal[0] ?? '0', 8) & 0xff);
        index += 1 + octal[0].length;
        continue;
      }
      const escaped = body.charAt(index + 1);
      bytes.push(...Buffer.from(C_ESCAPES[escaped] ?? escaped, 'utf8'));
      index += 2;
      continue;
    }
    const symbol = String.fromCodePoint(body.codePointAt(index) ?? 0);
    bytes.push(...Buffer.from(symbol, 'utf8'));
    index += symbol.length;
  }
  return Buffer.from(bytes).toString('utf8');
}

/** Lit un chemin de diff (`a/x`, `b/x`, `/dev/null`, éventuellement guillemeté). */
export function parseDiffPath(raw: string, prefix: string): string | undefined {
  const trimmed = raw.endsWith('\t') ? raw.slice(0, -1) : raw;
  const unquoted = unquoteGitPath(trimmed);
  if (unquoted === DEV_NULL || unquoted === '') return undefined;
  const head = `${prefix}/`;
  return sanitizePath(unquoted.startsWith(head) ? unquoted.slice(head.length) : unquoted);
}

/** Déduit le chemin de l'en-tête `diff --git a/x b/x` quand les deux côtés concordent. */
export function parseHeaderPath(rest: string): string | undefined {
  if (!rest.startsWith('a/')) return undefined;
  const cut = rest.indexOf(' b/');
  if (cut <= 0) return undefined;
  const left = rest.slice(2, cut);
  const right = rest.slice(cut + 3);
  if (left !== right || left === '') return undefined;
  return sanitizePath(unquoteGitPath(left));
}

/** Début d'un hunk : `start + 1` quand le côté compte zéro ligne (côté vide). */
function hunkStart(start: string | undefined, count: string | undefined): number {
  const base = Number(start ?? '0');
  return count === '0' ? base + 1 : base;
}

/** Parseur de diff : une instance par parcours, réinitialisable à chaque commit. */export class DiffParser {
  private readonly sink: DiffParserSink;
  private inHunk = false;
  private oldLine = 0;
  private newLine = 0;
  private oldPath: string | undefined;
  private newPath: string | undefined;
  private oldSha: string | undefined;
  private newSha: string | undefined;

  constructor(sink: DiffParserSink) {
    this.sink = sink;
  }

  /** Remet le parseur à zéro (nouveau commit, ou fin d'un bloc de diff). */
  reset(): void {
    this.inHunk = false;
    this.oldLine = 0;
    this.newLine = 0;
    this.oldPath = undefined;
    this.newPath = undefined;
    this.oldSha = undefined;
    this.newSha = undefined;
  }

  /** Traite une ligne de la sortie de `git log -p`. */
  async push(line: string): Promise<void> {
    if (line.startsWith(GIT_HEADER)) {
      this.beginFile(line.slice(GIT_HEADER.length));
      return;
    }
    if (this.inHunk && !line.startsWith('@@') && this.hunkLine(line)) return;
    this.inHunk = false;
    if (line.startsWith('@@')) {
      await this.beginHunk(line);
      return;
    }
    await this.headerLine(line);
  }

  private beginFile(rest: string): void {
    this.reset();
    this.sink.file(parseHeaderPath(rest));
  }

  private async beginHunk(line: string): Promise<void> {
    const match = HUNK_LINE.exec(line);
    if (match === null) return;
    this.inHunk = true;
    this.oldLine = hunkStart(match[1], match[2]);
    this.newLine = hunkStart(match[3], match[4]);
    await this.sink.hunk();
  }

  /** Traite une ligne de hunk ; renvoie faux si la ligne n'en fait pas partie. */
  private hunkLine(line: string): boolean {
    const marker = line.charAt(0);
    if (marker === '+') {
      this.sink.line('added', this.newLine, line.slice(1));
      this.newLine += 1;
      return true;
    }
    if (marker === '-') {
      this.sink.line('removed', this.newLine, line.slice(1));
      this.oldLine += 1;
      return true;
    }
    if (marker === ' ' || line === '') {
      this.oldLine += 1;
      this.newLine += 1;
      return true;
    }
    return marker === '\\';
  }

  private async headerLine(line: string): Promise<void> {
    if (line.startsWith('--- ')) {
      this.oldPath = parseDiffPath(line.slice(4), 'a');
      return;
    }
    if (line.startsWith('+++ ')) {
      this.newPath = parseDiffPath(line.slice(4), 'b');
      const resolved = this.newPath ?? this.oldPath;
      if (resolved !== undefined) this.sink.path(resolved, this.blobSha());
      return;
    }
    const binary = BINARY_LINE.exec(line);
    if (binary !== null) {
      await this.emitBinary(binary[1] ?? '', binary[2] ?? '');
      return;
    }
    const index = INDEX_LINE.exec(line);
    if (index !== null) {
      this.oldSha = index[1];
      this.newSha = index[2];
    }
  }

  private async emitBinary(source: string, target: string): Promise<void> {
    const resolved =
      parseDiffPath(target, 'b') ?? this.newPath ?? this.oldPath ?? parseDiffPath(source, 'a');
    if (resolved === undefined) return;
    await this.sink.binary(resolved, this.blobSha());
  }

  /** SHA du blob porteur du contenu binaire (nouveau côté, sinon ancien). */
  private blobSha(): string | undefined {
    if (this.newSha !== undefined && !ZERO_SHA.test(this.newSha)) return this.newSha;
    if (this.oldSha !== undefined && !ZERO_SHA.test(this.oldSha)) return this.oldSha;
    return undefined;
  }
}
