import { spawn } from 'node:child_process';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { FileContent } from './noise.js';

/**
 * Helpers Git du générateur.
 *
 * Tout passe par des variables d'environnement (`GIT_AUTHOR_*`,
 * `GIT_COMMITTER_*`) et par une configuration globale neutralisée : la
 * génération ne dépend jamais de la configuration Git de la machine, ce qui
 * rend les SHA reproductibles (même graine + même `headDate` ⇒ mêmes SHA).
 */

/** Identité fixe des commits du dépôt synthétique. */
export const DEMO_IDENTITY = {
  name: 'Placard Demo',
  email: 'demo@example.com',
} as const;

/** Environnement Git isolé : ni config système, ni config utilisateur. */
export function baseEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    TZ: 'UTC',
  };
}

/** Lance une commande Git et rend sa sortie standard. */
export function git(cwd: string, args: readonly string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', [...args], { cwd, env });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`git ${args.join(' ')} failed (${code}): ${stderr.trim()}`));
    });
  });
}

/** Initialise un dépôt neuf sur la branche `main`, avec une identité locale fixe. */
export async function initRepo(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const env = baseEnv();
  await git(dir, ['init', '--quiet', '-b', 'main'], env);
  await git(dir, ['config', 'core.autocrlf', 'false'], env);
  await git(dir, ['config', 'commit.gpgsign', 'false'], env);
  await git(dir, ['config', 'user.name', DEMO_IDENTITY.name], env);
  await git(dir, ['config', 'user.email', DEMO_IDENTITY.email], env);
}

/** Environnement d'un commit daté, horodatage en UTC pour être reproductible. */
function commitEnv(date: Date): NodeJS.ProcessEnv {
  const stamp = `${Math.floor(date.getTime() / 1000)} +0000`;
  return {
    ...baseEnv(),
    GIT_AUTHOR_NAME: DEMO_IDENTITY.name,
    GIT_AUTHOR_EMAIL: DEMO_IDENTITY.email,
    GIT_AUTHOR_DATE: stamp,
    GIT_COMMITTER_NAME: DEMO_IDENTITY.name,
    GIT_COMMITTER_EMAIL: DEMO_IDENTITY.email,
    GIT_COMMITTER_DATE: stamp,
  };
}

function sameContent(left: FileContent, right: FileContent): boolean {
  if (typeof left === 'string' && typeof right === 'string') return left === right;
  if (Buffer.isBuffer(left) && Buffer.isBuffer(right)) return left.equals(right);
  return false;
}

/** Écrit sur disque les seuls fichiers modifiés, et supprime les fichiers retirés. */
export async function syncTree(
  dir: string,
  files: Map<string, FileContent>,
  written: Map<string, FileContent>,
): Promise<void> {
  for (const [path, content] of files) {
    const previous = written.get(path);
    if (previous !== undefined && sameContent(previous, content)) continue;
    const full = join(dir, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
    written.set(path, content);
  }
  for (const path of [...written.keys()]) {
    if (files.has(path)) continue;
    await unlink(join(dir, path)).catch(() => undefined);
    written.delete(path);
  }
}

/** Commite l'état courant du disque et rend le SHA du commit créé. */
export async function commitAll(dir: string, date: Date, message: string): Promise<string> {
  const env = commitEnv(date);
  await git(dir, ['add', '--all'], env);
  await git(dir, ['commit', '--quiet', '--no-gpg-sign', '--no-verify', '-m', message], env);
  const head = await git(dir, ['rev-parse', 'HEAD'], env);
  return head.trim();
}

/** Ajoute un distant public fictif (score +10 de l'analyse). */
export async function addPublicRemote(dir: string): Promise<void> {
  await git(
    dir,
    ['remote', 'add', 'origin', 'https://github.com/placard-demo/reports-service.git'],
    baseEnv(),
  );
}
