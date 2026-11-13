import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Finding, RitualState } from '@placard/core';

/**
 * État persistant du rituel, un fichier JSON par trouvaille.
 *
 * Chemin : `<placardDir>/state/<empreinte>.json`. L'empreinte HMAC contient un
 * « : » (`hmac256:...`) : le nom de fichier en est dérivé de façon
 * déterministe, donc relisible sans deviner quoi que ce soit.
 *
 * Écriture atomique (PLA-F-23) : fichier temporaire puis `rename`, jamais de
 * JSON tronqué si le processus meurt en cours d'écriture.
 */

export const STATE_DIR = 'state';

/** Nom de fichier stable pour une empreinte (les caractères non sûrs deviennent « - »). */
export function stateFileName(fingerprint: string): string {
  const safe = fingerprint.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^[-_]+|[-_]+$/g, '');
  return `${safe.length > 0 ? safe : 'unknown'}.json`;
}

export function stateDir(placardDir: string): string {
  return join(placardDir, STATE_DIR);
}

export function statePath(placardDir: string, fingerprint: string): string {
  return join(stateDir(placardDir), stateFileName(fingerprint));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Valide le strict minimum ; un fichier corrompu est traité comme absent. */
export function parseState(input: unknown): RitualState | undefined {
  if (!isRecord(input)) return undefined;
  const fingerprint = input['fingerprint'];
  const findingId = input['findingId'];
  if (typeof fingerprint !== 'string' || typeof findingId !== 'string') return undefined;
  return input as unknown as RitualState;
}

/** État vide d'une trouvaille : rien n'est encore fait. */
export function baseState(finding: Finding): RitualState {
  return { fingerprint: finding.fingerprint, findingId: finding.id };
}

/** Lit l'état d'une trouvaille ; `undefined` s'il n'existe pas ou est illisible. */
export async function loadState(
  placardDir: string,
  fingerprint: string,
): Promise<RitualState | undefined> {
  try {
    const raw = await readFile(statePath(placardDir, fingerprint), 'utf8');
    return parseState(JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

/** Écrit l'état de façon atomique, en 0600 (métadonnées du rituel). */
export async function saveState(placardDir: string, state: RitualState): Promise<void> {
  const dir = stateDir(placardDir);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const target = statePath(placardDir, state.fingerprint);
  const tmp = join(dir, `.${stateFileName(state.fingerprint)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, target);
}
