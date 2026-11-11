import { readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GenerateResult } from './index.js';
import { makeRepo } from './testing.js';

/**
 * Garde PLA-N-09 : aucune valeur factice au format réel d'un secret n'est
 * écrite dans les sources du paquet. Toutes sont fabriquées à l'exécution par
 * `fakeValue` de `@placard/core`, dans le dépôt temporaire généré.
 */

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url));

async function readSources(): Promise<string> {
  const entries = await readdir(SOURCE_DIR, { withFileTypes: true });
  const chunks: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    chunks.push(await readFile(join(SOURCE_DIR, entry.name), 'utf8'));
  }
  return chunks.join('\n');
}

describe('garde PLA-N-09', () => {
  let sources: string;
  const dirs: string[] = [];

  beforeAll(async () => {
    sources = await readSources();
  });

  afterAll(async () => {
    for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  });

  it('ne contient aucune valeur de l’oracle dans les sources du paquet', async () => {
    const result: GenerateResult = await makeRepo({ commits: 12, years: 1 });
    dirs.push(result.repoDir);
    expect(result.planted.length).toBeGreaterThan(0);
    for (const secret of result.planted) {
      expect(sources.includes(secret.value)).toBe(false);
    }
  }, 180_000);

  it('ne contient aucune valeur d’une autre graine non plus', async () => {
    const other = await makeRepo({ seed: 'autre-graine', commits: 12, years: 1 });
    dirs.push(other.repoDir);
    for (const secret of other.planted) {
      expect(sources.includes(secret.value)).toBe(false);
    }
  }, 180_000);

  it('ne contient aucun littéral au format d’une clé privée ou d’un jeton signé', () => {
    expect(sources).not.toContain(`-----BEGIN${' RSA PRIVATE KEY-----'}`);
    expect(sources).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./);
    expect(sources).not.toMatch(/\b(ghp|gho|ghs)_[A-Za-z0-9]{20,}/);
    expect(sources).not.toMatch(/\bsk_(live|test)_[A-Za-z0-9]{10,}/);
  });
});
