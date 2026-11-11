import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

/**
 * Exécution de `git` en sous-processus.
 *
 * Aucune requête réseau n'est faite ici (PLA-N-01) : toutes les commandes sont
 * locales et sans interaction (`GIT_TERMINAL_PROMPT=0`). Les options de
 * configuration qui changent la forme de la sortie sont figées pour que deux
 * parcours du même dépôt produisent exactement la même sortie (PLA-P-05),
 * indépendamment de la configuration Git de la machine.
 */

/** Une commande Git : configuration forcée (`-c clé=valeur`) et arguments. */
export interface GitCommand {
  config?: readonly string[];
  args: readonly string[];
}

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Résultat d'un parcours ligne à ligne. */
export interface StreamResult {
  /** Code de sortie, `null` si le processus a été tué par un signal. */
  code: number | null;
  stderr: string;
  /** Le parcours s'est-il arrêté sur annulation ? */
  aborted: boolean;
}

/** Plafond de capture pour les sorties lues en entier (jamais tout un dépôt). */
const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;

/**
 * Configuration imposée à chaque appel : neutralise les réglages personnels qui
 * modifieraient la forme du diff (algorithmes, préfixes, signatures, couleurs).
 */
export const GIT_CONFIG_ARGS: readonly string[] = [
  '-c',
  'core.quotePath=false',
  '-c',
  'i18n.logOutputEncoding=UTF-8',
  '-c',
  'log.showSignature=false',
  '-c',
  'color.ui=false',
  '-c',
  'diff.algorithm=myers',
  '-c',
  'diff.noprefix=false',
  '-c',
  'diff.mnemonicPrefix=false',
  '-c',
  'diff.relative=false',
  '-c',
  'diff.suppressBlankEmpty=false',
  '-c',
  'diff.external=',
];

/** Environnement des sous-processus Git : pas de prompt, pas de verrou, pas de pager. */
export function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_PAGER: 'cat',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_FLUSH: '1',
  };
}

/** Tue le processus Git dès que le signal d'annulation est levé. */
function attachAbort(child: ChildProcess, signal: AbortSignal): void {
  const kill = (): void => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  };
  if (signal.aborted) {
    kill();
    return;
  }
  signal.addEventListener('abort', kill, { once: true });
  child.on('exit', () => signal.removeEventListener('abort', kill));
}

/** Lance `git` dans `repoDir`. L'appelant consomme et ferme les flux. */
export function spawnGit(
  repoDir: string,
  command: GitCommand,
  signal?: AbortSignal,
): ChildProcess {
  const config = (command.config ?? []).flatMap((entry) => ['-c', entry]);
  const child = spawn(
    'git',
    [...GIT_CONFIG_ARGS, ...config, '-C', path.resolve(repoDir), ...command.args],
    { env: gitEnv(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
  if (signal !== undefined) attachAbort(child, signal);
  return child;
}

/**
 * Observe la fin du processus. À appeler **immédiatement** après `spawnGit` :
 * si l'événement `close` est émis avant l'installation de l'écouteur, la
 * promesse ne se résoudrait jamais (interblocage intermittent).
 */
export function watchExit(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve, reject) => {
    child.on('error', (error: Error) => {
      reject(new Error(`failed to run git: ${error.message}`));
    });
    child.on('close', (code) => resolve(code));
  });
}

/** Accumule un flux texte en bornant la taille retenue. */
function collect(stream: NodeJS.ReadableStream | null, sink: (text: string) => void): void {
  if (stream === null) return;
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => sink(chunk));
}

/** Exécute une commande Git courte et renvoie sa sortie complète (bornée). */
export async function runGit(
  repoDir: string,
  command: GitCommand,
  signal?: AbortSignal,
): Promise<GitResult> {
  const child = spawnGit(repoDir, command, signal);
  const exit = watchExit(child);
  let stdout = '';
  let stderr = '';
  collect(child.stdout, (chunk) => {
    if (stdout.length < MAX_CAPTURE_BYTES) stdout += chunk;
  });
  collect(child.stderr, (chunk) => {
    if (stderr.length < MAX_CAPTURE_BYTES) stderr += chunk;
  });
  const code = await exit;
  return { code: code ?? -1, stdout, stderr };
}

/**
 * Exécute une commande Git et transmet sa sortie **ligne par ligne**, sans
 * jamais matérialiser la sortie entière (PLA-N-04).
 */
export async function streamGitLines(
  repoDir: string,
  command: GitCommand,
  onLine: (line: string) => void | Promise<void>,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const child = spawnGit(repoDir, command, signal);
  const exit = watchExit(child);
  let stderr = '';
  collect(child.stderr, (chunk) => {
    if (stderr.length < MAX_CAPTURE_BYTES) stderr += chunk;
  });

  const stdout = child.stdout;
  stdout?.setEncoding('utf8');
  let buffer = '';
  let start = 0;
  const aborted = (): boolean => signal?.aborted === true;
  for await (const chunk of stdout ?? []) {
    buffer += String(chunk);
    let cut = buffer.indexOf('\n', start);
    while (cut >= 0) {
      if (aborted()) break;
      await onLine(stripCr(buffer.slice(start, cut)));
      start = cut + 1;
      cut = buffer.indexOf('\n', start);
    }
    if (aborted()) break;
    buffer = buffer.slice(start);
    start = 0;
  }
  const code = await exit;
  if (!aborted() && buffer.length > start) await onLine(stripCr(buffer.slice(start)));
  return { code, stderr, aborted: aborted() };
}

/** Retire le retour chariot final d'une ligne (dépôt avec fins de ligne CRLF). */
function stripCr(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}
