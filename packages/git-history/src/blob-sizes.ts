import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { Readable } from 'node:stream';

import { GIT_CONFIG_ARGS, gitEnv } from './git-exec';

/**
 * Oracle de taille de blobs : un unique processus `git cat-file --batch-check`
 * interrogeable à la demande.
 *
 * Il sert à distinguer un fichier **binaire** d'un fichier **trop volumineux** :
 * `git` signale les deux de la même façon (`Binary files … differ`) dès que
 * `core.bigFileThreshold` est abaissé à `maxFileBytes`. Seule la taille réelle
 * du blob permet de trancher (PLA-F-01).
 */

const FULL_SHA = /^[0-9a-f]{40}$/;

/** File d'attente de lignes sur un flux texte (réponse de `cat-file`). */
class LineQueue {
  private readonly lines: string[] = [];
  private readonly waiters: Array<(line: string | undefined) => void> = [];
  private buffer = '';
  private ended = false;

  constructor(stream: NodeJS.ReadableStream) {
    stream.setEncoding('utf8');
    stream.on('data', (chunk: string) => this.push(chunk));
    stream.on('end', () => this.end());
    stream.on('error', () => this.end());
  }

  read(): Promise<string | undefined> {
    const ready = this.lines.shift();
    if (ready !== undefined) return Promise.resolve(ready);
    if (this.ended) return Promise.resolve(undefined);
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  private push(chunk: string): void {
    this.buffer += chunk;
    let cut = this.buffer.indexOf('\n');
    while (cut >= 0) {
      this.deliver(this.buffer.slice(0, cut));
      this.buffer = this.buffer.slice(cut + 1);
      cut = this.buffer.indexOf('\n');
    }
  }

  private deliver(line: string): void {
    const waiter = this.waiters.shift();
    if (waiter !== undefined) waiter(line);
    else this.lines.push(line);
  }

  private end(): void {
    this.ended = true;
    if (this.buffer !== '') {
      this.deliver(this.buffer);
      this.buffer = '';
    }
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.(undefined);
    }
  }
}

/** Lit `<sha> blob <taille>` ; renvoie `undefined` pour un objet absent. */
export function parseBatchCheckLine(line: string | undefined): number | undefined {
  if (line === undefined) return undefined;
  const parts = line.split(' ');
  if (parts.length < 3 || parts[1] !== 'blob') return undefined;
  const size = Number(parts[2]);
  return Number.isFinite(size) && size >= 0 ? size : undefined;
}

export class BlobSizeOracle {
  private readonly child: ChildProcess;
  private readonly queue: LineQueue;
  private readonly cache = new Map<string, number | undefined>();
  private chain: Promise<unknown> = Promise.resolve();
  private closed = false;

  private constructor(child: ChildProcess, queue: LineQueue) {
    this.child = child;
    this.queue = queue;
  }

  /** Ouvre l'oracle ; en cas d'échec, `lookup` renvoie simplement des tailles inconnues. */
  static open(repoDir: string): BlobSizeOracle {
    const child = spawn(
      'git',
      [...GIT_CONFIG_ARGS, '-C', path.resolve(repoDir), 'cat-file', '--batch-check'],
      { env: gitEnv(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
    );
    child.stderr?.resume();
    child.stdin?.on('error', () => undefined);
    const queue = new LineQueue(child.stdout ?? Readable.from([]));
    return new BlobSizeOracle(child, queue);
  }

  /** Taille en octets des blobs demandés (absents : non renseignés). */
  async lookup(shas: readonly string[]): Promise<Map<string, number>> {
    const wanted = [...new Set(shas.filter((sha) => FULL_SHA.test(sha)))].filter(
      (sha) => !this.cache.has(sha),
    );
    if (wanted.length === 0 || this.closed) return this.known();
    const run = async (): Promise<void> => this.request(wanted);
    const next = this.chain.then(run, run);
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    await next.catch(() => undefined);
    return this.known();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.child.stdin?.end();
    this.child.kill('SIGTERM');
  }

  private known(): Map<string, number> {
    const sizes = new Map<string, number>();
    for (const [sha, size] of this.cache) if (size !== undefined) sizes.set(sha, size);
    return sizes;
  }

  private async request(shas: readonly string[]): Promise<void> {
    if (this.child.stdin === null || this.child.stdin.destroyed) return;
    this.child.stdin.write(shas.map((sha) => `${sha}\n`).join(''));
    for (const sha of shas) {
      const size = parseBatchCheckLine(await this.queue.read());
      this.cache.set(sha, size);
    }
  }
}
