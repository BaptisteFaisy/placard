import { execFile } from 'node:child_process';

/**
 * Appel `git` sans jamais lever d'exception : l'appelant décide quoi faire.
 *
 * Aucune valeur détectée ne transite par ce module : les commandes ne portent
 * que des chemins, des révisions et des options (PLA-N-02).
 */

export interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface GitCallOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

const MAX_BUFFER = 64 * 1024 * 1024;

/** Lance `git <args>` et rend le résultat brut (jamais d'exception). */
export function git(args: string[], options: GitCallOptions = {}): Promise<GitResult> {
  const env = options.env ?? process.env;
  const timeout = options.timeoutMs ?? 120_000;
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd: options.cwd, env, timeout, maxBuffer: MAX_BUFFER, encoding: 'utf8' },
      (error, stdout, stderr) => {
        const code = typeof error?.code === 'number' ? error.code : error ? 1 : 0;
        resolve({ ok: error === null, stdout: stdout ?? '', stderr: stderr ?? '', code });
      },
    );
  });
}

/** Lance une commande quelconque (script de purge, python3) sans exception. */
export function run(
  file: string,
  args: string[],
  options: GitCallOptions = {},
): Promise<GitResult> {
  const env = options.env ?? process.env;
  const timeout = options.timeoutMs ?? 120_000;
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { cwd: options.cwd, env, timeout, maxBuffer: MAX_BUFFER, encoding: 'utf8' },
      (error, stdout, stderr) => {
        const code = typeof error?.code === 'number' ? error.code : error ? 1 : 0;
        resolve({ ok: error === null, stdout: stdout ?? '', stderr: stderr ?? '', code });
      },
    );
  });
}
