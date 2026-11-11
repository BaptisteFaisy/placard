import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import type { PreventionProposal, RitualOptions } from '@placard/core';

import { git } from './git-exec.js';

/**
 * Prévention (PLA-F-26).
 *
 * Placard propose, il n'impose rien : sans `apply`, aucun fichier n'est touché.
 * La proposition est renvoyée telle quelle, l'interface la montre comme une
 * modification à accepter.
 */

/** Fichiers et dossiers qui ne doivent jamais entrer dans l'historique. */
export const GITIGNORE_LINES: readonly string[] = [
  '# Placard — never commit credentials or local state',
  '.env',
  '.env.*',
  '!.env.example',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  'id_rsa',
  'id_ed25519',
  '.placard/state/',
];

/** Crochet pre-commit : refuse un commit qui introduit un secret. */
export const PRE_COMMIT_HOOK = `#!/bin/sh
# Installed by Placard — blocks commits that introduce secrets (PLA-F-26).
# Requires the placard CLI on PATH. Remove this file to uninstall.
set -eu

if ! command -v placard >/dev/null 2>&1; then
  echo "placard: CLI not found, pre-commit scan skipped" >&2
  exit 0
fi

exec placard scan --staged
`;

const REMINDERS: readonly string[] = [
  'Turn on push protection and secret scanning in the hosting provider settings: they block a leak before it reaches the history.',
  'Enable the hook in every clone: hooks are not versioned, so install it with a tool your team already runs (husky, lefthook, pre-commit).',
  'Run the same scan in CI on every pull request, so a bypassed hook is still caught.',
  'Agree on a rotation reflex: a leaked credential is revoked first, purged second, never the other way round.',
];

/** Chemin du crochet pre-commit du dépôt, résolu par Git lui-même. */
export async function resolveHookPath(repoDir: string): Promise<string> {
  const result = await git(['-C', repoDir, 'rev-parse', '--git-path', 'hooks/pre-commit']);
  const raw = result.ok ? result.stdout.trim() : '';
  if (raw === '') return join(repoDir, '.git', 'hooks', 'pre-commit');
  return isAbsolute(raw) ? raw : join(repoDir, raw);
}

async function readIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
}

async function applyGitignore(repoDir: string): Promise<void> {
  const path = join(repoDir, '.gitignore');
  const current = (await readIfExists(path)) ?? '';
  const missing = GITIGNORE_LINES.filter(
    (line) => line.startsWith('#') === false && current.split('\n').includes(line) === false,
  );
  if (missing.length === 0) return;
  const prefix = current.length === 0 || current.endsWith('\n') ? '' : '\n';
  const block = ['', '# Added by Placard', ...missing, ''].join('\n');
  await appendFile(path, `${prefix}${block}`, 'utf8');
}

interface HookInstall {
  path: string;
  installed: boolean;
}

async function applyHook(hookPath: string): Promise<HookInstall> {
  await mkdir(join(hookPath, '..'), { recursive: true });
  const existing = await readIfExists(hookPath);
  if (existing !== undefined) {
    // Un crochet existant appartient à l'utilisateur : on propose, on n'écrase pas.
    await writeFile(`${hookPath}.placard`, PRE_COMMIT_HOOK, { mode: 0o755 });
    return { path: `${hookPath}.placard`, installed: false };
  }
  await writeFile(hookPath, PRE_COMMIT_HOOK, { mode: 0o755 });
  return { path: hookPath, installed: true };
}

/** Propose (et sur demande explicite, applique) le .gitignore et le crochet. */
export async function prevention(
  options: RitualOptions,
  apply = false,
): Promise<PreventionProposal> {
  const hookPath = await resolveHookPath(options.repoDir);
  const reminders = [...REMINDERS];
  if (apply) {
    await applyGitignore(options.repoDir);
    const hook = await applyHook(hookPath);
    if (!hook.installed) {
      reminders.unshift(
        `A pre-commit hook already exists and was left untouched: the Placard proposal is at ${hook.path}.`,
      );
    }
  }
  return {
    gitignoreLines: [...GITIGNORE_LINES],
    preCommitHook: PRE_COMMIT_HOOK,
    hookPath,
    reminders,
  };
}
